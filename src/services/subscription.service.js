const prisma = require("../db/prisma")
const {
  DEFAULT_PLANS,
  DEFAULT_ADDONS,
  PLAN_ORDER
} = require("../config/billingCatalog")

function getCatalogPlan(code) {
  return DEFAULT_PLANS.find((plan) => plan.code === code) || null
}

function getNextPlan(code) {
  const index = PLAN_ORDER.indexOf(code)
  if (index === -1 || index >= PLAN_ORDER.length - 1) return null

  return getCatalogPlan(PLAN_ORDER[index + 1])
}

function validateAddonComposition({ planCode, addonCodes = [], addons = [] }) {
  const catalogPlan = getCatalogPlan(planCode)

  if (!catalogPlan) {
    throw new Error("Plano n\u00e3o encontrado no cat\u00e1logo runtime")
  }

  const unknownAddonCodes = addonCodes.filter(
    (code) => !DEFAULT_ADDONS.some((addon) => addon.code === code)
  )

  if (unknownAddonCodes.length > 0) {
    throw new Error(`Add-on inv\u00e1lido: ${unknownAddonCodes.join(", ")}`)
  }

  for (const addon of addons) {
    const catalogAddon = DEFAULT_ADDONS.find((item) => item.code === addon.code)
    const allowedPlans = catalogAddon?.allowedPlans || []

    if (allowedPlans.length > 0 && !allowedPlans.includes(planCode)) {
      throw new Error(
        `Add-on ${addon.code} n\u00e3o permitido no plano ${planCode}; fa\u00e7a upgrade de plano.`
      )
    }
  }

  const featureKeys = addons.map((addon) => addon.featureKey)
  const duplicatedFeature = featureKeys.find(
    (featureKey, index) => featureKeys.indexOf(featureKey) !== index
  )

  if (duplicatedFeature) {
    throw new Error(
      `Escolha apenas um add-on por recurso. Recurso duplicado: ${duplicatedFeature}`
    )
  }

  const addonsPriceCents = addons.reduce(
    (acc, addon) => acc + (addon.priceCents || 0),
    0
  )

  if (addonsPriceCents > (catalogPlan.addonBudgetCents || 0)) {
    const nextPlan = getNextPlan(planCode)
    const upgradeHint = nextPlan
      ? ` Recomenda\u00e7\u00e3o: migrar para ${nextPlan.name}.`
      : ""

    throw new Error(
      `Add-ons excedem o limite comercial do plano ${catalogPlan.name}.${upgradeHint}`
    )
  }
}

async function getActiveSubscriptionByApiKeyId(apiKeyId) {
  return prisma.customerSubscription.findFirst({
    where: {
      apiKeyId,
      status: "active"
    },
    include: {
      plan: {
        include: {
          featurePresets: true
        }
      },
      addons: {
        where: {
          isActive: true
        },
        include: {
          addon: true
        }
      },
      overrides: {
        where: {
          isActive: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  })
}

async function createOrReplaceSubscription({
  apiKeyId,
  planCode,
  addonCodes = [],
  renewsAt = null
}) {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { code: planCode }
  })

  if (!plan) {
    throw new Error("Plano não encontrado")
  }

  await prisma.customerSubscription.updateMany({
    where: {
      apiKeyId,
      status: "active"
    },
    data: {
      status: "inactive",
      canceledAt: new Date()
    }
  })

  const subscription = await prisma.customerSubscription.create({
    data: {
      apiKeyId,
      planId: plan.id,
      status: "active",
      renewsAt
    }
  })

  if (addonCodes.length) {
    const addons = await prisma.addonCatalog.findMany({
      where: {
        code: { in: addonCodes },
        isActive: true
      }
    })

    validateAddonComposition({
      planCode,
      addonCodes,
      addons
    })

    for (const addon of addons) {
      await prisma.customerAddon.create({
        data: {
          subscriptionId: subscription.id,
          addonId: addon.id,
          isActive: true
        }
      })
    }
  }

  return getActiveSubscriptionByApiKeyId(apiKeyId)
}

async function setConfigOverride({
  subscriptionId,
  featureKey,
  presetKey
}) {
  return prisma.customerConfigOverride.upsert({
    where: {
      subscriptionId_featureKey: {
        subscriptionId,
        featureKey
      }
    },
    update: {
      presetKey,
      isActive: true
    },
    create: {
      subscriptionId,
      featureKey,
      presetKey,
      isActive: true
    }
  })
}

module.exports = {
  getActiveSubscriptionByApiKeyId,
  createOrReplaceSubscription,
  setConfigOverride
}
