const {
  getPlanCatalogSummary,
  getAddonCatalogSummary
} = require("../services/billingConfig.service")
const {
  simulatePlan,
  recommendPlan
} = require("../services/planSimulator.service")

async function publicSimulatorRoutes(fastify) {
  fastify.get("/public/plans", async (request, reply) => {
    try {
      return reply.send({
        plans: getPlanCatalogSummary(),
        addons: getAddonCatalogSummary()
      })
    } catch (error) {
      console.error(error)

      return reply.code(500).send({
        error: "Erro ao listar catálogo público",
        details: error.message
      })
    }
  })

  fastify.post("/public/plans/simulate", async (request, reply) => {
    try {
      const {
        planCode,
        addonCodes = [],
        overrides = {}
      } = request.body || {}

      if (!planCode) {
        return reply.code(400).send({
          error: "planCode é obrigatório"
        })
      }

      const simulation = simulatePlan({
        planCode,
        addonCodes,
        overrides
      })

      return reply.send(simulation)
    } catch (error) {
      console.error(error)

      return reply.code(400).send({
        error: error.message || "Erro ao simular plano"
      })
    }
  })

  fastify.post("/public/plans/recommend", async (request, reply) => {
    try {
      const {
        estimatedRequestsPerMonth = 0,
        wantsManaged = false,
        wantsAdvancedRetention = false,
        wantsLargerSemanticBase = false
      } = request.body || {}

      const recommendedPlanCode = recommendPlan({
        estimatedRequestsPerMonth,
        wantsManaged,
        wantsAdvancedRetention,
        wantsLargerSemanticBase
      })

      const simulation = simulatePlan({
        planCode: recommendedPlanCode
      })

      return reply.send({
        recommendedPlanCode,
        simulation
      })
    } catch (error) {
      console.error(error)

      return reply.code(500).send({
        error: "Erro ao recomendar plano",
        details: error.message
      })
    }
  })
}

module.exports = publicSimulatorRoutes