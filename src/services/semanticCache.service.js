const redis = require("../db/redis")
const { generateEmbedding } = require("./embedding.service")
const { createFingerprint } = require("../utils/fingerprint")
const { getTenantByApiKeyId } = require("./tenantSchema.service")
const {
  saveVectorCache,
  findVectorMatch
} = require("./semanticVectorCache.service")
const { assertTenantStorageAvailable } = require("./tenantQuota.service")
const crypto = require("crypto")

function buildQuestionKey(cacheKey, responseFormat = null) {
  const baseText = String(cacheKey || "").trim()

  if (!responseFormat) {
    return baseText
  }

  const signature = crypto
    .createHash("sha256")
    .update(JSON.stringify(responseFormat))
    .digest("hex")

  return `${baseText}::${signature}`
}

function normalizeSemanticText(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bm2\b/g, "2002")
    .replace(/[^\w\s:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
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
  const rawQuestionKey = buildQuestionKey(cacheKey, responseFormat)
  const questionKey = normalizeSemanticText(rawQuestionKey)
  const embedding = await generateEmbedding(questionKey)
  const fingerprint = createFingerprint(questionKey)
  const ttlSeconds = options.ttlSeconds || 24 * 60 * 60
  const semanticTtlSeconds =
    (options.semanticRetentionDays || 1) * 24 * 60 * 60
  const tenant = await getTenantByApiKeyId(apiKeyId)

  if (!tenant?.schemaName) {
    return null
  }

  await assertTenantStorageAvailable(apiKeyId)

  const saved = await saveVectorCache({
    schemaName: tenant.schemaName,
    apiKeyId,
    question: questionKey,
    answer,
    embedding,
    ttlSeconds: semanticTtlSeconds
  })

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
  responseFormat = null
) {
  const rawQuestionKey = buildQuestionKey(cacheKey, responseFormat)
  const questionKey = normalizeSemanticText(rawQuestionKey)
  const questionEmbedding = await generateEmbedding(questionKey)
  const tenant = await getTenantByApiKeyId(apiKeyId)

  if (!tenant?.schemaName) {
    return null
  }

  const vectorMatch = await findVectorMatch({
    schemaName: tenant.schemaName,
    apiKeyId,
    embedding: questionEmbedding
  })

  if (!vectorMatch) {
    return null
  }

  return {
    match: {
      ...vectorMatch.match,
      answer: vectorMatch.match.answer
    },
    score: vectorMatch.score,
    distance: vectorMatch.distance,
    source: vectorMatch.source
  }
}

async function pruneSemanticCacheByApiKey({
  apiKeyId,
  maxRecords = 10000
}) {
  return null
}

module.exports = {
  saveSemanticCache,
  findSemanticMatch,
  pruneSemanticCacheByApiKey
}
