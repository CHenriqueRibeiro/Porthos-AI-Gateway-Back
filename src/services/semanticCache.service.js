const prisma = require("../db/prisma")
const redis = require("../db/redis")
const { generateEmbedding, cosineSimilarity } = require("./embedding.service")
const { createFingerprint } = require("../utils/fingerprint")
const crypto = require("crypto")

function buildQuestionKey(cacheKey, responseFormat = null) {
  if (!responseFormat) {
    return cacheKey
  }

  const signature = crypto
    .createHash("sha256")
    .update(JSON.stringify(responseFormat))
    .digest("hex")

  return `${cacheKey}::${signature}`
}

function buildRedisKey(apiKeyId, fingerprint) {
  return `semantic:${apiKeyId}:${fingerprint}`
}

async function saveSemanticCache(
  apiKeyId,
  cacheKey,
  answer,
  responseFormat = null,
  options = {}
) {
  const questionKey = buildQuestionKey(cacheKey, responseFormat)
  const embedding = await generateEmbedding(questionKey)
  const fingerprint = createFingerprint(questionKey)

  const saved = await prisma.semanticCache.upsert({
    where: {
      apiKeyId_fingerprint: {
        apiKeyId,
        fingerprint
      }
    },
    update: {
      question: questionKey,
      answer,
      embedding
    },
    create: {
      apiKeyId,
      fingerprint,
      question: questionKey,
      answer,
      embedding
    }
  })

  const ttlSeconds = options.ttlSeconds || 24 * 60 * 60

  await redis.set(
    buildRedisKey(apiKeyId, fingerprint),
    JSON.stringify(saved),
    "EX",
    ttlSeconds
  )

  return {
    data: saved,
    source: "postgres",
    fingerprint
  }
}

async function findSemanticMatch(
  apiKeyId,
  cacheKey,
  responseFormat = null,
  threshold = 0.86
) {
  const questionKey = buildQuestionKey(cacheKey, responseFormat)
  const questionEmbedding = await generateEmbedding(questionKey)

  const entries = await prisma.semanticCache.findMany({
    where: {
      apiKeyId
    }
  })

  let bestMatch = null
  let bestScore = 0

  for (const entry of entries) {
    if (!entry.embedding) continue

    const score = cosineSimilarity(questionEmbedding, entry.embedding)

    if (score > bestScore) {
      bestScore = score
      bestMatch = entry
    }
  }

  if (bestMatch && bestScore >= threshold) {
    return {
      match: bestMatch,
      score: bestScore,
      source: "postgres"
    }
  }

  return null
}

async function pruneSemanticCacheByApiKey({
  apiKeyId,
  maxRecords = 10000
}) {
  const items = await prisma.semanticCache.findMany({
    where: { apiKeyId },
    orderBy: {
      updatedAt: "desc"
    }
  })

  if (items.length > maxRecords) {
    const toDelete = items.slice(maxRecords)

    await prisma.semanticCache.deleteMany({
      where: {
        id: {
          in: toDelete.map((item) => item.id)
        }
      }
    })
  }
}

module.exports = {
  saveSemanticCache,
  findSemanticMatch,
  pruneSemanticCacheByApiKey
}