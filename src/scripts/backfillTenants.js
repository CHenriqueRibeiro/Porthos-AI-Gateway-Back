require("dotenv").config()

const prisma = require("../db/prisma")
const apiKeyService = require("../services/apiKey.service")
const { ensureTenantSchema } = require("../services/tenantSchema.service")

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      apiKeys: {
        select: {
          id: true,
          tenantId: true
        }
      }
    }
  })

  let tenantsTouched = 0
  let apiKeysLinked = 0

  for (const user of users) {
    const tenant = await apiKeyService.resolveOrCreateTenantForUser({
      userId: user.id
    })

    await ensureTenantSchema(tenant.schemaName)
    tenantsTouched += 1

    const orphanApiKeyIds = user.apiKeys
      .filter((apiKey) => !apiKey.tenantId)
      .map((apiKey) => apiKey.id)

    if (orphanApiKeyIds.length > 0) {
      const result = await prisma.apiKey.updateMany({
        where: {
          id: {
            in: orphanApiKeyIds
          }
        },
        data: {
          tenantId: tenant.id
        }
      })

      apiKeysLinked += result.count
    }
  }

  console.log(
    `[TENANTS] backfill concluido: ${tenantsTouched} tenant(s), ${apiKeysLinked} api key(s) vinculada(s)`
  )
}

main()
  .catch((error) => {
    console.error("[TENANTS] erro no backfill:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
