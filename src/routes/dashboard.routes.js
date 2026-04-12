const dashboardService = require("../services/dashboard.service")

async function dashboardRoutes(fastify) {
  fastify.get("/me/dashboard", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { day, startDate, endDate, includeDaily } = request.query

      const result = await dashboardService.getDashboardOverviewByUser(authUser.id, {
        day,
        startDate,
        endDate,
        includeDaily
      })

      return reply.send(result)
    } catch (error) {
      request.log.error(error)

      return reply.code(500).send({
        error: "Erro ao buscar dashboard consolidado",
        details: error.message
      })
    }
  })
}

module.exports = dashboardRoutes