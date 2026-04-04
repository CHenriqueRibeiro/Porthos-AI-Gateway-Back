const redis = require("../db/redis")
const crypto = require("crypto")

function buildResponseFormatSignature(responseFormat = null) {
  if (!responseFormat) return "no_format"

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(responseFormat))
    .digest("hex")
}

function buildFingerprint(cacheKey, responseFormat = null) {
  return crypto
    .createHash("sha256")
    .update(`${String(cacheKey)}::${buildResponseFormatSignature(responseFormat)}`)
    .digest("hex")
}

function buildRedisKey(apiKeyId, fingerprint) {
  return `fingerprint:${apiKeyId}:${fingerprint}`
}

async function findCachedAnswer(apiKeyId, cacheKey, responseFormat = null) {
  const fingerprint = buildFingerprint(cacheKey, responseFormat)
  const key = buildRedisKey(apiKeyId, fingerprint)

  const cached = await redis.get(key)

  if (!cached) {
    return null
  }

  return {
    data: JSON.parse(cached),
    source: "redis",
    fingerprint
  }
}

async function saveCachedAnswer(
  apiKeyId,
  cacheKey,
  answer,
  responseFormat = null,
  options = {}
) {
  const fingerprint = buildFingerprint(cacheKey, responseFormat)
  const key = buildRedisKey(apiKeyId, fingerprint)
  const ttlSeconds = options.ttlSeconds || 24 * 60 * 60

  const payload = {
    answer
  }

  await redis.set(key, JSON.stringify(payload), "EX", ttlSeconds)

  return {
    data: payload,
    source: "redis",
    fingerprint
  }
}

module.exports = {
  findCachedAnswer,
  saveCachedAnswer
}