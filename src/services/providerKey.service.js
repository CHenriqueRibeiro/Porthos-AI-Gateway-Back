const prisma = require("../db/prisma")
const { encrypt, decrypt } = require("../utils/crypto")

async function createProviderKey({
  apiKeyId,
  provider,
  apiKey,
  label = null,
  isDefault = true,
  validationStatus = "valid",
  validationMessage = "Chave validada com sucesso"
}) {
  if (isDefault) {
    await prisma.providerKey.updateMany({
      where: {
        apiKeyId,
        provider
      },
      data: {
        isDefault: false
      }
    })
  }

  const saved = await prisma.providerKey.create({
    data: {
      apiKeyId,
      provider,
      label,
      encryptedKey: encrypt(apiKey),
      isDefault,
      isActive: true,
      validationStatus,
      validationMessage,
      lastValidatedAt: new Date()
    }
  })

  return saved
}

async function listProviderKeys(apiKeyId) {
  return prisma.providerKey.findMany({
    where: { apiKeyId },
    orderBy: [
      { provider: "asc" },
      { createdAt: "desc" }
    ]
  })
}

async function getDefaultProviderKey(apiKeyId, provider) {
  const found = await prisma.providerKey.findFirst({
    where: {
      apiKeyId,
      provider,
      isDefault: true,
      isActive: true
    },
    orderBy: {
      createdAt: "desc"
    }
  })

  if (!found) return null

  return {
    ...found,
    apiKey: decrypt(found.encryptedKey)
  }
}

async function deleteProviderKey(id, apiKeyId) {
  return prisma.providerKey.deleteMany({
    where: {
      id,
      apiKeyId
    }
  })
}

async function setDefaultProviderKey(id, apiKeyId) {
  const found = await prisma.providerKey.findFirst({
    where: {
      id,
      apiKeyId
    }
  })

  if (!found) {
    throw new Error("Provider key não encontrada")
  }

  await prisma.providerKey.updateMany({
    where: {
      apiKeyId,
      provider: found.provider
    },
    data: {
      isDefault: false
    }
  })

  return prisma.providerKey.update({
    where: { id },
    data: {
      isDefault: true
    }
  })
}

module.exports = {
  createProviderKey,
  listProviderKeys,
  getDefaultProviderKey,
  deleteProviderKey,
  setDefaultProviderKey
}