const { FEATURE_PRESETS, DEFAULT_PLANS, DEFAULT_ADDONS } = require("../config/billingCatalog")

function mapFeaturePreset(featureKey, presetKey) {
  const featureGroup = FEATURE_PRESETS[featureKey] || {}
  return featureGroup[presetKey] || null
}

function centsToCurrency(cents = 0) {
  return Number((cents / 100).toFixed(2))
}

function resolveEffectiveConfig(subscription) {
  if (!subscription) {
    return null
  }

  const features = {}

  for (const preset of subscription.plan.featurePresets || []) {
    features[preset.featureKey] = {
      source: "plan",
      presetKey: preset.presetKey,
      config: mapFeaturePreset(preset.featureKey, preset.presetKey)
    }
  }

  for (const addonItem of subscription.addons || []) {
    const addon = addonItem.addon
    if (!addon) continue

    features[addon.featureKey] = {
      source: "addon",
      presetKey: addon.presetKey,
      config: mapFeaturePreset(addon.featureKey, addon.presetKey)
    }
  }

  for (const override of subscription.overrides || []) {
    features[override.featureKey] = {
      source: "override",
      presetKey: override.presetKey,
      config: mapFeaturePreset(override.featureKey, override.presetKey)
    }
  }

  const basePriceCents = subscription.plan.priceCents || 0
  const addonsPriceCents = (subscription.addons || []).reduce(
    (acc, item) => acc + (item.addon?.priceCents || 0),
    0
  )

  return {
    subscriptionId: subscription.id,
    plan: {
      code: subscription.plan.code,
      name: subscription.plan.name,
      type: subscription.plan.type,
      price: centsToCurrency(basePriceCents),
      priceCents: basePriceCents,
      currency: subscription.plan.currency || "BRL"
    },
    addons: (subscription.addons || []).map((item) => ({
      code: item.addon.code,
      name: item.addon.name,
      featureKey: item.addon.featureKey,
      presetKey: item.addon.presetKey,
      price: centsToCurrency(item.addon.priceCents || 0),
      priceCents: item.addon.priceCents || 0
    })),
    pricing: {
      basePrice: centsToCurrency(basePriceCents),
      addonsPrice: centsToCurrency(addonsPriceCents),
      totalPrice: centsToCurrency(basePriceCents + addonsPriceCents),
      totalPriceCents: basePriceCents + addonsPriceCents,
      currency: subscription.plan.currency || "BRL"
    },
    features
  }
}

function buildOperationalLimits(planCode = "") {
  const defaults = {
    maxInputChars: 15000,
    maxSchemaFields: 40,
    maxRelevantBlocks: 8,
    maxCandidateHints: 30
  }

  const map = {
    flex_start: {
      maxInputChars: 15000,
      maxSchemaFields: 40,
      maxRelevantBlocks: 8,
      maxCandidateHints: 30
    },
    flex_pro: {
      maxInputChars: 35000,
      maxSchemaFields: 80,
      maxRelevantBlocks: 12,
      maxCandidateHints: 50
    },
    prime_start: {
      maxInputChars: 25000,
      maxSchemaFields: 60,
      maxRelevantBlocks: 10,
      maxCandidateHints: 40
    },
    prime_pro: {
      maxInputChars: 50000,
      maxSchemaFields: 120,
      maxRelevantBlocks: 16,
      maxCandidateHints: 60
    }
  }

  return map[planCode] || defaults
}

function buildRateLimitPolicy(planCode = "") {
  const defaults = {
    perMinute: 30,
    burst: 10,
    windowSeconds: 60
  }

  const map = {
    flex_start: {
      perMinute: 60,
      burst: 20,
      windowSeconds: 60
    },
    flex_pro: {
      perMinute: 180,
      burst: 60,
      windowSeconds: 60
    },
    prime_start: {
      perMinute: 100,
      burst: 30,
      windowSeconds: 60
    },
    prime_pro: {
      perMinute: 300,
      burst: 100,
      windowSeconds: 60
    }
  }

  return map[planCode] || defaults
}

