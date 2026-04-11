const jwt = require("jsonwebtoken")
const env = require("../config/env")

function pathOnly(url = "/") {
  const s = String(url)
  const q = s.indexOf("?")
  return q === -1 ? s : s.slice(0, q)
}

function isGatewayAuthExempt(path, method) {
  const m = (method || "GET").toUpperCase()

  if (m === "OPTIONS") {
    return true
  }

  if (path === "/health") {
    return true
  }

  if (path === "/auth/register" && m === "POST") {
    return true
  }

  if (path === "/auth/login" && m === "POST") {
    return true
  }

  if (path.startsWith("/public/")) {
    return true
  }

  if (path.startsWith("/admin/")) {
    return true
  }

  return false
}

function getBearerPayload(request) {
  const auth = request.headers.authorization

  if (!auth || typeof auth !== "string") {
    return null
  }

  const match = auth.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    return null
  }

  const token = match[1].trim()

  if (!token) {
    return null
  }

  const secret =
    env.jwtSecret || process.env.JWT_SECRET || "dev_secret_change_me"

  try {
    return jwt.verify(token, secret)
  } catch {
    return null
  }
}

async function gatewayAuthOnRequest(request, reply) {
  const path = pathOnly(request.url)
  const method = request.method

  if (isGatewayAuthExempt(path, method)) {
    return
  }

  const payload = getBearerPayload(request)

  if (!payload?.sub) {
    return reply.code(401).send({
      error: "Token de acesso obrigatório",
      hint: "Envie Authorization: Bearer <accessToken> (exceto em /auth/login, /auth/register e /public/*)."
    })
  }

  request.authUser = {
    id: payload.sub,
    email: payload.email
  }
}

module.exports = {
  gatewayAuthOnRequest,
  isGatewayAuthExempt,
  pathOnly
}
