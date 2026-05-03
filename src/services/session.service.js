const crypto = require("crypto")
const prisma = require("../db/prisma")
const { schemaSql } = require("./tenantSchema.service")
const {
  mapSession,
  mapMessage,
  getTenantSchemaByApiKeyId,
  getTenantSchemaBySessionId,
  getTenantSchemaForUserSession
} = require("./tenantData.service")

const SESSION_EXPIRATION_HOURS = 24

function isSessionExpiredByInactivity(session) {
  if (!session?.lastActivityAt) return false

  const now = Date.now()
  const lastActivity = new Date(session.lastActivityAt).getTime()
  const diffHours = (now - lastActivity) / (1000 * 60 * 60)

  return diffHours >= SESSION_EXPIRATION_HOURS
}

async function createSession({
  apiKeyId,
  externalConversationId = null,
  channel = null,
  label = null
}) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))

  if (externalConversationId) {
    const existing = await prisma.$queryRaw`
      SELECT
        id,
        api_key_id AS "apiKeyId",
        status,
        external_conversation_id AS "externalConversationId",
        channel,
        label,
        created_at AS "createdAt",
        last_activity_at AS "lastActivityAt",
        ended_at AS "endedAt",
        expired_at AS "expiredAt",
        summary
      FROM ${schema}.sessions
      WHERE api_key_id = ${apiKeyId}
        AND external_conversation_id = ${externalConversationId}
      LIMIT 1
    `

    if (existing[0]) return mapSession(existing[0])
  }

  const id = crypto.randomUUID()
  const rows = await prisma.$queryRaw`
    INSERT INTO ${schema}.sessions (
      id,
      api_key_id,
      external_conversation_id,
      channel,
      label
    )
    VALUES (${id}, ${apiKeyId}, ${externalConversationId}, ${channel}, ${label})
    RETURNING
      id,
      api_key_id AS "apiKeyId",
      status,
      external_conversation_id AS "externalConversationId",
      channel,
      label,
      created_at AS "createdAt",
      last_activity_at AS "lastActivityAt",
      ended_at AS "endedAt",
      expired_at AS "expiredAt",
      summary
  `

  return mapSession(rows[0])
}

async function getSessionForApiKey({ sessionId, apiKeyId }) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))

  const rows = await prisma.$queryRaw`
    SELECT
      id,
      api_key_id AS "apiKeyId",
      status,
      external_conversation_id AS "externalConversationId",
      channel,
      label,
      created_at AS "createdAt",
      last_activity_at AS "lastActivityAt",
      ended_at AS "endedAt",
      expired_at AS "expiredAt",
      summary
    FROM ${schema}.sessions
    WHERE id = ${sessionId}
      AND api_key_id = ${apiKeyId}
    LIMIT 1
  `

  return mapSession(rows[0])
}

async function getSessionWithApiKeyForUser({ sessionId, userId }) {
  const schemaName = await getTenantSchemaForUserSession({ sessionId, userId })
  if (!schemaName) return null

  const schema = schemaSql(schemaName)
  const rows = await prisma.$queryRaw`
    SELECT
      s.id,
      s.api_key_id AS "apiKeyId",
      s.status,
      s.external_conversation_id AS "externalConversationId",
      s.channel,
      s.label,
      s.created_at AS "createdAt",
      s.last_activity_at AS "lastActivityAt",
      s.ended_at AS "endedAt",
      s.expired_at AS "expiredAt",
      s.summary
    FROM ${schema}.sessions s
    WHERE s.id = ${sessionId}
    LIMIT 1
  `

  const session = mapSession(rows[0])
  if (!session) return null

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: session.apiKeyId,
      userId
    },
    include: {
      tenant: true
    }
  })

  if (!apiKey) return null

  return {
    ...session,
    apiKey
  }
}

