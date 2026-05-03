const crypto = require("crypto")
const prisma = require("../db/prisma")
const { schemaSql } = require("./tenantSchema.service")
const { getTenantSchemaBySessionId } = require("./tenantData.service")

const MEMORY_FIELDS = new Set([
  "nome",
  "nome_cliente",
  "nome_paciente",
  "cpf",
  "cnpj",
  "telefone",
  "email",
  "endereco",
  "endereco_entrega",
  "cidade",
  "bairro",
  "data",
  "data_agendamento",
  "hora",
  "hora_agendamento",
  "protocolo",
  "numero_contrato",
  "numero_pedido"
])

function onlyDigits(value = "") {
  return String(value).replace(/\D+/g, "")
}

function normalizeFieldValue(fieldName, value) {
  if (value === null || value === undefined) return null

  const text = String(value).trim()
  if (!text) return null

  if (["cpf", "cnpj", "telefone"].includes(fieldName)) {
    return onlyDigits(text)
  }

  return text
}

function normalizeMemoryInput(fields = {}) {
  const normalized = {}

  for (const [fieldName, value] of Object.entries(fields)) {
    if (!MEMORY_FIELDS.has(fieldName)) continue

    if (typeof value === "object" && value !== null) continue

    const finalValue = normalizeFieldValue(fieldName, value)

    if (!finalValue) continue

    normalized[fieldName] = finalValue
  }

  return normalized
}

async function pruneSessionFieldMemory({
  sessionId,
  retentionDays = 30,
  maxItems = 500
}) {
  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) return

  const schema = schemaSql(schemaName)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  await prisma.$executeRaw`
    DELETE FROM ${schema}.session_field_memories
    WHERE session_id = ${sessionId}
      AND updated_at < ${cutoff}
  `

  const items = await prisma.$queryRaw`
    SELECT id
    FROM ${schema}.session_field_memories
    WHERE session_id = ${sessionId}
    ORDER BY updated_at DESC
  `

  if (items.length > maxItems) {
    const toDelete = items.slice(maxItems)

    await prisma.$executeRaw`
      DELETE FROM ${schema}.session_field_memories
      WHERE id = ANY(${toDelete.map((item) => item.id)})
    `
  }
}

async function getSessionFieldMemory(sessionId) {
  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) return {}

  const schema = schemaSql(schemaName)
  const items = await prisma.$queryRaw`
    SELECT
      field_name AS "fieldName",
      field_value AS "fieldValue",
      source,
      confidence
    FROM ${schema}.session_field_memories
    WHERE session_id = ${sessionId}
  `

  const map = {}

  for (const item of items) {
    map[item.fieldName] = {
      value: item.fieldValue,
      source: item.source || "session_memory",
      confidence: item.confidence || 0.85
    }
  }

  return map
}

async function upsertSessionFieldMemory({
  sessionId,
  fields,
  source = "unknown",
  defaultConfidence = 0.9,
  retentionDays = 30,
  maxItems = 500
}) {
  const normalized = normalizeMemoryInput(fields)
  const entries = Object.entries(normalized)
  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) return normalized

  const schema = schemaSql(schemaName)

  for (const [fieldName, fieldValue] of entries) {
    await prisma.$executeRaw`
      INSERT INTO ${schema}.session_field_memories (
        id,
        session_id,
        field_name,
        field_value,
        source,
        confidence,
        created_at,
        updated_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${sessionId},
        ${fieldName},
        ${fieldValue},
        ${source},
        ${defaultConfidence},
        NOW(),
        NOW()
      )
      ON CONFLICT (session_id, field_name)
      DO UPDATE SET
        field_value = EXCLUDED.field_value,
        source = EXCLUDED.source,
        confidence = EXCLUDED.confidence,
        updated_at = NOW()
    `
  }

  await pruneSessionFieldMemory({
    sessionId,
    retentionDays,
    maxItems
  })

  return normalized
}

function applySessionMemoryToExtraction(localExtraction, sessionMemory = {}) {
  const merged = {
    ...localExtraction,
    data: { ...localExtraction.data },
    confidence: { ...localExtraction.confidence },
    provenance: { ...localExtraction.provenance }
  }

  for (const [fieldName, value] of Object.entries(merged.data)) {
    if (value) continue

    const memoryItem = sessionMemory[fieldName]
    if (!memoryItem?.value) continue

    merged.data[fieldName] = memoryItem.value
    merged.confidence[fieldName] = Number((memoryItem.confidence || 0.85).toFixed(2))
    merged.provenance[fieldName] = {
      source: "session_memory",
      label: null,
      line: null
    }
  }

  merged.missingRequiredFields = merged.missingRequiredFields.filter(
    (field) => !merged.data[field]
  )

  merged.fullyResolved =
    merged.missingRequiredFields.length === 0 &&
    Object.keys(merged.data).length > 0

  return merged
}

module.exports = {
  MEMORY_FIELDS,
  getSessionFieldMemory,
  upsertSessionFieldMemory,
  applySessionMemoryToExtraction
}
