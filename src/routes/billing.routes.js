const apiKeyService = require("../services/apiKey.service")
const billingCatalogService = require("../services/billingCatalog.service")
const subscriptionService = require("../services/subscription.service")
const { resolveEffectiveConfig } = require("../services/billingConfig.service")

async function billingRoutes(fastify) {
  fastify.post("/billing/seed", async (request, reply) => {
    try {
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
      const apiKey = request.headers["x-api-key"]

      if (!apiKey) {
        return reply.code(401).send({
          error: "API key obrigatória"
        })
      }

      const apiKeyRecord = await apiKeyService.findApiKeyByKey(apiKey)

      if (!apiKeyRecord) {
        return reply.code(401).send({
          error: "API key inválida"
        })
      }

      const subscription =
        await subscriptionService.getActiveSubscriptionByApiKeyId(apiKeyRecord.id)

      if (!subscription) {
        return reply.send({
          subscription: null,
          effectiveConfig: null
        })
      }

      return reply.send({
        subscription,
        effectiveConfig: resolveEffectiveConfig(subscription)
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
      const apiKey = request.headers["x-api-key"]

      if (!apiKey) {
        return reply.code(401).send({
          error: "API key obrigatória"
        })
      }

      const apiKeyRecord = await apiKeyService.findApiKeyByKey(apiKey)

      if (!apiKeyRecord) {
        return reply.code(401).send({
          error: "API key inválida"
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
        apiKeyId: apiKeyRecord.id,
        planCode,
        addonCodes
      })

      return reply.send({
        subscription,
        effectiveConfig: resolveEffectiveConfig(subscription)
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
      const apiKey = request.headers["x-api-key"]

      if (!apiKey) {
        return reply.code(401).send({
          error: "API key obrigatória"
        })
      }

      const apiKeyRecord = await apiKeyService.findApiKeyByKey(apiKey)

      if (!apiKeyRecord) {
        return reply.code(401).send({
          error: "API key inválida"
        })
      }

      const subscription =
        await subscriptionService.getActiveSubscriptionByApiKeyId(apiKeyRecord.id)

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
        await subscriptionService.getActiveSubscriptionByApiKeyId(apiKeyRecord.id)

      return reply.send({
        subscription: updated,
        effectiveConfig: resolveEffectiveConfig(updated)
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