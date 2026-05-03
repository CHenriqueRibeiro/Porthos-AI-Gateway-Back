const redis = require("../db/redis")
const crypto = require("crypto")

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildKey(type, apiKeyId) {
  return `concurrency:${type}:${apiKeyId}`
}

function buildRequestId() {
  return crypto.randomUUID()
}

async function getCounter(key) {
  const value = await redis.get(key)
  return Number(value || 0)
}

async function tryAcquireSlot({
  apiKeyId,
  workloadLevel,
  concurrencyPolicy
}) {
  const totalKey = buildKey("total", apiKeyId)
  const heavyKey = buildKey("heavy", apiKeyId)

  const currentTotal = await getCounter(totalKey)
  const currentHeavy = await getCounter(heavyKey)

  const willUseHeavySlot = workloadLevel === "heavy"

  if (currentTotal >= concurrencyPolicy.maxConcurrentTotal) {
    return {
      acquired: false,
      reason: "total_limit"
    }
  }

  if (willUseHeavySlot && currentHeavy >= concurrencyPolicy.maxConcurrentHeavy) {
    return {
      acquired: false,
      reason: "heavy_limit"
    }
  }

  const requestId = buildRequestId()

  const nextTotal = await redis.incr(totalKey)
  if (nextTotal === 1) {
    await redis.expire(totalKey, concurrencyPolicy.lockTtlSeconds)
  }

  let heavyIncremented = false

  if (willUseHeavySlot) {
    const nextHeavy = await redis.incr(heavyKey)
    heavyIncremented = true

    if (nextHeavy === 1) {
      await redis.expire(heavyKey, concurrencyPolicy.lockTtlSeconds)
    }

    if (nextHeavy > concurrencyPolicy.maxConcurrentHeavy) {
      await redis.decr(totalKey)
      await redis.decr(heavyKey)

      return {
        acquired: false,
        reason: "heavy_limit"
      }
    }
  }

  if (nextTotal > concurrencyPolicy.maxConcurrentTotal) {
    await redis.decr(totalKey)

    if (heavyIncremented) {
      await redis.decr(heavyKey)
    }

    return {
      acquired: false,
      reason: "total_limit"
    }
  }

  return {
    acquired: true,
    requestId,
    totalKey,
    heavyKey,
    usesHeavySlot: willUseHeavySlot
  }
}

async function acquireConcurrencySlot({
  apiKeyId,
  workloadLevel,
  concurrencyPolicy
}) {
  const queueWaitMs =
    workloadLevel === "heavy"
      ? concurrencyPolicy.heavyQueueWaitMs
      : concurrencyPolicy.lightQueueWaitMs

  const startedAt = Date.now()
  let lastFailureReason = null

  while (Date.now() - startedAt <= queueWaitMs) {
    const attempt = await tryAcquireSlot({
      apiKeyId,
      workloadLevel,
      concurrencyPolicy
    })

    if (attempt.acquired) {
      return {
        ...attempt,
        waitedMs: Date.now() - startedAt
      }
    }

    lastFailureReason = attempt.reason
    await sleep(150)
  }

  return {
    acquired: false,
    reason: lastFailureReason || "queue_timeout",
    waitedMs: Date.now() - startedAt
  }
}

async function releaseConcurrencySlot(lock) {
  if (!lock || !lock.acquired) return

  try {
    if (lock.totalKey) {
      const total = await redis.decr(lock.totalKey)
      if (total < 0) {
        await redis.set(lock.totalKey, "0", "EX", 5)
      }
    }

    if (lock.usesHeavySlot && lock.heavyKey) {
      const heavy = await redis.decr(lock.heavyKey)
      if (heavy < 0) {
        await redis.set(lock.heavyKey, "0", "EX", 5)
      }
    }
  } catch (error) {
    console.error("[CONCURRENCY] erro ao liberar slot:", error.message)
  }
}

module.exports = {
  acquireConcurrencySlot,
  releaseConcurrencySlot
}