const userService = require("../services/user.service")

async function usersRoutes(fastify) {
  fastify.post("/users", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { email, name } = request.body || {}

      const user = await userService.createUser({ email, name })

      return reply.code(201).send(user)
    } catch (error) {
      request.log.error(error)

      return reply.code(500).send({
        error: "Erro ao criar usuário",
        details: error.message
      })
    }
  })
}

module.exports = usersRoutes
