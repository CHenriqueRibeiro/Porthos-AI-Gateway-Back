const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const prisma = require("../db/prisma")
const apiKeyService = require("./apiKey.service")

function signAccessToken(user) {
  const secret = process.env.JWT_SECRET || "dev_secret_change_me"

  return jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    secret,
    {
      expiresIn: "7d"
    }
  )
}

async function registerUser({
  name,
  email,
  password,
  planCode
}) {
  const normalizedEmail = String(email || "").trim().toLowerCase()

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  })

  if (existingUser) {
    throw new Error("Email já cadastrado")
  }

  const plan = await prisma.subscriptionPlan.findFirst({
    where: {
      code: planCode,
      isActive: true
    }
  })

  if (!plan) {
    throw new Error("Plano não encontrado ou inativo")
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword
      }
    })

    const apiKey = await tx.apiKey.create({
      data: {
        key: apiKeyService.generateGatewayApiKey(),
        userId: user.id
      }
    })

    const subscription = await tx.customerSubscription.create({
      data: {
        apiKeyId: apiKey.id,
        planId: plan.id,
        status: "active"
      },
      include: {
        plan: true
      }
    })

    return {
      user,
      apiKey,
      subscription
    }
  })

  const accessToken = signAccessToken(result.user)

  return {
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email
    },
    apiKey: {
      id: result.apiKey.id,
      key: result.apiKey.key
    },
    subscription: {
      id: result.subscription.id,
      status: result.subscription.status,
      planCode: result.subscription.plan.code,
      planName: result.subscription.plan.name
    },
    auth: {
      accessToken
    }
  }
}

async function loginUser({
  email,
  password
}) {
  const normalizedEmail = String(email || "").trim().toLowerCase()

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      apiKeys: true
    }
  })

  if (!user) {
    throw new Error("Credenciais inválidas")
  }

  const passwordMatches = await bcrypt.compare(password, user.password)

  if (!passwordMatches) {
    throw new Error("Credenciais inválidas")
  }

  const apiKeyIds = (user.apiKeys || []).map((k) => k.id)

  const activeSubscription =
    apiKeyIds.length === 0
      ? null
      : await prisma.customerSubscription.findFirst({
          where: {
            apiKeyId: { in: apiKeyIds },
            status: "active"
          },
          include: {
            plan: true
          },
          orderBy: {
            createdAt: "desc"
          }
        })

  const sortedByCreatedAsc = [...(user.apiKeys || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  )
  const primaryApiKey = sortedByCreatedAsc[0]

  const apiKeys = await apiKeyService.listApiKeysForUser({
    userId: user.id,
    currentKeyPlain: null,
    highlightApiKeyId: primaryApiKey?.id || null
  })

  const accessToken = signAccessToken(user)

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    },
    apiKey: primaryApiKey
      ? {
          id: primaryApiKey.id,
          key: primaryApiKey.key
        }
      : null,
    apiKeys,
    subscription: activeSubscription
      ? {
          id: activeSubscription.id,
          status: activeSubscription.status,
          planCode: activeSubscription.plan.code,
          planName: activeSubscription.plan.name
        }
      : null,
    auth: {
      accessToken
    }
  }
}

async function logoutUser() {
  return {
    success: true
  }
}

module.exports = {
  registerUser,
  loginUser,
  logoutUser
}