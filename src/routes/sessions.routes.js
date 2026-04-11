const sessionService = require("../services/session.service")
const apiKeyService = require("../services/apiKey.service")

async function sessionsRoutes(fastify) {
  fastify.post("/sessions", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const body = request.body || {}
      const apiKeyIdInput =
        typeof body.apiKeyId === "string" && body.apiKeyId.trim()
          ? body.apiKeyId.trim()
          : null

      const apiKeyRecord = await apiKeyService.getFullApiKeyForUserScoped({
        userId: authUser.id,
        apiKeyId: apiKeyIdInput
      })

      if (!apiKeyRecord) {
        return reply.code(400).send({
          error: "Nenhuma API key válida ou apiKeyId não pertence ao usuário",
          hint: "Passe apiKeyId no body ou use a chave gateway padrão (mais antiga)."
        })
      }

      const {
        externalConversationId = null,
        channel = null,
        label = null
      } = body

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
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { page = 1, pageSize = 20, status = null, apiKeyId: apiKeyIdQuery } =
        request.query || {}

      const apiKeyId =
        typeof apiKeyIdQuery === "string" && apiKeyIdQuery.trim()
          ? apiKeyIdQuery.trim()
          : null

      const apiKeyRecord = await apiKeyService.getFullApiKeyForUserScoped({
        userId: authUser.id,
        apiKeyId
      })

      if (!apiKeyRecord) {
        return reply.code(400).send({
          error: "Nenhuma API key válida ou apiKeyId inválido",
          hint: "Use ?apiKeyId=<uuid> ou omita para a chave gateway padrão."
        })
      }

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
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { id } = request.params

      const scoped = await sessionService.getSessionWithApiKeyForUser({
        sessionId: id,
        userId: authUser.id
      })

      if (!scoped) {
        return reply.code(404).send({
          error: "Sessão não encontrada"
        })
      }

      const session = await sessionService.getSessionById({
        sessionId: id,
        apiKeyId: scoped.apiKeyId
      })

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
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { id } = request.params

      const scoped = await sessionService.getSessionWithApiKeyForUser({
        sessionId: id,
        userId: authUser.id
      })

      if (!scoped) {
        return reply.code(404).send({
          error: "Sessão não encontrada"
        })
      }

      const session = await sessionService.closeSession({
        sessionId: id,
        apiKeyId: scoped.apiKeyId
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
