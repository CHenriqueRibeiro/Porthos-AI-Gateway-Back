const billingCatalogService = require("../services/billingCatalog.service")
const subscriptionService = require("../services/subscription.service")
const { resolveEffectiveConfig } = require("../services/billingConfig.service")
const apiKeyService = require("../services/apiKey.service")

async function billingRoutes(fastify) {
  fastify.post("/billing/seed", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const result = await billingCatalogService.seedPlansAndAddons()
      return reply.send(result)
    } catch (error) {
      console.error(error)
      return reply.code(500).send({
        error: "Erro ao popular catálogo de billing",
        details: error.message
      })
    }
  })

  fastify.get("/plans", async (request, reply) => {
    try {
      const authUser = request.authUser

      if (!authUser) {
        return reply.code(401).send({
          error: "Token de acesso obrigatório"
        })
      }

      const plans = await billingCatalogService.listPlans()
      const addons = await billingCatalogService.listAddons()

      return reply.send({
        plans,
        addons
      })
    } catch (error) {
      console.error(error)
      return reply.code(500).send({
        error: "Erro ao listar planos",
        details: error.message
      })
    }
  })

  fastify.get("/subscriptions/current", async (request, reply) => {
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
          hint: "Use ?apiKeyId=<uuid> para escolher qual chave gateway (opcional: usa a mais antiga)."
        })
      }

      const subscription =
        await subscriptionService.getActiveSubscriptionByApiKeyId(scopedApiKeyId)

      if (!subscription) {
        return reply.send({
          subscription: null,
          effectiveConfig: null,
          apiKeyId: scopedApiKeyId
        })
      }

      return reply.send({
        subscription,
        effectiveConfig: resolveEffectiveConfig(subscription),
        apiKeyId: scopedApiKeyId
      })
    } catch (error) {
      console.error(error)
      return reply.code(500).send({
        error: "Erro ao buscar assinatura atual",
        details: error.message
      })
    }
  })

  fastify.post("/subscriptions", async (request, reply) => {
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
        planCode,
        addonCodes = []
      } = request.body || {}

      if (!planCode) {
        return reply.code(400).send({
          error: "planCode é obrigatório"
        })
      }

      const subscription = await subscriptionService.createOrReplaceSubscription({
        apiKeyId: scopedApiKeyId,
        planCode,
        addonCodes
      })

      return reply.send({
        subscription,
        effectiveConfig: resolveEffectiveConfig(subscription),
        apiKeyId: scopedApiKeyId
      })
    } catch (error) {
      console.error(error)
      return reply.code(500).send({
        error: "Erro ao criar assinatura",
        details: error.message
      })
    }
  })

  fastify.post("/subscriptions/override", async (request, reply) => {
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

      const subscription =
        await subscriptionService.getActiveSubscriptionByApiKeyId(scopedApiKeyId)

      if (!subscription) {
        return reply.code(404).send({
          error: "Assinatura ativa não encontrada"
        })
      }

      const {
        featureKey,
        presetKey
      } = request.body || {}

      if (!featureKey || !presetKey) {
        return reply.code(400).send({
          error: "featureKey e presetKey são obrigatórios"
        })
      }

      await subscriptionService.setConfigOverride({
        subscriptionId: subscription.id,
        featureKey,
        presetKey
      })

      const updated =
        await subscriptionService.getActiveSubscriptionByApiKeyId(scopedApiKeyId)

      return reply.send({
        subscription: updated,
        effectiveConfig: resolveEffectiveConfig(updated),
        apiKeyId: scopedApiKeyId
      })
    } catch (error) {
      console.error(error)
      return reply.code(500).send({
        error: "Erro ao aplicar override",
        details: error.message
      })
    }
  })
}

module.exports = billingRoutes
