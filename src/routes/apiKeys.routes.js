const apiKeyService = require("../services/apiKey.service")

async function apiKeysRoutes(fastify) {
  fastify.get("/apikeys", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { highlightApiKeyId } = request.query || {}

      const items = await apiKeyService.listApiKeysForUser({
        userId: authUser.id,
        currentKeyPlain: null,
        highlightApiKeyId:
          typeof highlightApiKeyId === "string" ? highlightApiKeyId : null
      })

      return reply.send({ items })
    } catch (error) {
      request.log.error(error)

      return reply.code(500).send({
        error: "Erro ao listar API keys",
        details: error.message
      })
    }
  })

  fastify.post("/apikeys", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const created = await apiKeyService.createApiKey({
        userId: authUser.id
      })

      return reply.code(201).send(created)
    } catch (error) {
      request.log.error(error)

      return reply.code(500).send({
        error: "Erro ao criar API key",
        details: error.message
      })
    }
  })
}

module.exports = apiKeysRoutes
