const prisma = require("../db/prisma")

async function createMessage({ sessionId, role, content }) {
  return prisma.message.create({
    data: {
      sessionId,
      role,
      content
    }
  })
}

async function listMessagesBySession({ sessionId }) {
  return prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" }
  })
}

async function getRecentMessages({ sessionId, limit = 6 }) {
  return prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit
  })
}
module.exports = {
  createMessage,
  listMessagesBySession,
  getRecentMessages
}