const prisma = require("../db/prisma")

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