const crypto = require("crypto")
const prisma = require("../db/prisma")
const { schemaSql } = require("./tenantSchema.service")
const { getTenantSchemaByApiKeyId } = require("./tenantData.service")
const { hashText, hashBlock } = require("./documentFingerprint.service")
const { estimateTokens } = require("../utils/tokenCounter")
const { saveDocumentChunks } = require("./documentChunk.service")

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json"
])
const ALLOWED_MIME_TYPES = new Set([
  ...TEXT_MIME_TYPES,
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/m4a"
])

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex")
}

function normalizeMimeType(value = "") {
  return String(value || "").split(";")[0].trim().toLowerCase()
}

function inferFileType(mimeType = "") {
  if (TEXT_MIME_TYPES.has(mimeType)) return "text"
  if (mimeType === "application/pdf") return "pdf"
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("audio/")) return "audio"
  return "unknown"
}

function decodeBase64Data(data = "") {
  const raw = String(data || "")
  const base64 = raw.includes(",") ? raw.split(",").pop() : raw

  if (!base64.trim()) return Buffer.alloc(0)

  return Buffer.from(base64, "base64")
}

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function splitIntoBlocks(text = "") {
  const normalized = normalizeText(text)

  if (!normalized) return []

  const paragraphs = normalized
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean)

  const blocks = []
  let current = ""

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length > 1200 && current) {
      blocks.push(current)
      current = paragraph
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph
    }
  }

  if (current) blocks.push(current)

  return blocks.map((block, index) => ({
    index,
    hash: hashBlock(block),
    text: block,
    tokenEstimate: estimateTokens(block)
  }))
}

function extractAttachmentText(attachment, buffer, mimeType) {
  const explicitText =
    attachment.extractedText ||
    attachment.text ||
    attachment.content ||
    null

  if (typeof explicitText === "string" && explicitText.trim()) {
    return normalizeText(explicitText)
  }

  if (TEXT_MIME_TYPES.has(mimeType) && buffer.length > 0) {
    return normalizeText(buffer.toString("utf8"))
  }

  return ""
}