function buildConcurrencyPolicy(planCode = "") {
  const defaults = {
    lightMaxInFlight: 15,
    mediumMaxInFlight: 6,
    heavyMaxInFlight: 2,
    heavyQueueWaitMs: 4000,
    pollIntervalMs: 250
  }

  const map = {
    flex_start: {
      lightMaxInFlight: 30,
      mediumMaxInFlight: 8,
      heavyMaxInFlight: 2,
      heavyQueueWaitMs: 5000,
      pollIntervalMs: 250
    },
    flex_pro: {
      lightMaxInFlight: 80,
      mediumMaxInFlight: 20,
      heavyMaxInFlight: 5,
      heavyQueueWaitMs: 8000,
      pollIntervalMs: 250
    },
    prime_start: {
      lightMaxInFlight: 50,
      mediumMaxInFlight: 12,
      heavyMaxInFlight: 3,
      heavyQueueWaitMs: 6000,
      pollIntervalMs: 250
    },
    prime_pro: {
      lightMaxInFlight: 120,
      mediumMaxInFlight: 30,
      heavyMaxInFlight: 8,
      heavyQueueWaitMs: 10000,
      pollIntervalMs: 250
    }
  }

  return map[planCode] || defaults
}

function resolveRuntimePolicy(effectiveConfig) {
  if (!effectiveConfig) {
    return {
      planCode: "no_plan",
      planType: null,
      cache: {
        ttlHours: 24,
        ttlSeconds: 24 * 60 * 60
      },
      history: {
        retentionDays: 30
      },
      memory: {
        retentionDays: 30,
        maxItems: 500
      },
      semantic: {
        maxRecords: 10000
      },
      analytics: {
        retentionDays: 30
      },
      limits: buildOperationalLimits("flex_start"),
      rateLimit: buildRateLimitPolicy("flex_start"),
      concurrency: buildConcurrencyPolicy("flex_start")
    }
  }

  const cacheConfig = effectiveConfig.features?.cache_inteligente?.config || {}
  const historyConfig =
    effectiveConfig.features?.historico_operacional?.config || {}
  const memoryConfig = effectiveConfig.features?.memoria_conteudo?.config || {}
  const semanticConfig =
    effectiveConfig.features?.base_inteligente?.config || {}
  const analyticsConfig = effectiveConfig.features?.analytics?.config || {}

  const ttlHours = cacheConfig.ttlHours || 24

  return {
    planCode: effectiveConfig.plan.code,
    planType: effectiveConfig.plan.type,
    cache: {
      ttlHours,
      ttlSeconds: ttlHours * 60 * 60
    },
    history: {
      retentionDays: historyConfig.retentionDays || 30
    },
    memory: {
      retentionDays: memoryConfig.retentionDays || 30,
      maxItems: memoryConfig.maxItems || 500
    },
    semantic: {
      maxRecords: semanticConfig.maxRecords || 10000
    },
    analytics: {
      retentionDays: analyticsConfig.retentionDays || 30
    },
    limits: buildOperationalLimits(effectiveConfig.plan.code),
    rateLimit: buildRateLimitPolicy(effectiveConfig.plan.code),
    concurrency: buildConcurrencyPolicy(effectiveConfig.plan.code)
  }
}

function getPlanCatalogSummary() {
  return DEFAULT_PLANS.map((plan) => ({
    code: plan.code,
    name: plan.name,
    type: plan.type,
    price: centsToCurrency(plan.priceCents),
    priceCents: plan.priceCents,
    featurePresets: plan.featurePresets
  }))
}

function getAddonCatalogSummary() {
  return DEFAULT_ADDONS.map((addon) => ({
    code: addon.code,
    name: addon.name,
    featureKey: addon.featureKey,
    presetKey: addon.presetKey,
    price: centsToCurrency(addon.priceCents),
    priceCents: addon.priceCents
  }))
}

module.exports = {
  resolveEffectiveConfig,
  resolveRuntimePolicy,
  getPlanCatalogSummary,
  getAddonCatalogSummary
}