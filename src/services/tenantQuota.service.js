const prisma = require("../db/prisma")
const { getRuntimePolicyForApiKey } = require("./subscriptionRuntime.service")
const {
  getTenantByApiKeyId,
  schemaSql
} = require("./tenantSchema.service")

async function getTenantSchemaStorageMb(schemaName) {
  const rows = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(pg_total_relation_size(c.oid)), 0)::bigint AS bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${schemaName}
      AND c.relkind IN ('r', 'i', 'm', 't')
  `

  const bytes = Number(rows?.[0]?.bytes || 0)
  return Number((bytes / 1024 / 1024).toFixed(2))
}

async function assertTenantStorageAvailable(apiKeyId) {
  const tenant = await getTenantByApiKeyId(apiKeyId)

  if (!tenant?.schemaName) {
    return {
      checked: false,
      reason: "tenant_not_found"
    }
  }

  schemaSql(tenant.schemaName)

  const { runtimePolicy } = await getRuntimePolicyForApiKey(apiKeyId)
  const limitMb = runtimePolicy.storage?.storageMb || 50
  const usedMb = await getTenantSchemaStorageMb(tenant.schemaName)

  if (usedMb >= limitMb) {
    const error = new Error(
      `Limite de storage do tenant atingido (${usedMb}MB/${limitMb}MB). Faça upgrade ou contrate pacote de storage.`
    )
    error.statusCode = 403
    throw error
  }

  return {
    checked: true,
    schemaName: tenant.schemaName,
    usedMb,
    limitMb
  }
}

module.exports = {
  getTenantSchemaStorageMb,
  assertTenantStorageAvailable
}
