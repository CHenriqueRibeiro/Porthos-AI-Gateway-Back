const crypto = require("crypto")
const prisma = require("../db/prisma")
const { schemaSql } = require("./tenantSchema.service")
const {
  mapMessage,
  getTenantSchemaBySessionId
} = require("./tenantData.service")

async function createMessage({ sessionId, role, content }) {
  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) {
    throw new Error("Sessão não encontrada")
  }

  const schema = schemaSql(schemaName)
  const id = crypto.randomUUID()
  const rows = await prisma.$queryRaw`
    INSERT INTO ${schema}.messages (id, session_id, role, content)
    VALUES (${id}, ${sessionId}, ${role}, ${String(content || "")})
    RETURNING
      id,
      session_id AS "sessionId",
      role,
      content,
      created_at AS "createdAt"
  `

  return mapMessage(rows[0])
}

async function listMessagesBySession({ sessionId }) {
  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) return []

  const schema = schemaSql(schemaName)
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      session_id AS "sessionId",
      role,
      content,
      created_at AS "createdAt"
    FROM ${schema}.messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  `

  return rows.map(mapMessage)
}

async function getRecentMessages({ sessionId, limit = 6 }) {
  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) return []

  const schema = schemaSql(schemaName)
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      session_id AS "sessionId",
      role,
      content,
      created_at AS "createdAt"
    FROM ${schema}.messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at DESC
    LIMIT ${Number(limit) || 6}
  `

  return rows.map(mapMessage)
}

module.exports = {
  createMessage,
  listMessagesBySession,
  getRecentMessages
}
