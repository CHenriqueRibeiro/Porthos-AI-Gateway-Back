const crypto = require("crypto")
const prisma = require("../db/prisma")

async function createApiKey({ userId }) {
  const apiKey = `sk_${crypto.randomBytes(24).toString("hex")}`

  return prisma.apiKey.create({
    data: {
      key: apiKey,
      userId
    }
  })
}

async function findApiKeyByKey(key) {
  return prisma.apiKey.findUnique({
    where: { key }
  })
}

module.exports = {
  createApiKey,
  findApiKeyByKey
}