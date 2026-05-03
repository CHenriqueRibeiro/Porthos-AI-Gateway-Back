const prisma = require("../db/prisma")
const subscriptionService = require("./subscription.service")
const tokenUsageService = require("./tokenUsage.service")
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
        cachedInputTokensAvoided: 0,
        cachedOutputTokensAvoided: 0,
        cachedTotalTokensAvoided: 0,
        estimatedCostInput: 0,
        estimatedCostOutput: 0,
        estimatedCostTotal: 0,
        estimatedCostAvoided: 0
      }
    }

    result[key].totalRequests += 1

    result[key].providerInputTokens += item.llmInputTokens || 0
    result[key].providerOutputTokens += item.llmOutputTokens || 0
    result[key].providerTotalTokens += item.llmTotalTokens || 0

    result[key].cachedInputTokensAvoided += item.cacheReferenceInputTokens || 0
    result[key].cachedOutputTokensAvoided += item.cacheReferenceOutputTokens || 0
    result[key].cachedTotalTokensAvoided += item.cacheReferenceTotalTokens || 0

    result[key].estimatedCostInput += item.estimatedCostInput || 0
    result[key].estimatedCostOutput += item.estimatedCostOutput || 0
    result[key].estimatedCostTotal += item.estimatedCostTotal || 0
    result[key].estimatedCostAvoided += item.estimatedCostAvoided || 0
  }

  return Object.values(result).map((item) => ({
    ...item,
    estimatedCostInput: roundMoney(item.estimatedCostInput),
    estimatedCostOutput: roundMoney(item.estimatedCostOutput),
    estimatedCostTotal: roundMoney(item.estimatedCostTotal),
    estimatedCostAvoided: roundMoney(item.estimatedCostAvoided)
  }))
}

