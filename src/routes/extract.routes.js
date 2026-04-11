const chatService = require("../services/chat.service")
const { rateLimitByApiKey } = require("../middleware/rateLimit.middleware")
const { concurrencyGuard } = require("../middleware/concurrency.middleware")
const { attachGatewayKeyFromSessionBody } = require("../middleware/jwtSdkContext.middleware")
const { normalizeMessages, getLastUserMessage } = require("../services/requestContext.service")

async function extractRoutes(fastify) {
  fastify.post(
    "/extract",
    {
      preHandler: [
        attachGatewayKeyFromSessionBody,
        rateLimitByApiKey,
        concurrencyGuard
      ]
    },
    async (request, reply) => {
      try {
        const apiKeyRecord = request.apiKeyRecord

        if (!apiKeyRecord) {
          return reply.code(401).send({
            error: "Não foi possível resolver a chave gateway da sessão"
          })
        }

        const workloadCategory = request.workload?.category || "heavy"

        const {
          sessionId,
          model = "openai/gpt-4o-mini",
          messages = [],
          temperature = 0.2,
          max_tokens = 300,
          response_format = null,
          extraction_profile = "generic_document"
        } = request.body || {}

        if (!sessionId) {
          return reply.code(400).send({
            error: "sessionId é obrigatório para /extract"
          })
        }

        const normalizedMessages = normalizeMessages(messages)
        const lastUserMessage = getLastUserMessage(normalizedMessages)

        if (!lastUserMessage) {
          return reply.code(400).send({
            error: "É necessário ao menos uma mensagem do usuário com content"
          })
        }

        if (!response_format) {
          return reply.code(400).send({
            error: "response_format é obrigatório em /extract"
          })
        }

        const validTypes = ["json_object", "json_schema"]

        if (!response_format.type || !validTypes.includes(response_format.type)) {
          return reply.code(400).send({
            error: "response_format.type inválido"
          })
        }

        if (
          response_format.type === "json_schema" &&
          (!response_format.json_schema ||
            !response_format.json_schema.name ||
            !response_format.json_schema.schema)
        ) {
          return reply.code(400).send({
            error: "json_schema inválido em response_format"
          })
        }

        const result = await chatService.sendMessage({
          sessionId,
          apiKeyId: apiKeyRecord.id,
          messages: normalizedMessages,
          model,
          temperature,
          maxTokens: max_tokens,
          responseFormat: response_format,
          extractionProfile: extraction_profile,
          routeType: "extract",
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
          error: "Erro ao processar extração",
          details: error.message
        })
      }
    }
  )
}

module.exports = extractRoutes