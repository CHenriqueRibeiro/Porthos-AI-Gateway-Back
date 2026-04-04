const prisma = require("../db/prisma")

async function main() {
  const items = [
    {
      provider: "openai",
      model: "gpt-4o-mini-2024-07-18",
      inputPer1k: 0.00015,
      outputPer1k: 0.0006,
      currency: "USD"
    },
    {
      provider: "openai",
      model: "gpt-4.1-2025-04-14",
      inputPer1k: 0.002,
      outputPer1k: 0.008,
      currency: "USD"
    }
  ]

  for (const item of items) {
    await prisma.modelPricing.upsert({
      where: {
        provider_model: {
          provider: item.provider,
          model: item.model
        }
      },
      update: {
        inputPer1k: item.inputPer1k,
        outputPer1k: item.outputPer1k,
        currency: item.currency,
        isActive: true
      },
      create: item
    })
  }

  console.log("Pricing seed concluído")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })