const apiKeyService = require("../services/apiKey.service")

async function apiKeysRoutes(fastify) {
  fastify.post("/apikeys", async (request, reply) => {
    const { userId } = request.body

    const created = await apiKeyService.createApiKey({ userId })

    return reply.code(201).send(created)
  })
}

module.exports = apiKeysRoutes
