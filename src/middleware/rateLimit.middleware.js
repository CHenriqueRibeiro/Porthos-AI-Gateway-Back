const redis = require("../db/redis")
const { getRuntimePolicyForApiKey } = require("../services/subscriptionRuntime.service")

function buildRateLimitKey(apiKeyId, routeKey, bucket) {
  return `ratelimit:${apiKeyId}:${routeKey}:${bucket}`
}

async function incrementWindowCounter({
  apiKeyId,
  routeKey,
  perMinute,
  windowSeconds
}) {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000))
  const redisKey = buildRateLimitKey(apiKeyId, routeKey, bucket)

  const currentValue = await redis.incr(redisKey)

  if (currentValue === 1) {
    await redis.expire(redisKey, windowSeconds + 5)
  }

  const remaining = Math.max(0, perMinute - currentValue)

  return {
    currentValue,
    remaining,
    bucket,
    redisKey
  }
}

async function rateLimitByApiKey(request, reply) {
  const apiKeyRecord = request.apiKeyRecord

  if (!apiKeyRecord) {
    return reply.code(401).send({
      error: "Contexto da chave gateway não resolvido",
      hint: "Envie JWT válido e sessionId no corpo; a sessão deve pertencer ao seu usuário."
    })
  }

  const { runtimePolicy, effectiveConfig } = await getRuntimePolicyForApiKey(apiKeyRecord.id)
  const routeKey = request.routerPath || request.url || "unknown"
  const { perMinute, windowSeconds } = runtimePolicy.rateLimit

  request.apiKeyRecord = apiKeyRecord
  request.runtimePolicy = runtimePolicy
  request.effectiveConfig = effectiveConfig

  const result = await incrementWindowCounter({
    apiKeyId: apiKeyRecord.id,
    routeKey,
    perMinute,
    windowSeconds
  })

  reply.header("X-RateLimit-Limit", String(perMinute))
  reply.header("X-RateLimit-Remaining", String(result.remaining))
  reply.header("X-RateLimit-Window-Seconds", String(windowSeconds))

  if (result.currentValue > perMinute) {
    return reply.code(429).send({
      error: "Limite temporário de uso atingido. Tente novamente em instantes."
    })
  }
}

module.exports = {
  rateLimitByApiKey
}