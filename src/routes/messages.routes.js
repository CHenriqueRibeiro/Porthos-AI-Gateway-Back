const messageService = require("../services/message.service")

async function messagesRoutes(fastify) {
  fastify.post("/messages", async (request, reply) => {
    const { sessionId, role, content } = request.body

    const message = await messageService.createMessage({
      sessionId,
      role,
      content
    })

    return reply.code(201).send(message)
  })

  fastify.get("/sessions/:id/messages", async (request, reply) => {
    const { id } = request.params

    const messages = await messageService.listMessagesBySession({
      sessionId: id
    })

    return reply.send(messages)
  })
}

module.exports = messagesRoutes