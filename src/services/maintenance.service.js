const prisma = require("../db/prisma")
const { getRuntimePolicyForApiKey } = require("./subscriptionRuntime.service")
const { pruneSemanticCacheByApiKey } = require("./semanticCache.service")

async function pruneOperationalHistoryByApiKey({
  apiKeyId,
  retentionDays = 30
}) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  const sessions = await prisma.session.findMany({
    where: {
      apiKeyId
    },
    select: {
      id: true,
      status: true,
      lastActivityAt: true
    }
  })

  const endedSessionIds = sessions
    .filter(
      (session) =>
        session.status !== "active" &&
        session.lastActivityAt < cutoff
    )
    .map((session) => session.id)

  if (endedSessionIds.length > 0) {
    await prisma.message.deleteMany({
      where: {
        sessionId: {
          in: endedSessionIds
        },
        createdAt: {
          lt: cutoff
        }
      }
    })
  }
}

async function pruneAnalyticsByApiKey({
  apiKeyId,
  retentionDays = 30
}) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  await prisma.tokenUsage.deleteMany({
    where: {
      apiKeyId,
      createdAt: {
        lt: cutoff
      }
    }
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

module.exports = {
  pruneOperationalHistoryByApiKey,
  pruneAnalyticsByApiKey,
  runMaintenanceForApiKey,
  runMaintenanceForAllApiKeys
}