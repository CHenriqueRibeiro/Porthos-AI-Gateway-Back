const {
  DEFAULT_PLANS,
  DEFAULT_ADDONS,
  FEATURE_PRESETS
} = require("../config/billingCatalog")

function centsToCurrency(cents = 0) {
  return Number((cents / 100).toFixed(2))
}

function mapPreset(featureKey, presetKey) {
  return FEATURE_PRESETS?.[featureKey]?.[presetKey] || null
}

function findPlanByCode(planCode) {
  return DEFAULT_PLANS.find((plan) => plan.code === planCode) || null
}

function findAddonsByCodes(addonCodes = []) {
  return DEFAULT_ADDONS.filter((addon) => addonCodes.includes(addon.code))
}

function simulatePlan({
  planCode,
  addonCodes = [],
  overrides = {}
}) {
  const plan = findPlanByCode(planCode)

  if (!plan) {
    throw new Error("Plano não encontrado")
  }

  const addons = findAddonsByCodes(addonCodes)
  const features = {}

  for (const [featureKey, presetKey] of Object.entries(plan.featurePresets || {})) {
    features[featureKey] = {
      source: "plan",
      presetKey,
      config: mapPreset(featureKey, presetKey)
    }
  }

  for (const addon of addons) {
    features[addon.featureKey] = {
      source: "addon",
      presetKey: addon.presetKey,
      config: mapPreset(addon.featureKey, addon.presetKey)
    }
  }

  for (const [featureKey, presetKey] of Object.entries(overrides || {})) {
    if (!mapPreset(featureKey, presetKey)) continue

    features[featureKey] = {
      source: "override",
      presetKey,
      config: mapPreset(featureKey, presetKey)
    }
  }

  const addonsPriceCents = addons.reduce((acc, addon) => acc + addon.priceCents, 0)
  const totalPriceCents = plan.priceCents + addonsPriceCents

  return {
    plan: {
      code: plan.code,
      name: plan.name,
      type: plan.type,
      price: centsToCurrency(plan.priceCents),
      priceCents: plan.priceCents
    },
    addons: addons.map((addon) => ({
      code: addon.code,
      name: addon.name,
      featureKey: addon.featureKey,
      presetKey: addon.presetKey,
      price: centsToCurrency(addon.priceCents),
      priceCents: addon.priceCents
    })),
    pricing: {
      basePrice: centsToCurrency(plan.priceCents),
      addonsPrice: centsToCurrency(addonsPriceCents),
      totalPrice: centsToCurrency(totalPriceCents),
      totalPriceCents
    },
    features
  }
}

function recommendPlan({
  estimatedRequestsPerMonth = 0,
  wantsManaged = false,
  wantsAdvancedRetention = false,
  wantsLargerSemanticBase = false
}) {
  if (wantsManaged) {
    if (
      estimatedRequestsPerMonth > 20000 ||
      wantsAdvancedRetention ||
      wantsLargerSemanticBase
    ) {
      return "prime_pro"
    }

    return "prime_start"
  }

  if (
    estimatedRequestsPerMonth > 20000 ||
    wantsAdvancedRetention ||
    wantsLargerSemanticBase
  ) {
    return "flex_pro"
  }

  return "flex_start"
}

module.exports = {
  simulatePlan,
  recommendPlan
}