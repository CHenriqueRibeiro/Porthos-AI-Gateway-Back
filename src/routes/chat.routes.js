const chatService = require("../services/chat.service")
const { rateLimitByApiKey } = require("../middleware/rateLimit.middleware")
const { concurrencyGuard } = require("../middleware/concurrency.middleware")
const { normalizeMessages, getLastUserMessage } = require("../services/requestContext.service")

async function chatRoutes(fastify) {
  fastify.post(
    "/chat",
    {
      preHandler: [rateLimitByApiKey, concurrencyGuard]
    },
    async (request, reply) => {
      try {
        const apiKeyRecord = request.apiKeyRecord

        if (!apiKeyRecord) {
          return reply.code(401).send({
            error: "API key inválida"
          })
        }

        const workloadCategory = request.workload?.category || "light"

        const {
          sessionId,
          model = "openai/gpt-4o-mini",
          messages = [],
          temperature = 0.2,
          max_tokens = 300
        } = request.body || {}

        if (!sessionId) {
          return reply.code(400).send({
            error: "sessionId é obrigatório para /chat"
          })
        }

        const normalizedMessages = normalizeMessages(messages)
        const lastUserMessage = getLastUserMessage(normalizedMessages)

        if (!lastUserMessage) {
          return reply.code(400).send({
            error: "É necessário ao menos uma mensagem do usuário com content"
          })
        }

        const result = await chatService.sendMessage({
          sessionId,
          apiKeyId: apiKeyRecord.id,
          messages: normalizedMessages,
          model,
          temperature,
          maxTokens: max_tokens,
          responseFormat: null,
          extractionProfile: "generic_document",
          routeType: "chat",
          workloadCategory
        })

        return reply.send(result)
      } catch (error) {
        console.error(error)

        if (error.message === "Sessão não encontrada") {
          return reply.code(404).send({ error: error.message })
        }

        if (error.message === "Sessão encerrada") {
          return reply.code(409).send({ error: error.message })
        }

        if (error.message === "Sessão expirada") {
          return reply.code(409).send({ error: error.message })
        }

        if (
          error.message === "Conteúdo excede o limite operacional do plano" ||
          error.message === "Schema excede o limite operacional do plano"
        ) {
          return reply.code(400).send({
            error: error.message
          })
        }

        return reply.code(500).send({
          error: "Erro ao processar chat",
          details: error.message
        })
      }
    }
  )
}

module.exports = chatRoutes