async function getSessionById({ sessionId, apiKeyId }) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  const session = await getSessionForApiKey({ sessionId, apiKeyId })

  if (!session) return null

  const messages = await prisma.$queryRaw`
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

  return {
    ...session,
    messages: messages.map(mapMessage)
  }
}

async function listSessions({
  apiKeyId,
  page = 1,
  pageSize = 20,
  status = null
}) {
  const safePage = Number(page) > 0 ? Number(page) : 1
  const safePageSize = Number(pageSize) > 0 ? Number(pageSize) : 20
  const skip = (safePage - 1) * safePageSize
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))

  const statusFilter = status || null
  const items = await prisma.$queryRaw`
    SELECT
      id,
      api_key_id AS "apiKeyId",
      status,
      external_conversation_id AS "externalConversationId",
      channel,
      label,
      created_at AS "createdAt",
      last_activity_at AS "lastActivityAt",
      ended_at AS "endedAt",
      expired_at AS "expiredAt",
      summary
    FROM ${schema}.sessions
    WHERE api_key_id = ${apiKeyId}
      AND (${statusFilter}::text IS NULL OR status = ${statusFilter})
    ORDER BY last_activity_at DESC
    LIMIT ${safePageSize}
    OFFSET ${skip}
  `

  const countRows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total
    FROM ${schema}.sessions
    WHERE api_key_id = ${apiKeyId}
      AND (${statusFilter}::text IS NULL OR status = ${statusFilter})
  `
  const total = Number(countRows[0]?.total || 0)

  return {
    items: items.map(mapSession),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.ceil(total / safePageSize)
    }
  }
}

async function closeSession({ sessionId, apiKeyId }) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  const session = await getSessionForApiKey({ sessionId, apiKeyId })

  if (!session) {
    throw new Error("Sessão não encontrada")
  }

  if (session.status === "closed") {
    return session
  }

  const rows = await prisma.$queryRaw`
    UPDATE ${schema}.sessions
    SET status = 'closed',
        ended_at = NOW()
    WHERE id = ${sessionId}
      AND api_key_id = ${apiKeyId}
    RETURNING
      id,
      api_key_id AS "apiKeyId",
      status,
      external_conversation_id AS "externalConversationId",
      channel,
      label,
      created_at AS "createdAt",
      last_activity_at AS "lastActivityAt",
      ended_at AS "endedAt",
      expired_at AS "expiredAt",
      summary
  `

  return mapSession(rows[0])
}

async function expireSessionIfNeeded({ sessionId, apiKeyId }) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  const session = await getSessionForApiKey({ sessionId, apiKeyId })

  if (!session) {
    throw new Error("Sessão não encontrada")
  }

  if (session.status === "closed" || session.status === "expired") {
    return session
  }

  if (!isSessionExpiredByInactivity(session)) {
    return session
  }

  const rows = await prisma.$queryRaw`
    UPDATE ${schema}.sessions
    SET status = 'expired',
        expired_at = NOW()
    WHERE id = ${session.id}
    RETURNING
      id,
      api_key_id AS "apiKeyId",
      status,
      external_conversation_id AS "externalConversationId",
      channel,
      label,
      created_at AS "createdAt",
      last_activity_at AS "lastActivityAt",
      ended_at AS "endedAt",
      expired_at AS "expiredAt",
      summary
  `

  return mapSession(rows[0])
}

async function updateSessionActivity(sessionId) {
  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) return null

  const schema = schemaSql(schemaName)
  await prisma.$executeRaw`
    UPDATE ${schema}.sessions
    SET last_activity_at = NOW()
    WHERE id = ${sessionId}
  `
}

async function updateSessionSummary({ sessionId, summary }) {
  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) return null

  const schema = schemaSql(schemaName)
  await prisma.$executeRaw`
    UPDATE ${schema}.sessions
    SET summary = ${summary},
        last_activity_at = last_activity_at
    WHERE id = ${sessionId}
  `
}

async function getSessionSummary(sessionId) {
  const schemaName = await getTenantSchemaBySessionId(sessionId)
  if (!schemaName) return null

  const schema = schemaSql(schemaName)
  const rows = await prisma.$queryRaw`
    SELECT summary
    FROM ${schema}.sessions
    WHERE id = ${sessionId}
    LIMIT 1
  `

  return rows[0]?.summary || null
}

module.exports = {
  createSession,
  getSessionForApiKey,
  getSessionWithApiKeyForUser,
  getSessionById,
  listSessions,
  closeSession,
  expireSessionIfNeeded,
  updateSessionActivity,
  updateSessionSummary,
  getSessionSummary
}
