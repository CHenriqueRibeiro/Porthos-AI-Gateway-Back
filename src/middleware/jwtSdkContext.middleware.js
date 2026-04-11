const sessionService = require("../services/session.service")

async function attachGatewayKeyFromSessionBody(request, reply) {
  const authUser = request.authUser

  if (!authUser) {
    return reply.code(401).send({
      error: "Token de acesso obrigatório"
    })
  }

  const sessionId = request.body?.sessionId

  if (!sessionId) {
    return reply.code(400).send({
      error: "sessionId é obrigatório"
    })
  }

  const session = await sessionService.getSessionWithApiKeyForUser({
    sessionId,
    userId: authUser.id
  })

  if (!session?.apiKey) {
    return reply.code(404).send({
      error: "Sessão não encontrada"
    })
  }

  request.apiKeyRecord = session.apiKey
}

module.exports = {
  attachGatewayKeyFromSessionBody
}
