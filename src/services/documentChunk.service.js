const crypto = require("crypto")
const prisma = require("../db/prisma")
const { generateEmbedding } = require("./embedding.service")
const { getTenantByApiKeyId } = require("./tenantSchema.service")
const {
  ensureTenantSchema,
  schemaSql,
  vectorToSqlLiteral,
  isMissingVectorExtensionError
} = require("./tenantSchema.service")

const MAX_CHUNKS_PER_REQUEST = 24

async function getSchemaName(apiKeyId) {
  const tenant = await getTenantByApiKeyId(apiKeyId)

  if (!tenant?.schemaName) {
    throw new Error("API key sem tenant vinculado")
  }

  return tenant.schemaName
}

async function ensureDocumentChunksTable(schemaName) {
  try {
    await ensureTenantSchema(schemaName, prisma, { requireVector: true })
    return true
  } catch (error) {
    if (isMissingVectorExtensionError(error)) {
      return false
    }

    throw error
  }
}

async function saveDocumentChunks({
  apiKeyId,
  processedFileId,
  contentHash,
  blocks = [],
  maxChunks = MAX_CHUNKS_PER_REQUEST
}) {
  if (!processedFileId || !contentHash || !Array.isArray(blocks) || blocks.length === 0) {
    return {
      savedCount: 0,
      skippedCount: 0,
      vectorAvailable: false
    }
  }

  const schemaName = await getSchemaName(apiKeyId)
  const vectorAvailable = await ensureDocumentChunksTable(schemaName)

  if (!vectorAvailable) {
    return {
      savedCount: 0,
      skippedCount: blocks.length,
      vectorAvailable: false
    }
  }

  const schema = schemaSql(schemaName)
  let savedCount = 0
  const chunkLimit = Math.max(0, Number(maxChunks || 0))
  let skippedCount = Math.max(0, blocks.length - chunkLimit)

  for (const block of blocks.slice(0, chunkLimit)) {
    const embedding = await generateEmbedding(block.text)
    const vectorLiteral = vectorToSqlLiteral(embedding)

    await prisma.$executeRaw`
      INSERT INTO ${schema}.document_chunks (
        id,
        api_key_id,
        processed_file_id,
        content_hash,
        block_hash,
        chunk_index,
        text,
        token_count,
        embedding,
        created_at,
        updated_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${apiKeyId},
        ${processedFileId},
        ${contentHash},
        ${block.hash},
        ${block.index},
        ${block.text},
        ${block.tokenEstimate || 0},
        ${vectorLiteral}::vector,
        NOW(),
        NOW()
      )
      ON CONFLICT (api_key_id, processed_file_id, block_hash)
      DO UPDATE SET
        text = EXCLUDED.text,
        token_count = EXCLUDED.token_count,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
    `

    savedCount += 1
  }

  return {
    savedCount,
    skippedCount,
    vectorAvailable: true
  }
}

module.exports = {
  saveDocumentChunks
}
