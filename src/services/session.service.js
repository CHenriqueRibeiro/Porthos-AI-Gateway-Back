const prisma = require("../db/prisma")

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
  if (externalConversationId) {
    const existingSession = await prisma.session.findFirst({
      where: {
        apiKeyId,
        externalConversationId
      }
    })

    if (existingSession) {
      return existingSession
    }
  }

  return prisma.session.create({
    data: {
      apiKeyId,
      externalConversationId,
      channel,
      label
    }
  })
}

async function getSessionById({ sessionId, apiKeyId }) {
  return prisma.session.findFirst({
    where: {
      id: sessionId,
      apiKeyId
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  })
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

  const where = { apiKeyId }

  if (status) {
    where.status = status
  }

  const [items, total] = await Promise.all([
    prisma.session.findMany({
      where,
      orderBy: {
        lastActivityAt: "desc"
      },
      skip,
      take: safePageSize
    }),
    prisma.session.count({ where })
  ])

  return {
    items,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.ceil(total / safePageSize)
    }
  }
}

async function closeSession({ sessionId, apiKeyId }) {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      apiKeyId
    }
  })

  if (!session) {
    throw new Error("Sessão não encontrada")
  }

  if (session.status === "closed") {
    return session
  }

  return prisma.session.update({
    where: {
      id: sessionId
    },
    data: {
      status: "closed",
      endedAt: new Date()
    }
  })
}

async function expireSessionIfNeeded({ sessionId, apiKeyId }) {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      apiKeyId
    }
  })

  if (!session) {
    throw new Error("Sessão não encontrada")
  }

  if (session.status === "closed" || session.status === "expired") {
    return session
  }

  if (!isSessionExpiredByInactivity(session)) {
    return session
  }

  return prisma.session.update({
    where: {
      id: session.id
    },
    data: {
      status: "expired",
      expiredAt: new Date()
    }
  })
}

module.exports = {
  createSession,
  getSessionById,
  listSessions,
  closeSession,
  expireSessionIfNeeded
}