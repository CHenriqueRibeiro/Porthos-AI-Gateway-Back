const prisma = require("../db/prisma")
const subscriptionService = require("./subscription.service")
const { resolveEffectiveConfig } = require("./billingConfig.service")

function formatDay(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(date))
}

function getDefaultPeriod() {
  const now = new Date()

  const start = new Date(now)
  start.setDate(1)
  start.setHours(0, 0, 0, 0)

  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

function getDayPeriod(day) {
  const [year, month, date] = day.split("-").map(Number)

  const start = new Date(year, month - 1, date, 0, 0, 0, 0)
  const end = new Date(year, month - 1, date, 23, 59, 59, 999)

  return { start, end }
}

function getCustomPeriod(startDate, endDate) {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number)
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number)

  const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0)
  const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999)

  return { start, end }
}

function roundMoney(value) {
  return Number((value || 0).toFixed(8))
}

function getSafeGroupKey(item, field) {
  const value = item[field]
  if (value) return value

  if (field === "provider" || field === "providerModel") {
    return "internal"
  }

  if (field === "keySource") {
    return "none"
  }

  if (field === "routeType" || field === "workloadCategory") {
    return "legacy"
  }

  return "unknown"
}

function buildGroupedCostMap(items, field) {
  const result = {}

  for (const item of items) {
    const key = getSafeGroupKey(item, field)

    if (!result[key]) {
      result[key] = {
        key,
        totalRequests: 0,
        providerInputTokens: 0,
        providerOutputTokens: 0,
        providerTotalTokens: 0,
        estimatedCostInput: 0,
        estimatedCostOutput: 0,
        estimatedCostTotal: 0
      }
    }

    result[key].totalRequests += 1
    result[key].providerInputTokens += item.llmInputTokens || 0
    result[key].providerOutputTokens += item.llmOutputTokens || 0
    result[key].providerTotalTokens += item.llmTotalTokens || 0
    result[key].estimatedCostInput += item.estimatedCostInput || 0
    result[key].estimatedCostOutput += item.estimatedCostOutput || 0
    result[key].estimatedCostTotal += item.estimatedCostTotal || 0
  }

  return Object.values(result).map((item) => ({
    ...item,
    estimatedCostInput: roundMoney(item.estimatedCostInput),
    estimatedCostOutput: roundMoney(item.estimatedCostOutput),
    estimatedCostTotal: roundMoney(item.estimatedCostTotal)
  }))
}