function validateAttachment(attachment, index) {
  if (!attachment || typeof attachment !== "object") {
    throw new Error(`Attachment ${index + 1} invalido`)
  }

  const mimeType = normalizeMimeType(attachment.mimeType || attachment.mime_type)

  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Tipo de arquivo nao suportado: ${mimeType || "desconhecido"}`)
  }

  const buffer = attachment.data ? decodeBase64Data(attachment.data) : Buffer.alloc(0)
  const text = extractAttachmentText(attachment, buffer, mimeType)
  const sizeBytes = Number(attachment.sizeBytes || attachment.size_bytes || buffer.length || Buffer.byteLength(text))

  const fileType = inferFileType(mimeType)

  if (!text && fileType !== "text") {
    throw new Error(
      `Arquivo ${mimeType} recebido, mas ainda precisa de extractedText/text para entrar no fluxo de cache textual`
    )
  }

  return {
    filename: String(attachment.filename || attachment.name || `attachment-${index + 1}`).slice(0, 180),
    mimeType,
    fileType,
    buffer,
    text,
    sizeBytes
  }
}

function enforceAttachmentPolicy({ attachmentPolicy, normalized }) {
  const policy = attachmentPolicy || {}

  if (policy.enabled !== true) {
    throw new Error("Anexos nao estao disponiveis no plano atual")
  }

  const allowedMimeTypes = new Set(policy.allowedMimeTypes || [])

  if (!allowedMimeTypes.has(normalized.mimeType)) {
    throw new Error(`Tipo de arquivo nao liberado no plano atual: ${normalized.mimeType}`)
  }

  if (normalized.sizeBytes > Number(policy.maxBytesPerAttachment || 0)) {
    throw new Error("Arquivo excede o limite de tamanho do plano atual")
  }

  if (normalized.text.length > Number(policy.maxTextCharsPerAttachment || 0)) {
    throw new Error("Texto extraido do arquivo excede o limite do plano atual")
  }
}

function buildAttachmentPromptContext(processed = []) {
  const withText = processed.filter((item) => item.extractedText)

  if (!withText.length) return ""

  const sections = withText.map((item, index) => [
    `Arquivo ${index + 1}: ${item.filename}`,
    `Tipo: ${item.mimeType}`,
    `Hash do conteudo: ${item.contentHash}`,
    "Conteudo extraido:",
    item.extractedText
  ].join("\n"))

  return [
    "Contexto de arquivos anexados pelo usuario.",
    "Use os trechos abaixo como fonte do pedido atual.",
    ...sections
  ].join("\n\n")
}

function appendAttachmentContextToLastUserMessage(messages = [], context = "") {
  if (!context) return messages

  const next = [...messages]

  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index]?.role === "user") {
      next[index] = {
        ...next[index],
        content: `${next[index].content}\n\n${context}`
      }
      return next
    }
  }

  return messages
}

async function upsertProcessedFile({
  apiKeyId,
  sessionId,
  normalized,
  fileHash,
  contentHash,
  blocks,
  reused
}) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  const rows = await prisma.$queryRaw`
    INSERT INTO ${schema}.processed_files (
      id,
      api_key_id,
      session_id,
      file_hash,
      content_hash,
      filename,
      mime_type,
      file_type,
      size_bytes,
      extracted_text,
      block_hashes,
      metadata,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ${crypto.randomUUID()},
      ${apiKeyId},
      ${sessionId},
      ${fileHash},
      ${contentHash},
      ${normalized.filename},
      ${normalized.mimeType},
      ${normalized.fileType},
      ${normalized.sizeBytes},
      ${normalized.text || null},
      ${JSON.stringify(blocks.map((block) => ({
        index: block.index,
        hash: block.hash,
        tokenEstimate: block.tokenEstimate
      })))}::jsonb,
      ${JSON.stringify({ reused })}::jsonb,
      'processed',
      NOW(),
      NOW()
    )
    ON CONFLICT (api_key_id, file_hash)
    DO UPDATE SET
      session_id = EXCLUDED.session_id,
      updated_at = NOW()
    RETURNING
      id,
      file_hash AS "fileHash",
      content_hash AS "contentHash",
      filename,
      mime_type AS "mimeType",
      file_type AS "fileType",
      size_bytes AS "sizeBytes",
      extracted_text AS "extractedText",
      block_hashes AS "blockHashes",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `

  return rows[0]
}

async function ensureProcessedFilesTable(apiKeyId) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS ${schema}.processed_files (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      session_id TEXT,
      file_hash TEXT NOT NULL,
      content_hash TEXT,
      filename TEXT,
      mime_type TEXT NOT NULL,
      file_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      extracted_text TEXT,
      block_hashes JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'processed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (api_key_id, file_hash)
    )
  `

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS processed_files_api_key_content_idx
    ON ${schema}.processed_files (api_key_id, content_hash)
  `
}

async function findProcessedFileByHash({ apiKeyId, fileHash }) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      file_hash AS "fileHash",
      content_hash AS "contentHash",
      filename,
      mime_type AS "mimeType",
      file_type AS "fileType",
      size_bytes AS "sizeBytes",
      extracted_text AS "extractedText",
      block_hashes AS "blockHashes",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM ${schema}.processed_files
    WHERE api_key_id = ${apiKeyId}
      AND file_hash = ${fileHash}
    LIMIT 1
  `

  return rows[0] || null
}

async function getKnownBlockHashes({ apiKeyId, limit = 200 }) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  const rows = await prisma.$queryRaw`
    SELECT block_hashes AS "blockHashes"
    FROM ${schema}.processed_files
    WHERE api_key_id = ${apiKeyId}
      AND block_hashes IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `

  const hashes = new Set()

  for (const row of rows) {
    const blockHashes = Array.isArray(row.blockHashes) ? row.blockHashes : []

    for (const item of blockHashes) {
      if (item?.hash) hashes.add(item.hash)
    }
  }

  return hashes
}

