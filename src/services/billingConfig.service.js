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

function buildOperationalLimits(planCode = "free") {
  const map = {
    free: {
      maxInputChars: 8000,
      maxSchemaFields: 20,
      maxRelevantBlocks: 4,
      maxCandidateHints: 15
    },
    starter: {
      maxInputChars: 15000,
      maxSchemaFields: 40,
      maxRelevantBlocks: 8,
      maxCandidateHints: 30
    },
    growth: {
      maxInputChars: 35000,
      maxSchemaFields: 80,
      maxRelevantBlocks: 12,
      maxCandidateHints: 50
    },
    pro: {
      maxInputChars: 50000,
      maxSchemaFields: 120,
      maxRelevantBlocks: 16,
      maxCandidateHints: 60
    },
    scale: {
      maxInputChars: 100000,
      maxSchemaFields: 200,
      maxRelevantBlocks: 24,
      maxCandidateHints: 100
    }
  }

  return map[planCode] || map.free
}

function buildRateLimitPolicy(planCode = "free") {
  const map = {
    free: {
      perMinute: 20,
      burst: 5,
      windowSeconds: 60
    },
    starter: {
      perMinute: 60,
      burst: 20,
      windowSeconds: 60
    },
    growth: {
      perMinute: 180,
      burst: 60,
      windowSeconds: 60
    },
    pro: {
      perMinute: 300,
      burst: 100,
      windowSeconds: 60
    },
    scale: {
      perMinute: 600,
      burst: 200,
      windowSeconds: 60
    }
  }

  return map[planCode] || map.free
}

function resolveRuntimePolicy(effectiveConfig) {
  if (!effectiveConfig) {
    return {
      planCode: "no_plan",
      planType: null,
      cache: {
        enabled: false,
        redisEnabled: false,
        semanticEnabled: false,
        ttlHours: 0,
        ttlSeconds: 0
      },
      history: {
        retentionDays: 30
      },
      memory: {
        retentionDays: 30,
        maxItems: 500
      },
      semantic: {
        maxRecords: 0,
        retentionDays: 0
      },
      analytics: {
        retentionDays: 30
      },
      storage: {
        storageMb: 50
      },
      limits: {
        ...buildOperationalLimits("free"),
        maxApiKeys: 1,
        storageMb: 50
      },
      rateLimit: buildRateLimitPolicy("free"),
      concurrency: FEATURE_PRESETS.concurrency.baixa
    }
  }

  const cacheConfig = effectiveConfig.features?.cache_inteligente?.config || {}
  const historyConfig =
    effectiveConfig.features?.historico_operacional?.config || {}
  const memoryConfig = effectiveConfig.features?.memoria_conteudo?.config || {}
  const semanticConfig =
    effectiveConfig.features?.base_inteligente?.config || {}
  const analyticsConfig = effectiveConfig.features?.analytics?.config || {}
  const apiKeysConfig = effectiveConfig.features?.api_keys?.config || {}
  const storageConfig = effectiveConfig.features?.storage?.config || {}
  const concurrencyConfig = effectiveConfig.features?.concurrency?.config || {}
  const isFreePlan =
    effectiveConfig.plan.type === "free" ||
    effectiveConfig.plan.code === "free" ||
    effectiveConfig.plan.code === "free_trial"

  const cacheEnabled = !isFreePlan && cacheConfig.enabled !== false
  const redisEnabled = cacheEnabled && cacheConfig.redisEnabled !== false
  const semanticEnabled = cacheEnabled && cacheConfig.semanticEnabled !== false
  const ttlHours = cacheEnabled ? (cacheConfig.ttlHours || 24) : 0

  return {
    planCode: effectiveConfig.plan.code,
    planType: effectiveConfig.plan.type,
    cache: {
      enabled: cacheEnabled,
      redisEnabled,
      semanticEnabled,
      ttlHours,
      ttlSeconds: ttlHours * 60 * 60,
      semanticRetentionDays: semanticEnabled
        ? (cacheConfig.semanticRetentionDays || 1)
        : 0
    },
    history: {
      retentionDays: historyConfig.retentionDays || 30
    },
    memory: {
      enabled: memoryConfig.enabled !== false,
      retentionDays: memoryConfig.retentionDays ?? 30,
      maxItems: memoryConfig.maxItems ?? 500
    },
    semantic: {
      maxRecords: semanticEnabled ? (semanticConfig.maxRecords || 10000) : 0,
      retentionDays: semanticEnabled
        ? (cacheConfig.semanticRetentionDays || 1)
        : 0
    },
    analytics: {
      level: analyticsConfig.level || "basic",
      retentionDays: analyticsConfig.retentionDays || 30
    },
    storage: {
      storageMb: storageConfig.storageMb || 50
    },
    limits: {
      ...buildOperationalLimits(effectiveConfig.plan.code),
      maxApiKeys: apiKeysConfig.maxApiKeys || 1,
      storageMb: storageConfig.storageMb || 50
    },
    rateLimit: buildRateLimitPolicy(effectiveConfig.plan.code),
    concurrency: {
      ...FEATURE_PRESETS.concurrency.baixa,
      ...concurrencyConfig
    }
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
    priceCents: addon.priceCents,
    allowedPlans: addon.allowedPlans || []
  }))
}

module.exports = {
  resolveEffectiveConfig,
  resolveRuntimePolicy,
  getPlanCatalogSummary,
  getAddonCatalogSummary
}
