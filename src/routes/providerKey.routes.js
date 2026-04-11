const providerKeyService = require("../services/providerKey.service")
const { validateProviderKey } = require("../services/providerValidation.service")
const apiKeyService = require("../services/apiKey.service")

async function providerKeyRoutes(fastify) {
  fastify.get("/provider-keys", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { apiKeyId: apiKeyIdQuery } = request.query || {}

      const scopedApiKeyId = await apiKeyService.resolveAccountScopedApiKeyId({
        userId: authUser.id,
        apiKeyId:
          typeof apiKeyIdQuery === "string" && apiKeyIdQuery.trim()
            ? apiKeyIdQuery.trim()
            : null
      })

      if (!scopedApiKeyId) {
        return reply.code(400).send({
          error: "Nenhuma API key no usuário ou apiKeyId inválido",
          hint: "Use ?apiKeyId=<uuid> para escolher em qual chave gateway listar as provider keys."
        })
      }

      const items = await providerKeyService.listProviderKeys(scopedApiKeyId)

      return reply.send({
        apiKeyId: scopedApiKeyId,
        items: items.map((item) => ({
          id: item.id,
          provider: item.provider,
          label: item.label,
          isDefault: item.isDefault,
          isActive: item.isActive,
          validationStatus: item.validationStatus,
          validationMessage: item.validationMessage,
          lastValidatedAt: item.lastValidatedAt,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }))
      })
    } catch (error) {
      console.error(error)

      return reply.code(500).send({
        error: "Erro ao listar provider keys",
        details: error.message
      })
    }
  })

  fastify.post("/provider-keys", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { apiKeyId: apiKeyIdQuery } = request.query || {}

      const scopedApiKeyId = await apiKeyService.resolveAccountScopedApiKeyId({
        userId: authUser.id,
        apiKeyId:
          typeof apiKeyIdQuery === "string" && apiKeyIdQuery.trim()
            ? apiKeyIdQuery.trim()
            : null
      })

      if (!scopedApiKeyId) {
        return reply.code(400).send({
          error: "Nenhuma API key no usuário ou apiKeyId inválido",
          hint: "Use ?apiKeyId=<uuid> na URL."
        })
      }

      const {
        provider,
        apiKey,
        label = null,
        isDefault = true
      } = request.body || {}

      const allowedProviders = ["openai", "anthropic", "gemini"]

      if (!provider || !allowedProviders.includes(provider)) {
        return reply.code(400).send({
          error: "provider inválido. Use openai, anthropic ou gemini"
        })
      }

      if (!apiKey || typeof apiKey !== "string") {
        return reply.code(400).send({
          error: "apiKey é obrigatória"
        })
      }

      const validation = await validateProviderKey(provider, apiKey)

      if (!validation.isValid) {
        return reply.code(validation.statusCode || 400).send({
          error: "Provider key inválida",
          details: validation.validationMessage,
          validationStatus: validation.validationStatus
        })
      }

      const saved = await providerKeyService.createProviderKey({
        apiKeyId: scopedApiKeyId,
        provider,
        apiKey,
        label,
        isDefault,
        validationStatus: validation.validationStatus,
        validationMessage: validation.validationMessage
      })

      return reply.send({
        apiKeyId: scopedApiKeyId,
        id: saved.id,
        provider: saved.provider,
        label: saved.label,
        isDefault: saved.isDefault,
        isActive: saved.isActive,
        validationStatus: saved.validationStatus,
        validationMessage: saved.validationMessage,
        lastValidatedAt: saved.lastValidatedAt,
        createdAt: saved.createdAt
      })
    } catch (error) {
      console.error(error)

      return reply.code(500).send({
        error: "Erro ao salvar provider key",
        details: error.message
      })
    }
  })

  fastify.patch("/provider-keys/:id/default", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { apiKeyId: apiKeyIdQuery } = request.query || {}

      const scopedApiKeyId = await apiKeyService.resolveAccountScopedApiKeyId({
        userId: authUser.id,
        apiKeyId:
          typeof apiKeyIdQuery === "string" && apiKeyIdQuery.trim()
            ? apiKeyIdQuery.trim()
            : null
      })

      if (!scopedApiKeyId) {
        return reply.code(400).send({
          error: "Nenhuma API key no usuário ou apiKeyId inválido",
          hint: "Use ?apiKeyId=<uuid> na URL."
        })
      }

      const { id } = request.params

      const updated = await providerKeyService.setDefaultProviderKey(
        id,
        scopedApiKeyId
      )

      return reply.send({
        apiKeyId: scopedApiKeyId,
        id: updated.id,
        provider: updated.provider,
        label: updated.label,
        isDefault: updated.isDefault,
        isActive: updated.isActive,
        validationStatus: updated.validationStatus,
        validationMessage: updated.validationMessage,
        updatedAt: updated.updatedAt
      })
    } catch (error) {
      console.error(error)

      return reply.code(500).send({
        error: "Erro ao definir provider key padrão",
        details: error.message
      })
    }
  })

  fastify.delete("/provider-keys/:id", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const { apiKeyId: apiKeyIdQuery } = request.query || {}

      const scopedApiKeyId = await apiKeyService.resolveAccountScopedApiKeyId({
        userId: authUser.id,
        apiKeyId:
          typeof apiKeyIdQuery === "string" && apiKeyIdQuery.trim()
            ? apiKeyIdQuery.trim()
            : null
      })

      if (!scopedApiKeyId) {
        return reply.code(400).send({
          error: "Nenhuma API key no usuário ou apiKeyId inválido",
          hint: "Use ?apiKeyId=<uuid> na URL."
        })
      }

      const { id } = request.params

      await providerKeyService.deleteProviderKey(id, scopedApiKeyId)

      return reply.send({
        success: true,
        apiKeyId: scopedApiKeyId
      })
    } catch (error) {
      console.error(error)

      return reply.code(500).send({
        error: "Erro ao remover provider key",
        details: error.message
      })
    }
  })
}

module.exports = providerKeyRoutes
