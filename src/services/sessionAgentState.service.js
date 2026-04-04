const redis = require("../db/redis")

function buildSystemSignatureKey(sessionId) {
  return `session:system-signature:${sessionId}`
}

async function ensureSessionSystemSignature({
  sessionId,
  systemSignature
}) {
  const redisKey = buildSystemSignatureKey(sessionId)
  const current = await redis.get(redisKey)

  if (!current) {
    await redis.set(redisKey, systemSignature, "EX", 60 * 60 * 24 * 30)

    return {
      changed: false,
      previous: null,
      current: systemSignature
    }
  }

  if (current !== systemSignature) {
    await redis.set(redisKey, systemSignature, "EX", 60 * 60 * 24 * 30)

    return {
      changed: true,
      previous: current,
      current: systemSignature
    }
  }

  return {
    changed: false,
    previous: current,
    current: systemSignature
  }
}

module.exports = {
  ensureSessionSystemSignature
}