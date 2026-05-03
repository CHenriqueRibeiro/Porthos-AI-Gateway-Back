const prisma = require("../db/prisma")
const {
  ensureTenantSchema,
  getTenantByApiKeyId,
  schemaSql
} = require("./tenantSchema.service")

function mapSession(row = {}) {
  if (!row) return null

  return {
    id: row.id,
    apiKeyId: row.apiKeyId,
    status: row.status,
    externalConversationId: row.externalConversationId,
    channel: row.channel,
    label: row.label,
    createdAt: row.createdAt,
    lastActivityAt: row.lastActivityAt,
    endedAt: row.endedAt,
    expiredAt: row.expiredAt,
    summary: row.summary
  }
}

function mapMessage(row = {}) {
  if (!row) return null

  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt
  }
}

async function getTenantSchemaByApiKeyId(apiKeyId) {
  const tenant = await getTenantByApiKeyId(apiKeyId)

  if (!tenant?.schemaName) {
    throw new Error("API key sem tenant vinculado")
  }

  await ensureTenantSchema(tenant.schemaName)

  return tenant.schemaName
}

async function getTenantSchemaBySessionId(sessionId) {
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { schemaName: true }
  })

  for (const tenant of tenants) {
    await ensureTenantSchema(tenant.schemaName)
    const schema = schemaSql(tenant.schemaName)
    const rows = await prisma.$queryRaw`
      SELECT id
      FROM ${schema}.sessions
      WHERE id = ${sessionId}
      LIMIT 1
    `

    if (rows.length > 0) {
      return tenant.schemaName
    }
  }

  return null
}

async function getTenantSchemaForUserSession({ sessionId, userId }) {
  const apiKeys = await prisma.apiKey.findMany({
    where: {
      userId,
      tenant: {
        isActive: true
      }
    },
    include: {
      tenant: true
    }
  })

  for (const apiKey of apiKeys) {
    const schemaName = apiKey.tenant?.schemaName
    if (!schemaName) continue

    await ensureTenantSchema(schemaName)
    const schema = schemaSql(schemaName)
    const rows = await prisma.$queryRaw`
      SELECT id
      FROM ${schema}.sessions
      WHERE id = ${sessionId}
        AND api_key_id = ${apiKey.id}
      LIMIT 1
    `

    if (rows.length > 0) {
      return schemaName
    }
  }

  return null
}

module.exports = {
  mapSession,
  mapMessage,
  getTenantSchemaByApiKeyId,
  getTenantSchemaBySessionId,
  getTenantSchemaForUserSession
}
