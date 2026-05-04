require("dotenv").config()

const prisma = require("../db/prisma")
const llmPricesSyncService = require("../services/llmPricesSync.service")

async function main() {
  const result = await llmPricesSyncService.syncLlmPrices()

  console.log("Sync llm-prices concluido")
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