async function processAttachments({
  apiKeyId,
  sessionId,
  attachments = [],
  attachmentPolicy = {}
}) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return {
      items: [],
      promptContext: "",
      totalTextChars: 0,
      totalTokenEstimate: 0,
      reusedCount: 0
    }
  }

  if (attachmentPolicy.enabled !== true) {
    throw new Error("Anexos nao estao disponiveis no plano atual")
  }

  if (attachments.length > Number(attachmentPolicy.maxAttachments || 0)) {
    throw new Error(`Limite de ${attachmentPolicy.maxAttachments || 0} anexos por requisicao excedido`)
  }

  await ensureProcessedFilesTable(apiKeyId)

  const items = []
  const knownBlockHashes = await getKnownBlockHashes({ apiKeyId })

  for (const [index, attachment] of attachments.entries()) {
    const normalized = validateAttachment(attachment, index)
    enforceAttachmentPolicy({
      attachmentPolicy,
      normalized
    })
    const fileHash = normalized.buffer.length > 0
      ? sha256Buffer(normalized.buffer)
      : hashText(`${normalized.filename}:${normalized.mimeType}:${normalized.text}`)
    const contentHash = normalized.text ? hashText(normalized.text) : null
    const existing = await findProcessedFileByHash({ apiKeyId, fileHash })
    const reused = !!existing
    const blocks = normalized.text ? splitIntoBlocks(normalized.text) : []
    const reusedBlockCount = blocks.filter((block) =>
      knownBlockHashes.has(block.hash)
    ).length
    const saved = existing || await upsertProcessedFile({
      apiKeyId,
      sessionId,
      normalized,
      fileHash,
      contentHash,
      blocks,
      reused
    })
    const chunkVectorResult = reused || attachmentPolicy.vectorEnabled !== true
      ? {
          savedCount: 0,
          skippedCount: attachmentPolicy.vectorEnabled === true ? 0 : blocks.length,
          vectorAvailable: null
        }
      : await saveDocumentChunks({
          apiKeyId,
          processedFileId: saved.id,
          contentHash,
          blocks,
          maxChunks: attachmentPolicy.maxVectorChunksPerAttachment
        })

    items.push({
      ...saved,
      fileHash,
      contentHash,
      filename: normalized.filename,
      mimeType: normalized.mimeType,
      fileType: normalized.fileType,
      sizeBytes: normalized.sizeBytes,
      extractedText: existing?.extractedText || normalized.text,
      blockCount: blocks.length || existing?.blockHashes?.length || 0,
      reusedBlockCount,
      vectorChunkCount: chunkVectorResult.savedCount,
      vectorSkippedCount: chunkVectorResult.skippedCount,
      vectorAvailable: chunkVectorResult.vectorAvailable,
      tokenEstimate: blocks.reduce((sum, block) => sum + block.tokenEstimate, 0),
      reused
    })

    for (const block of blocks) {
      knownBlockHashes.add(block.hash)
    }
  }

  const promptContext = buildAttachmentPromptContext(items)

  return {
    items,
    promptContext,
    totalTextChars: items.reduce((sum, item) => sum + String(item.extractedText || "").length, 0),
    totalTokenEstimate: items.reduce((sum, item) => sum + (item.tokenEstimate || 0), 0),
    vectorChunkCount: items.reduce((sum, item) => sum + (item.vectorChunkCount || 0), 0),
    vectorSkippedCount: items.reduce((sum, item) => sum + (item.vectorSkippedCount || 0), 0),
    reusedCount: items.filter((item) => item.reused).length,
    reusedBlockCount: items.reduce((sum, item) => sum + (item.reusedBlockCount || 0), 0)
  }
}

module.exports = {
  processAttachments,
  appendAttachmentContextToLastUserMessage
}
