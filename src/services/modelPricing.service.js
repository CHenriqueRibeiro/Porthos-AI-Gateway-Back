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

function pricesAreEqual(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.0000000001
}

async function syncModelPricing(items = []) {
  const result = {
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0
  }

  for (const item of items) {
    if (!item?.provider || !item?.model) {
      result.skipped += 1
      continue
    }

    const existing = await prisma.modelPricing.findUnique({
      where: {
        provider_model: {
          provider: item.provider,
          model: item.model
        }
      }
    })

    if (!existing) {
      await upsertModelPricing(item)
      result.created += 1
      continue
    }

    const changed =
      !pricesAreEqual(existing.inputPer1k, item.inputPer1k) ||
      !pricesAreEqual(existing.outputPer1k, item.outputPer1k) ||
      existing.currency !== (item.currency || "USD") ||
      existing.isActive !== (item.isActive ?? true)

    if (!changed) {
      result.unchanged += 1
      continue
    }

    await upsertModelPricing(item)
    result.updated += 1
  }

  return result
}

module.exports = {
  upsertModelPricing,
  getModelPricing,
  listModelPricing,
  syncModelPricing
}
