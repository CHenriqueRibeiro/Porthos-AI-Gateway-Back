const prisma = require("../db/prisma")

async function upsertModelPricing({
  provider,
  model,
  inputPer1k,
  outputPer1k,
  currency = "USD",
  isActive = true
}) {
  return prisma.modelPricing.upsert({
    where: {
      provider_model: {
        provider,
        model
      }
    },
    update: {
      inputPer1k,
      outputPer1k,
      currency,
      isActive
    },
    create: {
      provider,
      model,
      inputPer1k,
      outputPer1k,
      currency,
      isActive
    }
  })
}

function normalizeModelCandidates(model) {
  const candidates = [model]

  // remove sufixo de data, ex: gpt-4o-mini-2024-07-18 -> gpt-4o-mini
  const withoutDateSuffix = model.replace(/-\d{4}-\d{2}-\d{2}$/, "")
  if (!candidates.includes(withoutDateSuffix)) {
    candidates.push(withoutDateSuffix)
  }

  return candidates
}

async function getModelPricing(provider, model) {
  const candidates = normalizeModelCandidates(model)

  return prisma.modelPricing.findFirst({
    where: {
      provider,
      model: {
        in: candidates
      },
      isActive: true
    },
    orderBy: {
      createdAt: "desc"
    }
  })
}

async function listModelPricing() {
  return prisma.modelPricing.findMany({
    orderBy: [
      { provider: "asc" },
      { model: "asc" }
    ]
  })
}

module.exports = {
  upsertModelPricing,
  getModelPricing,
  listModelPricing
}