async function getUsageByApiKey(apiKeyId, filters = {}) {
  const { day, startDate, endDate, includeDaily = "false" } = filters

  let period

  if (day) {
    period = getDayPeriod(day)
  } else if (startDate && endDate) {
    period = getCustomPeriod(startDate, endDate)
  } else {
    period = getDefaultPeriod()
  }

  const usages = await tokenUsageService.findTokenUsageByApiKey({
    apiKeyId,
    start: period.start,
    end: period.end
  })

  const activeSubscription =
    await subscriptionService.getActiveSubscriptionByApiKeyId(apiKeyId)

  const effectiveConfig = resolveEffectiveConfig(activeSubscription)

  const summaryRaw = usages.reduce(
    (acc, item) => {
      const cacheType = item.cacheType || "llm"

      acc.totalRequests += 1

      // Gateway/internal
      acc.gatewayInputTokensOriginal += item.systemInputTokensOriginal || 0
      acc.gatewayInputTokensOptimized += item.systemInputTokensOptimized || 0
      acc.gatewayResponseTokens += item.systemResponseTokens || 0

      // Provider real
      acc.providerInputTokens += item.llmInputTokens || 0
      acc.providerOutputTokens += item.llmOutputTokens || 0
      acc.providerTotalTokens += item.llmTotalTokens || 0

      // Cache avoided based on original real request
      acc.cachedInputTokensAvoided += item.cacheReferenceInputTokens || 0
      acc.cachedOutputTokensAvoided += item.cacheReferenceOutputTokens || 0
      acc.cachedTotalTokensAvoided += item.cacheReferenceTotalTokens || 0

      // Cost
      acc.estimatedCostInput += item.estimatedCostInput || 0
      acc.estimatedCostOutput += item.estimatedCostOutput || 0
      acc.estimatedCostTotal += item.estimatedCostTotal || 0
      acc.estimatedCostAvoided += item.estimatedCostAvoided || 0

      if (cacheType === "fingerprint") acc.fingerprintHits += 1
      if (cacheType === "semantic") acc.semanticHits += 1
      if (cacheType === "llm") acc.requestsSentToLlm += 1
      if (cacheType === "local" || cacheType === "document_memory") acc.localHits += 1

      return acc
    },
    {
      totalRequests: 0,

      gatewayInputTokensOriginal: 0,
      gatewayInputTokensOptimized: 0,
      gatewayResponseTokens: 0,

      providerInputTokens: 0,
      providerOutputTokens: 0,
      providerTotalTokens: 0,

      cachedInputTokensAvoided: 0,
      cachedOutputTokensAvoided: 0,
      cachedTotalTokensAvoided: 0,

      estimatedCostInput: 0,
      estimatedCostOutput: 0,
      estimatedCostTotal: 0,
      estimatedCostAvoided: 0,

      currency: "USD",
      fingerprintHits: 0,
      semanticHits: 0,
      localHits: 0,
      requestsSentToLlm: 0
    }
  )

  const requestsServedWithoutLlm =
    summaryRaw.fingerprintHits + summaryRaw.semanticHits + summaryRaw.localHits

  const realInputTokensBeforeOptimization =
    summaryRaw.providerInputTokens + summaryRaw.cachedInputTokensAvoided

  const realOutputTokensReturnedByGateway =
    summaryRaw.providerOutputTokens + summaryRaw.cachedOutputTokensAvoided

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

    // Mantidos com os mesmos nomes para o front
    // Agora representam dados reais:
    // - inputTokensBeforeOptimization = tokens reais que seriam gastos sem cache
    // - inputTokensSent = tokens reais realmente enviados à LLM
    // - inputTokensSaved = tokens reais evitados por cache/memória
    inputTokensBeforeOptimization: realInputTokensBeforeOptimization,
    inputTokensSent: summaryRaw.providerInputTokens,
    inputTokensSaved: summaryRaw.cachedInputTokensAvoided,

    // Mantido com o mesmo nome para o front
    // Agora representa saída real entregue pelo gateway
    outputTokensReturnedByGateway: realOutputTokensReturnedByGateway,

    providerInputTokens: summaryRaw.providerInputTokens,
    providerOutputTokens: summaryRaw.providerOutputTokens,
    providerTotalTokens: summaryRaw.providerTotalTokens,

    cachedInputTokensAvoided: summaryRaw.cachedInputTokensAvoided,
    cachedOutputTokensAvoided: summaryRaw.cachedOutputTokensAvoided,
    cachedTotalTokensAvoided: summaryRaw.cachedTotalTokensAvoided,

    gatewayInputTokensOriginal: summaryRaw.gatewayInputTokensOriginal,
    gatewayInputTokensOptimized: summaryRaw.gatewayInputTokensOptimized,
    gatewayInputTokensSaved: Math.max(
      0,
      summaryRaw.gatewayInputTokensOriginal - summaryRaw.gatewayInputTokensOptimized
    ),
    gatewayResponseTokens: summaryRaw.gatewayResponseTokens,

    estimatedCostInput: roundMoney(summaryRaw.estimatedCostInput),
    estimatedCostOutput: roundMoney(summaryRaw.estimatedCostOutput),
    estimatedCostTotal: roundMoney(summaryRaw.estimatedCostTotal),
    estimatedCostAvoided: roundMoney(summaryRaw.estimatedCostAvoided),
    currency: "USD"
  }

  const cache = {
    fingerprintHits: summaryRaw.fingerprintHits,
    semanticHits: summaryRaw.semanticHits,
    localHits: summaryRaw.localHits
  }

  const response = {
    period: {
      startDate: formatDay(period.start),
      endDate: formatDay(period.end)
    },
    plan: activeSubscription
      ? {
          code: activeSubscription.plan.code,
          name: activeSubscription.plan.name,
          type: activeSubscription.plan.type,
          monthlyPrice: effectiveConfig?.pricing?.totalPrice || null,
          addons: effectiveConfig?.addons || []
        }
      : null,
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
    }
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

          // Mantidos para o front
          inputTokensBeforeOptimization: 0,
          inputTokensSent: 0,
          inputTokensSaved: 0,
          outputTokensReturnedByGateway: 0,

          providerInputTokens: 0,
          providerOutputTokens: 0,
          providerTotalTokens: 0,

          cachedInputTokensAvoided: 0,
          cachedOutputTokensAvoided: 0,
          cachedTotalTokensAvoided: 0,

          gatewayInputTokensOriginal: 0,
          gatewayInputTokensOptimized: 0,
          gatewayInputTokensSaved: 0,
          gatewayResponseTokens: 0,

          estimatedCostTotal: 0,
          estimatedCostAvoided: 0
        }
      }

      dailyMap[dayKey].totalRequests += 1

      dailyMap[dayKey].gatewayInputTokensOriginal += item.systemInputTokensOriginal || 0
      dailyMap[dayKey].gatewayInputTokensOptimized += item.systemInputTokensOptimized || 0
      dailyMap[dayKey].gatewayResponseTokens += item.systemResponseTokens || 0

      dailyMap[dayKey].providerInputTokens += item.llmInputTokens || 0
      dailyMap[dayKey].providerOutputTokens += item.llmOutputTokens || 0
      dailyMap[dayKey].providerTotalTokens += item.llmTotalTokens || 0

      dailyMap[dayKey].cachedInputTokensAvoided += item.cacheReferenceInputTokens || 0
      dailyMap[dayKey].cachedOutputTokensAvoided += item.cacheReferenceOutputTokens || 0
      dailyMap[dayKey].cachedTotalTokensAvoided += item.cacheReferenceTotalTokens || 0

      dailyMap[dayKey].estimatedCostTotal += item.estimatedCostTotal || 0
      dailyMap[dayKey].estimatedCostAvoided += item.estimatedCostAvoided || 0

      if (cacheType === "llm") {
        dailyMap[dayKey].requestsSentToLlm += 1
      } else {
        dailyMap[dayKey].requestsServedWithoutLlm += 1
      }
    }

    response.daily = Object.values(dailyMap).map((item) => {
      const inputTokensBeforeOptimization =
        item.providerInputTokens + item.cachedInputTokensAvoided

      const inputTokensSent = item.providerInputTokens
      const inputTokensSaved = item.cachedInputTokensAvoided

      const outputTokensReturnedByGateway =
        item.providerOutputTokens + item.cachedOutputTokensAvoided

      return {
        ...item,
        inputTokensBeforeOptimization,
        inputTokensSent,
        inputTokensSaved,
        outputTokensReturnedByGateway,
        gatewayInputTokensSaved: Math.max(
          0,
          item.gatewayInputTokensOriginal - item.gatewayInputTokensOptimized
        ),
        estimatedCostTotal: roundMoney(item.estimatedCostTotal),
        estimatedCostAvoided: roundMoney(item.estimatedCostAvoided)
      }
    })
  }

  return response
}

module.exports = {
  getUsageByApiKey
}
