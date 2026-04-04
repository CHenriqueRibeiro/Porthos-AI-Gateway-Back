const redis = require("../db/redis")
const apiKeyService = require("../services/apiKey.service")
const { getRuntimePolicyForApiKey } = require("../services/subscriptionRuntime.service")
const { classifyWorkload } = require("../services/requestWorkload.service")

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildConcurrencyRedisKey(apiKeyId, category) {
  return `concurrency:${apiKeyId}:${category}`
}

function getMaxInFlightByCategory(runtimePolicy, category) {
  if (category === "heavy") {
    return runtimePolicy.concurrency.heavyMaxInFlight
  }

  if (category === "medium") {
    return runtimePolicy.concurrency.mediumMaxInFlight
  }

  return runtimePolicy.concurrency.lightMaxInFlight
}

async function getOrLoadRuntime(request) {
  if (request.apiKeyRecord && request.runtimePolicy) {
    return {
      apiKeyRecord: request.apiKeyRecord,
      runtimePolicy: request.runtimePolicy,
      effectiveConfig: request.effectiveConfig || null
    }
  }

  const apiKey = request.headers["x-api-key"]

  if (!apiKey) {
    throw new Error("API key obrigatória")
  }

  const apiKeyRecord = await apiKeyService.findApiKeyByKey(apiKey)

  if (!apiKeyRecord) {
    throw new Error("API key inválida")
  }

  const { runtimePolicy, effectiveConfig } =
    await getRuntimePolicyForApiKey(apiKeyRecord.id)

  request.apiKeyRecord = apiKeyRecord
  request.runtimePolicy = runtimePolicy
  request.effectiveConfig = effectiveConfig

  return {
    apiKeyRecord,
    runtimePolicy,
    effectiveConfig
  }
}

async function tryAcquireSlot({
  apiKeyId,
  category,
  maxInFlight
}) {
  const redisKey = buildConcurrencyRedisKey(apiKeyId, category)
  const current = Number((await redis.get(redisKey)) || 0)

  if (current >= maxInFlight) {
    return {
      acquired: false,
      current,
      redisKey
    }
  }

  const next = await redis.incr(redisKey)

  if (next === 1) {
    await redis.expire(redisKey, 120)
  }

  if (next > maxInFlight) {
    await redis.decr(redisKey)

    return {
      acquired: false,
      current: next - 1,
      redisKey
    }
  }

  return {
    acquired: true,
    current: next,
    redisKey
  }
}

async function releaseSlot({
  apiKeyId,
  category
}) {
  const redisKey = buildConcurrencyRedisKey(apiKeyId, category)
  const exists = await redis.exists(redisKey)

  if (!exists) return

  const next = await redis.decr(redisKey)

  if (next <= 0) {
    await redis.del(redisKey)
  }
}

function attachReleaseOnReply({
  request,
  reply,
  apiKeyId,
  category
}) {
  let released = false

  const finalize = async () => {
    if (released) return
    released = true

    try {
      await releaseSlot({
        apiKeyId,
        category
      })
    } catch (error) {
      console.error("[CONCURRENCY] erro ao liberar slot:", error.message)
    }
  }

  reply.raw.on("finish", finalize)
  reply.raw.on("close", finalize)

  request.releaseConcurrencySlot = finalize
}

async function waitForHeavySlot({
  apiKeyId,
  category,
  maxInFlight,
  waitMs,
  pollIntervalMs
}) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < waitMs) {
    const attempt = await tryAcquireSlot({
      apiKeyId,
      category,
      maxInFlight
    })

    if (attempt.acquired) {
      return attempt
    }

    await sleep(pollIntervalMs)
  }

  return {
    acquired: false
  }
}

async function concurrencyGuard(request, reply) {
  try {
    const { apiKeyRecord, runtimePolicy } = await getOrLoadRuntime(request)

    const workload = classifyWorkload({
      routeKey: request.routerPath || request.url || "",
      body: request.body || {}
    })

    const category = workload.category
    const maxInFlight = getMaxInFlightByCategory(runtimePolicy, category)

    reply.header("X-Workload-Category", category)
    reply.header("X-Concurrency-Limit", String(maxInFlight))

    let result = null

    if (category === "heavy") {
      result = await waitForHeavySlot({
        apiKeyId: apiKeyRecord.id,
        category,
        maxInFlight,
        waitMs: runtimePolicy.concurrency.heavyQueueWaitMs,
        pollIntervalMs: runtimePolicy.concurrency.pollIntervalMs
      })
    } else {
      result = await tryAcquireSlot({
        apiKeyId: apiKeyRecord.id,
        category,
        maxInFlight
      })
    }

    if (!result?.acquired) {
      return reply.code(429).send({
        error: "Capacidade temporariamente ocupada. Tente novamente em instantes."
      })
    }

    request.workload = workload
    attachReleaseOnReply({
      request,
      reply,
      apiKeyId: apiKeyRecord.id,
      category
    })
  } catch (error) {
    console.error("[CONCURRENCY] erro:", error.message)

    if (
      error.message === "API key obrigatória" ||
      error.message === "API key inválida"
    ) {
      return reply.code(401).send({
        error: error.message
      })
    }

    return reply.code(500).send({
      error: "Erro ao controlar concorrência",
      details: error.message
    })
  }
}

module.exports = {
  concurrencyGuard
}