const crypto = require("crypto")
const prisma = require("../db/prisma")
const {
  buildTenantSchemaName,
  normalizeTenantSlug,
  ensureTenantSchema
} = require("./tenantSchema.service")
const { getRuntimePolicyForApiKey } = require("./subscriptionRuntime.service")

function generateGatewayApiKey() {
  return `sk_live_${crypto.randomBytes(24).toString("hex")}`
}

async function resolveOrCreateTenantForUser({ userId, tx = prisma }) {
  const existingTenant = await tx.tenant.findFirst({
    where: { ownerId: userId, isActive: true },
    orderBy: { createdAt: "asc" }
  })

  if (existingTenant) {
    return existingTenant
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true }
  })

  const slugBase = normalizeTenantSlug(
    user?.name || user?.email?.split("@")[0] || userId
  )
  const slug = `${slugBase}_${crypto.randomBytes(3).toString("hex")}`

  return tx.tenant.create({
    data: {
      ownerId: userId,
      slug,
      name: user?.name || null,
      schemaName: buildTenantSchemaName(slug)
    }
  })
}

async function createApiKey({ userId }) {
  const apiKey = generateGatewayApiKey()

  const created = await prisma.$transaction(async (tx) => {
    const tenant = await resolveOrCreateTenantForUser({ userId, tx })
    const existingApiKeys = await tx.apiKey.findMany({
      where: {
        tenantId: tenant.id
      },
      orderBy: {
        createdAt: "asc"
      },
      select: {
        id: true
      }
    })

    if (existingApiKeys.length > 0) {
      const { runtimePolicy } = await getRuntimePolicyForApiKey(
        existingApiKeys[0].id
      )
      const maxApiKeys = runtimePolicy.limits.maxApiKeys || 1

      if (existingApiKeys.length >= maxApiKeys) {
        throw new Error(
          `Limite de API keys do plano atingido (${maxApiKeys}). Faça upgrade ou contrate add-on.`
        )
      }
    }

    return tx.apiKey.create({
      data: {
        key: apiKey,
        userId,
        tenantId: tenant.id
      },
      include: {
        tenant: true
      }
    })
  })

  if (created.tenant?.schemaName) {
    await ensureTenantSchema(created.tenant.schemaName)
  }

  return created
}

async function findApiKeyByKey(key) {
  if (key === null || key === undefined) {
    return null
  }

  const normalized = typeof key === "string" ? key.trim() : String(key).trim()

  if (!normalized) {
    return null
  }

  return prisma.apiKey.findUnique({
    where: { key: normalized },
    include: {
      tenant: true
    }
  })
}

function maskGatewayApiKey(key) {
  if (typeof key !== "string" || key.length < 16) {
    return "••••••••"
  }

  return `${key.slice(0, 12)}…${key.slice(-4)}`
}

async function listApiKeysForUser({
  userId,
  currentKeyPlain = null,
  highlightApiKeyId = null
}) {
  const rows = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      key: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          slug: true,
          schemaName: true
        }
      }
    }
  })

  return rows.map((row) => ({
    id: row.id,
    keyPreview: maskGatewayApiKey(row.key),
    isCurrent: Boolean(
      (typeof currentKeyPlain === "string" &&
        row.key === currentKeyPlain.trim()) ||
      (typeof highlightApiKeyId === "string" && row.id === highlightApiKeyId)
    ),
    createdAt: row.createdAt,
    tenant: row.tenant
  }))
}

async function assertApiKeyOwnedByUser({ userId, apiKeyId }) {
  if (!apiKeyId) {
    return null
  }

  return prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId
    },
    select: { id: true }
  })
}

async function resolveAccountScopedApiKeyId({ userId, apiKeyId }) {
  if (apiKeyId) {
    const row = await assertApiKeyOwnedByUser({ userId, apiKeyId })
    return row?.id || null
  }

  const row = await prisma.apiKey.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  })

  return row?.id || null
}

async function getFullApiKeyForUserScoped({ userId, apiKeyId }) {
  const id = await resolveAccountScopedApiKeyId({
    userId,
    apiKeyId: apiKeyId || null
  })

  if (!id) {
    return null
  }

  return prisma.apiKey.findUnique({
    where: { id },
    include: {
      tenant: true
    }
  })
}

module.exports = {
  generateGatewayApiKey,
  createApiKey,
  resolveOrCreateTenantForUser,
  findApiKeyByKey,
  listApiKeysForUser,
  assertApiKeyOwnedByUser,
  resolveAccountScopedApiKeyId,
  getFullApiKeyForUserScoped
}
