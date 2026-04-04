const prisma = require("../db/prisma")
const {
  DEFAULT_PLANS,
  DEFAULT_ADDONS
} = require("../config/billingCatalog")

async function seedPlansAndAddons() {
  for (const plan of DEFAULT_PLANS) {
    const savedPlan = await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        type: plan.type,
        priceCents: plan.priceCents,
        currency: "BRL",
        isActive: true
      },
      create: {
        code: plan.code,
        name: plan.name,
        type: plan.type,
        priceCents: plan.priceCents,
        currency: "BRL",
        isActive: true
      }
    })

    for (const [featureKey, presetKey] of Object.entries(plan.featurePresets)) {
      await prisma.planFeaturePreset.upsert({
        where: {
          planId_featureKey: {
            planId: savedPlan.id,
            featureKey
          }
        },
        update: {
          presetKey
        },
        create: {
          planId: savedPlan.id,
          featureKey,
          presetKey
        }
      })
    }
  }

  for (const addon of DEFAULT_ADDONS) {
    await prisma.addonCatalog.upsert({
      where: { code: addon.code },
      update: {
        name: addon.name,
        featureKey: addon.featureKey,
        presetKey: addon.presetKey,
        priceCents: addon.priceCents,
        currency: "BRL",
        isActive: true
      },
      create: {
        code: addon.code,
        name: addon.name,
        featureKey: addon.featureKey,
        presetKey: addon.presetKey,
        priceCents: addon.priceCents,
        currency: "BRL",
        isActive: true
      }
    })
  }

  return {
    success: true
  }
}

async function listPlans() {
  return prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    include: {
      featurePresets: true
    },
    orderBy: {
      priceCents: "asc"
    }
  })
}

async function listAddons() {
  return prisma.addonCatalog.findMany({
    where: { isActive: true },
    orderBy: {
      priceCents: "asc"
    }
  })
}

module.exports = {
  seedPlansAndAddons,
  listPlans,
  listAddons
}