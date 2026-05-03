const crypto = require("crypto")
const prisma = require("../db/prisma")
const { encrypt, decrypt } = require("../utils/crypto")
const { schemaSql } = require("./tenantSchema.service")
const { getTenantSchemaByApiKeyId } = require("./tenantData.service")

function mapProviderKey(row = {}, includeSecret = false) {
  if (!row) return null

  const mapped = {
    id: row.id,
    apiKeyId: row.apiKeyId,
    provider: row.provider,
    label: row.label,
    encryptedKey: row.encryptedKey,
    isDefault: row.isDefault,
    isActive: row.isActive,
    validationStatus: row.validationStatus,
    validationMessage: row.validationMessage,
    lastValidatedAt: row.lastValidatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }

  if (includeSecret) {
    try {
      mapped.apiKey = decrypt(row.encryptedKey)
    } catch (error) {
      error.statusCode = 409
      error.providerKeyId = row.id
      throw error
    }
  }

  return mapped
}

async function createProviderKey({
  apiKeyId,
  provider,
  apiKey,
  label = null,
  isDefault = true,
  validationStatus = "valid",
  validationMessage = "Chave validada com sucesso"
}) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))

  if (isDefault) {
    await prisma.$executeRaw`
      UPDATE ${schema}.provider_keys
      SET is_default = false,
          updated_at = NOW()
      WHERE api_key_id = ${apiKeyId}
        AND provider = ${provider}
    `
  }

  const id = crypto.randomUUID()
  const rows = await prisma.$queryRaw`
    INSERT INTO ${schema}.provider_keys (
      id,
      api_key_id,
      provider,
      label,
      encrypted_key,
      is_default,
      is_active,
      validation_status,
      validation_message,
      last_validated_at
    )
    VALUES (
      ${id},
      ${apiKeyId},
      ${provider},
      ${label},
      ${encrypt(apiKey)},
      ${isDefault},
      true,
      ${validationStatus},
      ${validationMessage},
      NOW()
    )
    RETURNING
      id,
      api_key_id AS "apiKeyId",
      provider,
      label,
      encrypted_key AS "encryptedKey",
      is_default AS "isDefault",
      is_active AS "isActive",
      validation_status AS "validationStatus",
      validation_message AS "validationMessage",
      last_validated_at AS "lastValidatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `

  return mapProviderKey(rows[0])
}

async function listProviderKeys(apiKeyId) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      api_key_id AS "apiKeyId",
      provider,
      label,
      encrypted_key AS "encryptedKey",
      is_default AS "isDefault",
      is_active AS "isActive",
      validation_status AS "validationStatus",
      validation_message AS "validationMessage",
      last_validated_at AS "lastValidatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM ${schema}.provider_keys
    WHERE api_key_id = ${apiKeyId}
    ORDER BY provider ASC, created_at DESC
  `

  return rows.map((row) => mapProviderKey(row))
}

async function getDefaultProviderKey(apiKeyId, provider) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      api_key_id AS "apiKeyId",
      provider,
      label,
      encrypted_key AS "encryptedKey",
      is_default AS "isDefault",
      is_active AS "isActive",
      validation_status AS "validationStatus",
      validation_message AS "validationMessage",
      last_validated_at AS "lastValidatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM ${schema}.provider_keys
    WHERE api_key_id = ${apiKeyId}
      AND provider = ${provider}
      AND is_default = true
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1
  `

  return mapProviderKey(rows[0], true)
}

async function deleteProviderKey(id, apiKeyId) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  return prisma.$executeRaw`
    DELETE FROM ${schema}.provider_keys
    WHERE id = ${id}
      AND api_key_id = ${apiKeyId}
  `
}

async function setDefaultProviderKey(id, apiKeyId) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  const foundRows = await prisma.$queryRaw`
    SELECT provider
    FROM ${schema}.provider_keys
    WHERE id = ${id}
      AND api_key_id = ${apiKeyId}
    LIMIT 1
  `

  const found = foundRows[0]

  if (!found) {
    throw new Error("Provider key não encontrada")
  }

  await prisma.$executeRaw`
    UPDATE ${schema}.provider_keys
    SET is_default = false,
        updated_at = NOW()
    WHERE api_key_id = ${apiKeyId}
      AND provider = ${found.provider}
  `

  const rows = await prisma.$queryRaw`
    UPDATE ${schema}.provider_keys
    SET is_default = true,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING
      id,
      api_key_id AS "apiKeyId",
      provider,
      label,
      encrypted_key AS "encryptedKey",
      is_default AS "isDefault",
      is_active AS "isActive",
      validation_status AS "validationStatus",
      validation_message AS "validationMessage",
      last_validated_at AS "lastValidatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `

  return mapProviderKey(rows[0])
}

module.exports = {
  createProviderKey,
  listProviderKeys,
  getDefaultProviderKey,
  deleteProviderKey,
  setDefaultProviderKey
}
