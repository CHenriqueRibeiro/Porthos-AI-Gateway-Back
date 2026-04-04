const sessionService = require("../services/session.service")
const apiKeyService = require("../services/apiKey.service")

async function sessionsRoutes(fastify) {
  fastify.post("/sessions", async (request, reply) => {
    try {
      const apiKey = request.headers["x-api-key"]

      if (!apiKey) {
        return reply.code(401).send({
          error: "API key obrigatória"
        })
      }

      const apiKeyRecord = await apiKeyService.findApiKeyByKey(apiKey)

      if (!apiKeyRecord) {
        return reply.code(401).send({
          error: "API key inválida"
        })
      }

      const {
        externalConversationId = null,
        channel = null,
        label = null
      } = request.body || {}

      const session = await sessionService.createSession({
        apiKeyId: apiKeyRecord.id,
        externalConversationId,
        channel,
        label
      })

      return reply.code(201).send(session)
    } catch (error) {
      request.log.error(error)

      return reply.code(500).send({
        error: "Erro ao criar sessão",
        details: error.message
      })
    }
  })

  fastify.get("/sessions", async (request, reply) => {
    try {
      const apiKey = request.headers["x-api-key"]

      if (!apiKey) {
        return reply.code(401).send({
          error: "API key obrigatória"
        })
      }

      const apiKeyRecord = await apiKeyService.findApiKeyByKey(apiKey)

      if (!apiKeyRecord) {
        return reply.code(401).send({
          error: "API key inválida"
        })
      }

      const { page = 1, pageSize = 20, status = null } = request.query || {}

      const sessions = await sessionService.listSessions({
        apiKeyId: apiKeyRecord.id,
        page,
        pageSize,
        status
      })

      return reply.send(sessions)
    } catch (error) {
      request.log.error(error)

      return reply.code(500).send({
        error: "Erro ao listar sessões",
        details: error.message
      })
    }
  })

  fastify.get("/sessions/:id", async (request, reply) => {
    try {
      const apiKey = request.headers["x-api-key"]

      if (!apiKey) {
        return reply.code(401).send({
          error: "API key obrigatória"
        })
      }

      const apiKeyRecord = await apiKeyService.findApiKeyByKey(apiKey)

      if (!apiKeyRecord) {
        return reply.code(401).send({
          error: "API key inválida"
        })
      }

      const { id } = request.params

      const session = await sessionService.getSessionById({
        sessionId: id,
        apiKeyId: apiKeyRecord.id
      })

      if (!session) {
        return reply.code(404).send({
          error: "Sessão não encontrada"
        })
      }

      return reply.send(session)
    } catch (error) {
      request.log.error(error)

      return reply.code(500).send({
        error: "Erro ao buscar sessão",
        details: error.message
      })
    }
  })

  fastify.post("/sessions/:id/close", async (request, reply) => {
    try {
      const apiKey = request.headers["x-api-key"]

      if (!apiKey) {
        return reply.code(401).send({
          error: "API key obrigatória"
        })
      }

      const apiKeyRecord = await apiKeyService.findApiKeyByKey(apiKey)

      if (!apiKeyRecord) {
        return reply.code(401).send({
          error: "API key inválida"
        })
      }

      const { id } = request.params

      const session = await sessionService.closeSession({
        sessionId: id,
        apiKeyId: apiKeyRecord.id
      })

      return reply.send(session)
    } catch (error) {
      request.log.error(error)

      if (error.message === "Sessão não encontrada") {
        return reply.code(404).send({
          error: error.message
        })
      }

      return reply.code(500).send({
        error: "Erro ao encerrar sessão",
        details: error.message
      })
    }
  })
}

module.exports = sessionsRoutes