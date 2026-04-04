const authService = require("../services/auth.service")

async function authRoutes(fastify) {
  fastify.post("/auth/register", async (request, reply) => {
    try {
      const { name, email, password, planCode } = request.body || {}

      if (!name || !email || !password || !planCode) {
        return reply.code(400).send({
          error: "name, email, password e planCode são obrigatórios"
        })
      }

      const result = await authService.registerUser({
        name,
        email,
        password,
        planCode
      })

      return reply.code(201).send(result)
    } catch (error) {
      request.log.error(error)

      if (error.message === "Email já cadastrado") {
        return reply.code(409).send({ error: error.message })
      }

      if (error.message === "Plano não encontrado ou inativo") {
        return reply.code(400).send({ error: error.message })
      }

      return reply.code(500).send({
        error: "Erro ao cadastrar usuário",
        details: error.message
      })
    }
  })

  fastify.post("/auth/login", async (request, reply) => {
    try {
      const { email, password } = request.body || {}

      if (!email || !password) {
        return reply.code(400).send({
          error: "email e password são obrigatórios"
        })
      }

      const result = await authService.loginUser({
        email,
        password
      })

      return reply.send(result)
    } catch (error) {
      request.log.error(error)

      if (error.message === "Credenciais inválidas") {
        return reply.code(401).send({ error: error.message })
      }

      return reply.code(500).send({
        error: "Erro ao realizar login",
        details: error.message
      })
    }
  })

  fastify.post("/auth/logout", async (request, reply) => {
    try {
      const result = await authService.logoutUser()
      return reply.send(result)
    } catch (error) {
      request.log.error(error)

      return reply.code(500).send({
        error: "Erro ao realizar logout",
        details: error.message
      })
    }
  })
}

module.exports = authRoutes