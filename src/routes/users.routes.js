const userService = require("../services/user.service")

async function usersRoutes(fastify) {
  fastify.post("/users", async (request, reply) => {
    const { email, name } = request.body

    const user = await userService.createUser({ email, name })

    return reply.code(201).send(user)
  })
}

module.exports = usersRoutes