require("dotenv").config()

const prisma = require("../db/prisma")
const billingCatalogService = require("../services/billingCatalog.service")

async function main() {
  const result = await billingCatalogService.seedPlansAndAddons()
  const plans = await prisma.subscriptionPlan.findMany({
    select: { code: true, name: true, isActive: true }
  })
  console.log("Catálogo de planos e addons populado.", result)
  console.log(
    "Planos disponíveis (use um `planCode` no /auth/register):",
    plans.map((p) => p.code).join(", ")
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
