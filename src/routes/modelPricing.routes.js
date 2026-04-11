const modelPricingService = require("../services/modelPricing.service")

async function modelPricingRoutes(fastify) {
  fastify.get("/model-pricing", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const items = await modelPricingService.listModelPricing()

      return reply.send({
        items
      })
    } catch (error) {
      console.error(error)

      return reply.code(500).send({
        error: "Erro ao listar preços de modelos",
        details: error.message
      })
    }
  })

  fastify.post("/model-pricing", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const {
        provider,
        model,
        inputPer1k,
        outputPer1k,
        currency = "USD",
        isActive = true
      } = request.body || {}

      if (!provider || !model) {
        return reply.code(400).send({
          error: "provider e model são obrigatórios"
        })
      }

      if (typeof inputPer1k !== "number" || typeof outputPer1k !== "number") {
        return reply.code(400).send({
          error: "inputPer1k e outputPer1k devem ser números"
        })
      }

      const saved = await modelPricingService.upsertModelPricing({
        provider,
        model,
        inputPer1k,
        outputPer1k,
        currency,
        isActive
      })

      return reply.send(saved)
    } catch (error) {
      console.error(error)

      return reply.code(500).send({
        error: "Erro ao salvar preço do modelo",
        details: error.message
      })
    }
  })
}

module.exports = modelPricingRoutes
