const crypto = require("crypto")
const prisma = require("../db/prisma")
const { schemaSql } = require("./tenantSchema.service")
const { getTenantSchemaBySessionId } = require("./tenantData.service")
const {
  buildDocumentFingerprint
} = require("./documentFingerprint.service")

function mapDocumentMemory(row = {}) {
  if (!row) return null

  return {
    id: row.id,
    sessionId: row.sessionId,
    extractionProfile: row.extractionProfile,
    schemaSignature: row.schemaSignature,
    documentFingerprint: row.documentFingerprint,
    contentHash: row.contentHash,
    rawContent: row.rawContent,
    normalizedContent: row.normalizedContent,
    blocks: row.blocks,
    extractedData: row.extractedData,
    confidenceData: row.confidenceData,
    provenanceData: row.provenanceData,
    llmUsed: row.llmUsed,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

async function findExactDocumentMemory({
  sessionId,
  text,
  extractionProfile = "generic_document",
  responseFormat = null
}) {
  const fingerprintData = buildDocumentFingerprint({
    text,
    extractionProfile,
    responseFormat
  })

  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) {
    return {
      found: null,
      fingerprintData
    }
  }

  const schema = schemaSql(schemaName)
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      session_id AS "sessionId",
      extraction_profile AS "extractionProfile",
      schema_signature AS "schemaSignature",
      document_fingerprint AS "documentFingerprint",
      content_hash AS "contentHash",
      raw_content AS "rawContent",
      normalized_content AS "normalizedContent",
      blocks,
      extracted_data AS "extractedData",
      confidence_data AS "confidenceData",
      provenance_data AS "provenanceData",
      llm_used AS "llmUsed",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM ${schema}.document_memories
    WHERE session_id = ${sessionId}
      AND extraction_profile = ${extractionProfile}
      AND schema_signature = ${fingerprintData.schemaSignature}
      AND document_fingerprint = ${fingerprintData.documentFingerprint}
    LIMIT 1
  `

  return {
    found: mapDocumentMemory(rows[0]),
    fingerprintData
  }
}

async function findLatestDocumentMemoryByProfile({
  sessionId,
  extractionProfile = "generic_document"
}) {
  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) return null

  const schema = schemaSql(schemaName)
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      session_id AS "sessionId",
      extraction_profile AS "extractionProfile",
      schema_signature AS "schemaSignature",
      document_fingerprint AS "documentFingerprint",
      content_hash AS "contentHash",
      raw_content AS "rawContent",
      normalized_content AS "normalizedContent",
      blocks,
      extracted_data AS "extractedData",
      confidence_data AS "confidenceData",
      provenance_data AS "provenanceData",
      llm_used AS "llmUsed",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM ${schema}.document_memories
    WHERE session_id = ${sessionId}
      AND extraction_profile = ${extractionProfile}
    ORDER BY updated_at DESC
    LIMIT 1
  `

  return mapDocumentMemory(rows[0])
}

async function pruneDocumentMemory({
  sessionId,
  extractionProfile = "generic_document",
  retentionDays = 30,
  maxItemsPerProfile = 500
}) {
  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) return

  const schema = schemaSql(schemaName)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  await prisma.$executeRaw`
    DELETE FROM ${schema}.document_memories
    WHERE session_id = ${sessionId}
      AND extraction_profile = ${extractionProfile}
      AND updated_at < ${cutoff}
  `

  const items = await prisma.$queryRaw`
    SELECT id
    FROM ${schema}.document_memories
    WHERE session_id = ${sessionId}
      AND extraction_profile = ${extractionProfile}
    ORDER BY updated_at DESC
  `

  if (items.length > maxItemsPerProfile) {
    const ids = items.slice(maxItemsPerProfile).map((item) => item.id)
    await prisma.$executeRaw`
      DELETE FROM ${schema}.document_memories
      WHERE id = ANY(${ids})
    `
  }
}

async function saveDocumentMemory({
  sessionId,
  text,
  normalizedContent,
  extractionProfile = "generic_document",
  responseFormat = null,
  blocks = [],
  data = {},
  confidence = {},
  provenance = {},
  llmUsed = false,
  retentionDays = 30,
  maxItemsPerProfile = 500
}) {
  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) return null

  const schema = schemaSql(schemaName)
  const fingerprintData = buildDocumentFingerprint({
    text: normalizedContent || text,
    extractionProfile,
    responseFormat
  })

  const rows = await prisma.$queryRaw`
    INSERT INTO ${schema}.document_memories (
      id,
      session_id,
      extraction_profile,
      schema_signature,
      document_fingerprint,
      content_hash,
      raw_content,
      normalized_content,
      blocks,
      extracted_data,
      confidence_data,
      provenance_data,
      llm_used,
      created_at,
      updated_at
    )
    VALUES (
      ${crypto.randomUUID()},
      ${sessionId},
      ${extractionProfile},
      ${fingerprintData.schemaSignature},
      ${fingerprintData.documentFingerprint},
      ${fingerprintData.contentHash},
      ${text},
      ${normalizedContent || text},
      ${JSON.stringify(blocks)}::jsonb,
      ${JSON.stringify(data)}::jsonb,
      ${JSON.stringify(confidence)}::jsonb,
      ${JSON.stringify(provenance)}::jsonb,
      ${llmUsed},
      NOW(),
      NOW()
    )
    ON CONFLICT (session_id, extraction_profile, schema_signature, document_fingerprint)
    DO UPDATE SET
      raw_content = EXCLUDED.raw_content,
      normalized_content = EXCLUDED.normalized_content,
      blocks = EXCLUDED.blocks,
      extracted_data = EXCLUDED.extracted_data,
      confidence_data = EXCLUDED.confidence_data,
      provenance_data = EXCLUDED.provenance_data,
      llm_used = EXCLUDED.llm_used,
      updated_at = NOW()
    RETURNING
      id,
      session_id AS "sessionId",
      extraction_profile AS "extractionProfile",
      schema_signature AS "schemaSignature",
      document_fingerprint AS "documentFingerprint",
      content_hash AS "contentHash",
      raw_content AS "rawContent",
      normalized_content AS "normalizedContent",
      blocks,
      extracted_data AS "extractedData",
      confidence_data AS "confidenceData",
      provenance_data AS "provenanceData",
      llm_used AS "llmUsed",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `

  await pruneDocumentMemory({
    sessionId,
    extractionProfile,
    retentionDays,
    maxItemsPerProfile
  })

  return mapDocumentMemory(rows[0])
}

module.exports = {
  findExactDocumentMemory,
  findLatestDocumentMemoryByProfile,
  saveDocumentMemory
}
