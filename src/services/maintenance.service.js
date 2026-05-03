const prisma = require("../db/prisma")
const { getRuntimePolicyForApiKey } = require("./subscriptionRuntime.service")
const { pruneSemanticCacheByApiKey } = require("./semanticCache.service")
const { pruneExpiredVectorCache } = require("./semanticVectorCache.service")
const tokenUsageService = require("./tokenUsage.service")
const { schemaSql } = require("./tenantSchema.service")
const { getTenantSchemaByApiKeyId } = require("./tenantData.service")

async function pruneOperationalHistoryByApiKey({
  apiKeyId,
  retentionDays = 30
}) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))

  const sessions = await prisma.$queryRaw`
    SELECT
      id,
      status,
      last_activity_at AS "lastActivityAt"
    FROM ${schema}.sessions
    WHERE api_key_id = ${apiKeyId}
  `

  const endedSessionIds = sessions
    .filter(
      (session) =>
        session.status !== "active" &&
        session.lastActivityAt < cutoff
    )
    .map((session) => session.id)

  if (endedSessionIds.length > 0) {
    await prisma.$executeRaw`
      DELETE FROM ${schema}.messages
      WHERE session_id = ANY(${endedSessionIds})
        AND created_at < ${cutoff}
    `
  }
}

async function pruneAnalyticsByApiKey({
  apiKeyId,
  retentionDays = 30
}) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  await tokenUsageService.deleteTokenUsageBefore({
    apiKeyId,
    cutoff
  })
}

async function runMaintenanceForApiKey(apiKeyId) {
  const { runtimePolicy } = await getRuntimePolicyForApiKey(apiKeyId)

  await pruneOperationalHistoryByApiKey({
    apiKeyId,
    retentionDays: runtimePolicy.history.retentionDays
  })

  await pruneAnalyticsByApiKey({
    apiKeyId,
    retentionDays: runtimePolicy.analytics.retentionDays
  })

  await pruneSemanticCacheByApiKey({
    apiKeyId,
    maxRecords: runtimePolicy.semantic.maxRecords
  })

  return {
    apiKeyId,
    runtimePolicyApplied: runtimePolicy
  }
}

async function runMaintenanceForAllApiKeys() {
  const apiKeys = await prisma.apiKey.findMany({
    select: {
      id: true
    }
  })

  const results = []

  for (const apiKey of apiKeys) {
    try {
      const result = await runMaintenanceForApiKey(apiKey.id)
      results.push({
        apiKeyId: apiKey.id,
        success: true,
        result
      })
    } catch (error) {
      results.push({
        apiKeyId: apiKey.id,
        success: false,
        error: error.message
      })
    }
  }

  return {
    total: apiKeys.length,
    results
  }
}

async function pruneExpiredTenantCaches() {
  const tenants = await prisma.tenant.findMany({
    where: {
      isActive: true
    },
    select: {
      id: true,
      schemaName: true
    }
  })

  const results = []

  for (const tenant of tenants) {
    try {
      const deleted = await pruneExpiredVectorCache(tenant.schemaName)
      results.push({
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
        deleted,
        success: true
      })
    } catch (error) {
      results.push({
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
        error: error.message,
        success: false
      })
    }
  }

  return results
}

module.exports = {
  pruneOperationalHistoryByApiKey,
  pruneAnalyticsByApiKey,
  pruneExpiredTenantCaches,
  runMaintenanceForApiKey,
  runMaintenanceForAllApiKeys
}
