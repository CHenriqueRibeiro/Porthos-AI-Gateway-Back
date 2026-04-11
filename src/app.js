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

function buildApp() {
  const fastify = Fastify({
    logger: true
  })

  fastify.addHook("onRequest", gatewayAuthOnRequest)

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

  return fastify
}

module.exports = buildApp