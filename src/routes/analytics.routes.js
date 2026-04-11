const analyticsService = require("../services/analytics.service")
const apiKeyService = require("../services/apiKey.service")

async function analyticsRoutes(fastify) {
  fastify.get("/usage/:apiKeyId", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { apiKeyId } = request.params
      const { day, startDate, endDate, includeDaily } = request.query

      const owned = await apiKeyService.assertApiKeyOwnedByUser({
        userId: authUser.id,
        apiKeyId
      })

      if (!owned) {
        return reply.code(403).send({
          error: "API key não encontrada ou não pertence ao usuário autenticado"
        })
      }

      const result = await analyticsService.getUsageByApiKey(apiKeyId, {
        day,
        startDate,
        endDate,
        includeDaily
      })

      return reply.send(result)
    } catch (error) {
      request.log.error(error)

      return reply.code(500).send({
        error: "Erro ao buscar analytics",
        details: error.message
      })
    }
  })
}

module.exports = analyticsRoutes
