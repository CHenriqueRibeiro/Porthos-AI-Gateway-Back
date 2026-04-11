const messageService = require("../services/message.service")
const sessionService = require("../services/session.service")

async function messagesRoutes(fastify) {
  fastify.post("/messages", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { sessionId, role, content } = request.body || {}

      if (!sessionId) {
        return reply.code(400).send({
          error: "sessionId é obrigatório"
        })
      }

      const session = await sessionService.getSessionWithApiKeyForUser({
        sessionId,
        userId: authUser.id
      })

      if (!session) {
        return reply.code(404).send({
          error: "Sessão não encontrada"
        })
      }

      if (session.status === "closed" || session.status === "expired") {
        return reply.code(409).send({
          error: "Sessão encerrada ou expirada"
        })
      }

      const message = await messageService.createMessage({
        sessionId,
        role,
        content
      })

      return reply.code(201).send(message)
    } catch (error) {
      request.log.error(error)

      return reply.code(500).send({
        error: "Erro ao criar mensagem",
        details: error.message
      })
    }
  })

  fastify.get("/sessions/:id/messages", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { id } = request.params

      const session = await sessionService.getSessionWithApiKeyForUser({
        sessionId: id,
        userId: authUser.id
      })

      if (!session) {
        return reply.code(404).send({
          error: "Sessão não encontrada"
        })
      }

      const messages = await messageService.listMessagesBySession({
        sessionId: id
      })

      return reply.send(messages)
    } catch (error) {
      request.log.error(error)

      return reply.code(500).send({
        error: "Erro ao listar mensagens",
        details: error.message
      })
    }
  })
}

module.exports = messagesRoutes
