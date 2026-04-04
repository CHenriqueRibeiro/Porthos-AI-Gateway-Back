const analyticsService = require("../services/analytics.service")
const apiKeyService = require("../services/apiKey.service")

async function analyticsRoutes(fastify) {
  fastify.get("/usage/:apiKeyId", async (request, reply) => {
    try {
      const { apiKeyId } = request.params
      const { day, startDate, endDate, includeDaily } = request.query
      const apiKey = request.headers["x-api-key"]

      if (!apiKey) {
        return reply.code(401).send({
          error: "API key obrigatória"
        })
      }

      const callerKey = await apiKeyService.findApiKeyByKey(apiKey)

      if (!callerKey) {
        return reply.code(401).send({
          error: "API key inválida"
        })
      }

      if (callerKey.id !== apiKeyId) {
        return reply.code(403).send({
          error: "Acesso não autorizado para este apiKeyId"
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