
const {
  runMaintenanceForAllApiKeys
} = require("../services/maintenance.service")

async function adminMaintenanceRoutes(fastify) {
  fastify.post("/admin/maintenance/run", async (request, reply) => {
    try {
      const adminSecret = request.headers["x-admin-secret"]

      if (!process.env.ADMIN_MAINTENANCE_SECRET) {
        return reply.code(500).send({
          error: "ADMIN_MAINTENANCE_SECRET não configurado"
        })
      }

      if (!adminSecret || adminSecret !== process.env.ADMIN_MAINTENANCE_SECRET) {
        return reply.code(401).send({
          error: "Acesso não autorizado"
        })
      }

      const result = await runMaintenanceForAllApiKeys()

      return reply.send(result)
    } catch (error) {
      console.error(error)

      return reply.code(500).send({
        error: "Erro ao executar manutenção",
        details: error.message
      })
    }
  })
}

module.exports = adminMaintenanceRoutes