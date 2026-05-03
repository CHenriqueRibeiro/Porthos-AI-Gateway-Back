const Fastify = require("fastify")
const usersRoutes = require("./routes/users.routes")
const apiKeysRoutes = require("./routes/apiKeys.routes")
const sessionsRoutes = require("./routes/sessions.routes")
const messagesRoutes = require("./routes/messages.routes")
const chatRoutes = require("./routes/chat.routes")
const analyticsRoutes = require("./routes/analytics.routes")
const providerKeyRoutes = require("./routes/providerKey.routes")
const modelPricingRoutes = require("./routes/modelPricing.routes")
const billingRoutes = require("./routes/billing.routes")
const extractRoutes = require("./routes/extract.routes")
const publicSimulator = require("./routes/publicSimulator.routes")
const adminMaintenanceRoutes = require("./routes/adminMaintenance.routes")
const authRoutes = require("./routes/auth.routes")
const { gatewayAuthOnRequest } = require("./middleware/gatewayAuth.middleware")
const dashboardRoutes = require("./routes/dashboard.routes")

function buildApp() {
  const fastify = Fastify({
    logger: true,
    bodyLimit: Number(process.env.REQUEST_BODY_LIMIT_BYTES || 1024 * 1024),
    server: {
      keepAliveTimeout: 65000,
      headersTimeout: 66000    }
  })

  fastify.decorateRequest("authUser", null)
  fastify.decorateRequest("apiKeyRecord", null)
  fastify.decorateRequest("tenant", null)
  fastify.decorateRequest("tenantSchemaName", null)
  fastify.decorateRequest("runtimePolicy", null)
  fastify.decorateRequest("effectiveConfig", null)
  fastify.decorateRequest("workload", null)
  fastify.decorateRequest("releaseConcurrencySlot", null)
  fastify.decorateRequest("startedAt", 0)


  fastify.register(require('@fastify/cors'), {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })

  fastify.addHook("onRequest", gatewayAuthOnRequest)

  fastify.addHook("onRequest", async (request) => {
    request.startedAt = Date.now()
  })

  fastify.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Response-Time-Ms", String(Date.now() - request.startedAt))
    return payload
  })

  fastify.addHook("onResponse", async (request, reply) => {
    if (typeof request.releaseConcurrencySlot === "function") {
      request.releaseConcurrencySlot().catch((error) => {
        request.log.error(error, "Erro ao liberar slot de concorrencia")
      })
    }
  })

  fastify.setErrorHandler((error, request, reply) => {
    request.log.error(error)

    return reply.code(error.statusCode || 500).send({
      error: "Erro interno no gateway",
      details: error.message
    })
  })

  fastify.get("/health", async () => {
    return {
      status: "ok",
      service: "llm-gateway-api"
    }
  })

  fastify.register(usersRoutes)
  fastify.register(apiKeysRoutes)
  fastify.register(sessionsRoutes)
  fastify.register(messagesRoutes)
  fastify.register(chatRoutes)
  fastify.register(analyticsRoutes)
  fastify.register(providerKeyRoutes)
  fastify.register(modelPricingRoutes)
  fastify.register(billingRoutes)
  fastify.register(publicSimulator)
  fastify.register(adminMaintenanceRoutes)
  fastify.register(extractRoutes)
  fastify.register(authRoutes)
  fastify.register(dashboardRoutes)
  return fastify
}

module.exports = buildApp
