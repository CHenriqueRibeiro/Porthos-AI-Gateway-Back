const crypto = require("crypto")
const { Prisma } = require("@prisma/client")
const prisma = require("../db/prisma")
const { createFingerprint } = require("../utils/fingerprint")
const {
  ensureTenantSchema,
  schemaSql,
  vectorToSqlLiteral,
  isMissingVectorExtensionError
} = require("./tenantSchema.service")

const DEFAULT_DISTANCE_THRESHOLD = 0.17

function addSeconds(date, seconds) {
  return new Date(date.getTime() + Number(seconds || 0) * 1000)
}

async function saveVectorCache({
  schemaName,
  apiKeyId,
  question,
  answer,
  embedding,
  ttlSeconds
}) {
  await ensureTenantSchema(schemaName, prisma, { requireVector: true })

  const schema = schemaSql(schemaName)
  const fingerprint = createFingerprint(question)
  const id = crypto.randomUUID()
  const expiresAt = addSeconds(new Date(), ttlSeconds || 24 * 60 * 60)
  const vectorLiteral = vectorToSqlLiteral(embedding)
  const answerJson = JSON.stringify(answer)

  await prisma.$executeRaw`
    INSERT INTO ${schema}.cache (
      id,
      api_key_id,
      fingerprint,
      question,
      answer,
      prompt_vector,
      expires_at,
      created_at,
      updated_at
    )
    VALUES (
      ${id},
      ${apiKeyId},
      ${fingerprint},
      ${question},
      ${answerJson}::jsonb,
      ${vectorLiteral}::vector,
      ${expiresAt},
      NOW(),
      NOW()
    )
    ON CONFLICT (api_key_id, fingerprint)
    DO UPDATE SET
      question = EXCLUDED.question,
      answer = EXCLUDED.answer,
      prompt_vector = EXCLUDED.prompt_vector,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
  `

  return {
    id,
    apiKeyId,
    fingerprint,
    question,
    answer,
    expiresAt
  }
}

async function findVectorMatch({
  schemaName,
  apiKeyId,
  embedding,
  distanceThreshold = DEFAULT_DISTANCE_THRESHOLD
}) {
  try {
    await ensureTenantSchema(schemaName, prisma, { requireVector: true })
  } catch (error) {
    if (isMissingVectorExtensionError(error)) {
      return null
    }

    throw error
  }

  const schema = schemaSql(schemaName)
  const vectorLiteral = vectorToSqlLiteral(embedding)

  const rows = await prisma.$queryRaw`
    SELECT
      id,
      api_key_id AS "apiKeyId",
      fingerprint,
      question,
      answer,
      expires_at AS "expiresAt",
      prompt_vector <=> ${vectorLiteral}::vector AS distance
    FROM ${schema}.cache
    WHERE api_key_id = ${apiKeyId}
      AND expires_at > NOW()
    ORDER BY distance ASC
    LIMIT 1
  `

  const match = rows?.[0] || null

  if (!match || Number(match.distance) > distanceThreshold) {
    return null
  }

  return {
    match,
    distance: Number(match.distance),
    score: 1 - Number(match.distance),
    source: "postgres_pgvector"
  }
}

async function pruneExpiredVectorCache(schemaName) {
  try {
    await ensureTenantSchema(schemaName, prisma, { requireVector: true })
  } catch (error) {
    if (isMissingVectorExtensionError(error)) {
      return 0
    }

    throw error
  }

  const schema = schemaSql(schemaName)

  return prisma.$executeRaw`
    DELETE FROM ${schema}.cache
    WHERE expires_at <= NOW()
  `
}

module.exports = {
  DEFAULT_DISTANCE_THRESHOLD,
  saveVectorCache,
  findVectorMatch,
  pruneExpiredVectorCache
}