async function getDashboardOverviewByUser(userId, filters = {}) {
  const { day, startDate, endDate, includeDaily = "false" } = filters

  let period

  if (day) {
    period = getDayPeriod(day)
  } else if (startDate && endDate) {
    period = getCustomPeriod(startDate, endDate)
  } else {
    period = getDefaultPeriod()
  }

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId },
    select: { id: true, createdAt: true }
  })

  if (!apiKeys.length) {
    return {
      period: {
        startDate: formatDay(period.start),
        endDate: formatDay(period.end)
      },
      plan: null,
      summary: {
        totalRequests: 0,
        requestsSentToLlm: 0,
        requestsServedWithoutLlm: 0,
        requestsServedWithoutLlmRate: 0,
        inputTokensBeforeOptimization: 0,
        inputTokensSent: 0,
        inputTokensSaved: 0,
        outputTokensReturnedByGateway: 0,
        providerInputTokens: 0,
        providerOutputTokens: 0,
        providerTotalTokens: 0,
        estimatedCostInput: 0,
        estimatedCostOutput: 0,
        estimatedCostTotal: 0,
        currency: "USD"
      },
      cache: {
        fingerprintHits: 0,
        semanticHits: 0,
        localHits: 0
      },
      breakdowns: {
        byCacheType: {
          llm: 0,
          fingerprint: 0,
          semantic: 0,
          local: 0
        },
        byProvider: [],
        byModel: [],
        byKeySource: [],
        byScope: [],
        byRouteType: [],
        byWorkload: []
      },
      apiKeys: []
    }
  }

  const apiKeyIds = apiKeys.map((item) => item.id)

  const usages = await prisma.tokenUsage.findMany({
    where: {
      apiKeyId: {
        in: apiKeyIds
      },
      createdAt: {
        gte: period.start,
        lte: period.end
      }
    },
    orderBy: { createdAt: "desc" }
  })

  const activeSubscriptions = await prisma.customerSubscription.findMany({
    where: {
      apiKeyId: {
        in: apiKeyIds
      },
      status: "active"
    },
    include: {
      plan: true,
      addons: {
        where: { isActive: true },
        include: {
          addon: true
        }
      },
      overrides: {
        where: { isActive: true }
      }
    },
    orderBy: { createdAt: "desc" }
  })

  const summaryRaw = usages.reduce(
    (acc, item) => {
      const cacheType = item.cacheType || "llm"

      acc.totalRequests += 1
      acc.inputTokensBeforeOptimization += item.systemInputTokensOriginal || 0
      acc.inputTokensSent += item.systemInputTokensOptimized || 0
      acc.outputTokensReturnedByGateway += item.systemResponseTokens || 0

      acc.providerInputTokens += item.llmInputTokens || 0
      acc.providerOutputTokens += item.llmOutputTokens || 0
      acc.providerTotalTokens += item.llmTotalTokens || 0

      acc.estimatedCostInput += item.estimatedCostInput || 0
      acc.estimatedCostOutput += item.estimatedCostOutput || 0
      acc.estimatedCostTotal += item.estimatedCostTotal || 0

      if (cacheType === "fingerprint") acc.fingerprintHits += 1
      if (cacheType === "semantic") acc.semanticHits += 1
      if (cacheType === "llm") acc.requestsSentToLlm += 1
      if (cacheType === "local" || cacheType === "document_memory") acc.localHits += 1

      return acc
    },
    {
      totalRequests: 0,
      inputTokensBeforeOptimization: 0,
      inputTokensSent: 0,
      outputTokensReturnedByGateway: 0,
      providerInputTokens: 0,
      providerOutputTokens: 0,
      providerTotalTokens: 0,
      estimatedCostInput: 0,
      estimatedCostOutput: 0,
      estimatedCostTotal: 0,
      currency: "USD",
      fingerprintHits: 0,
      semanticHits: 0,
      localHits: 0,
      requestsSentToLlm: 0
    }
  )

  const requestsServedWithoutLlm =
    summaryRaw.fingerprintHits + summaryRaw.semanticHits + summaryRaw.localHits

  const summary = {
    totalRequests: summaryRaw.totalRequests,
    requestsSentToLlm: summaryRaw.requestsSentToLlm,
    requestsServedWithoutLlm,
    requestsServedWithoutLlmRate:
      summaryRaw.totalRequests > 0
        ? Number(
            ((requestsServedWithoutLlm / summaryRaw.totalRequests) * 100).toFixed(2)
          )
        : 0,
    inputTokensBeforeOptimization: summaryRaw.inputTokensBeforeOptimization,
    inputTokensSent: summaryRaw.inputTokensSent,
    inputTokensSaved:
      summaryRaw.inputTokensBeforeOptimization - summaryRaw.inputTokensSent,
    outputTokensReturnedByGateway: summaryRaw.outputTokensReturnedByGateway,
    providerInputTokens: summaryRaw.providerInputTokens,
    providerOutputTokens: summaryRaw.providerOutputTokens,
    providerTotalTokens: summaryRaw.providerTotalTokens,
    estimatedCostInput: roundMoney(summaryRaw.estimatedCostInput),
    estimatedCostOutput: roundMoney(summaryRaw.estimatedCostOutput),
    estimatedCostTotal: roundMoney(summaryRaw.estimatedCostTotal),
    currency: "USD"
  }

  const cache = {
    fingerprintHits: summaryRaw.fingerprintHits,
    semanticHits: summaryRaw.semanticHits,
    localHits: summaryRaw.localHits
  }

  const plans = activeSubscriptions.map((subscription) => {
    const effectiveConfig = resolveEffectiveConfig(subscription)

    return {
      apiKeyId: subscription.apiKeyId,
      subscriptionId: subscription.id,
      code: subscription.plan.code,
      name: subscription.plan.name,
      type: subscription.plan.type,
      monthlyPrice: effectiveConfig?.pricing?.totalPrice || null,
      addons: effectiveConfig?.addons || []
    }
  })

  const response = {
    period: {
      startDate: formatDay(period.start),
      endDate: formatDay(period.end)
    },
    plan: plans,
    summary,
    cache,
    breakdowns: {
      byCacheType: {
        llm: summary.requestsSentToLlm,
        fingerprint: cache.fingerprintHits,
        semantic: cache.semanticHits,
        local: cache.localHits
      },
      byProvider: buildGroupedCostMap(usages, "provider"),
      byModel: buildGroupedCostMap(usages, "providerModel"),
      byKeySource: buildGroupedCostMap(usages, "keySource"),
      byScope: buildGroupedCostMap(usages, "scope"),
      byRouteType: buildGroupedCostMap(usages, "routeType"),
      byWorkload: buildGroupedCostMap(usages, "workloadCategory")
    },
    apiKeys: apiKeys.map((item) => ({
      id: item.id,
      createdAt: item.createdAt
    }))
  }

  if (includeDaily === "true") {
    const dailyMap = {}

    for (const item of usages) {
      const dayKey = formatDay(item.createdAt)
      const cacheType = item.cacheType || "llm"

      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = {
          day: dayKey,
          totalRequests: 0,
          requestsSentToLlm: 0,
          requestsServedWithoutLlm: 0,
          inputTokensBeforeOptimization: 0,
          inputTokensSent: 0,
          inputTokensSaved: 0,
          providerInputTokens: 0,
          providerOutputTokens: 0,
          providerTotalTokens: 0,
          estimatedCostTotal: 0
        }
      }

      dailyMap[dayKey].totalRequests += 1
      dailyMap[dayKey].inputTokensBeforeOptimization += item.systemInputTokensOriginal || 0
      dailyMap[dayKey].inputTokensSent += item.systemInputTokensOptimized || 0
      dailyMap[dayKey].providerInputTokens += item.llmInputTokens || 0
      dailyMap[dayKey].providerOutputTokens += item.llmOutputTokens || 0
      dailyMap[dayKey].providerTotalTokens += item.llmTotalTokens || 0
      dailyMap[dayKey].estimatedCostTotal += item.estimatedCostTotal || 0

      if (cacheType === "llm") {
        dailyMap[dayKey].requestsSentToLlm += 1
      } else {
        dailyMap[dayKey].requestsServedWithoutLlm += 1
      }
    }

    response.daily = Object.values(dailyMap).map((item) => ({
      ...item,
      inputTokensSaved: item.inputTokensBeforeOptimization - item.inputTokensSent,
      estimatedCostTotal: roundMoney(item.estimatedCostTotal)
    }))
  }

  return response
}

module.exports = {
  getDashboardOverviewByUser
}