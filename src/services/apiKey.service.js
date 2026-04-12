const crypto = require("crypto")
const prisma = require("../db/prisma")

function generateGatewayApiKey() {
  return `sk_live_${crypto.randomBytes(24).toString("hex")}`
}

async function createApiKey({ userId }) {
  const apiKey = generateGatewayApiKey()
  return prisma.apiKey.create({
    data: {
      key: apiKey,
      userId
    }
  })
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
    where: { key: normalized }
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
      createdAt: true
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
    createdAt: row.createdAt
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
    where: { id }
  })
}

module.exports = {
  generateGatewayApiKey,
  createApiKey,
  findApiKeyByKey,
  listApiKeysForUser,
  assertApiKeyOwnedByUser,
  resolveAccountScopedApiKeyId,
  getFullApiKeyForUserScoped
}