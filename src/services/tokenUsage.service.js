const crypto = require("crypto")
const prisma = require("../db/prisma")
const { schemaSql } = require("./tenantSchema.service")
const { getTenantSchemaByApiKeyId } = require("./tenantData.service")

function mapTokenUsage(row = {}) {
  if (!row) return null

  return {
    id: row.id,
    apiKeyId: row.apiKeyId,
    systemInputTokensOriginal: row.systemInputTokensOriginal,
    systemInputTokensOptimized: row.systemInputTokensOptimized,
    systemResponseTokens: row.systemResponseTokens,
    llmInputTokens: row.llmInputTokens,
    llmOutputTokens: row.llmOutputTokens,
    llmTotalTokens: row.llmTotalTokens,
    cacheReferenceInputTokens: row.cacheReferenceInputTokens,
    cacheReferenceOutputTokens: row.cacheReferenceOutputTokens,
    cacheReferenceTotalTokens: row.cacheReferenceTotalTokens,
    estimatedCostInput: row.estimatedCostInput,
    estimatedCostOutput: row.estimatedCostOutput,
    estimatedCostTotal: row.estimatedCostTotal,
    estimatedCostAvoided: row.estimatedCostAvoided,
    currency: row.currency,
    scope: row.scope,
    cacheType: row.cacheType,
    provider: row.provider,
    providerModel: row.providerModel,
    keySource: row.keySource,
    routeType: row.routeType,
    workloadCategory: row.workloadCategory,
    createdAt: row.createdAt
  }
}

async function createTokenUsage({
  apiKeyId,
  systemInputTokensOriginal = 0,
  systemInputTokensOptimized = 0,
  systemResponseTokens = 0,
  llmInputTokens = 0,
  llmOutputTokens = 0,
  llmTotalTokens = 0,
  cacheReferenceInputTokens = 0,
  cacheReferenceOutputTokens = 0,
  cacheReferenceTotalTokens = 0,
  estimatedCostInput = 0,
  estimatedCostOutput = 0,
  estimatedCostTotal = 0,
  estimatedCostAvoided = 0,
  currency = "USD",
  scope = null,
  cacheType = null,
  provider = null,
  providerModel = null,
  keySource = null,
  routeType = null,
  workloadCategory = null
}) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  const id = crypto.randomUUID()

  const rows = await prisma.$queryRaw`
    INSERT INTO ${schema}.token_usage (
      id,
      api_key_id,
      system_input_tokens_original,
      system_input_tokens_optimized,
      system_response_tokens,
      llm_input_tokens,
      llm_output_tokens,
      llm_total_tokens,
      cache_reference_input_tokens,
      cache_reference_output_tokens,
      cache_reference_total_tokens,
      estimated_cost_input,
      estimated_cost_output,
      estimated_cost_total,
      estimated_cost_avoided,
      currency,
      scope,
      cache_type,
      provider,
      provider_model,
      key_source,
      route_type,
      workload_category
    )
    VALUES (
      ${id},
      ${apiKeyId},
      ${systemInputTokensOriginal},
      ${systemInputTokensOptimized},
      ${systemResponseTokens},
      ${llmInputTokens},
      ${llmOutputTokens},
      ${llmTotalTokens},
      ${cacheReferenceInputTokens},
      ${cacheReferenceOutputTokens},
      ${cacheReferenceTotalTokens},
      ${estimatedCostInput},
      ${estimatedCostOutput},
      ${estimatedCostTotal},
      ${estimatedCostAvoided},
      ${currency},
      ${scope},
      ${cacheType},
      ${provider},
      ${providerModel},
      ${keySource},
      ${routeType},
      ${workloadCategory}
    )
    RETURNING
      id,
      api_key_id AS "apiKeyId",
      system_input_tokens_original AS "systemInputTokensOriginal",
      system_input_tokens_optimized AS "systemInputTokensOptimized",
      system_response_tokens AS "systemResponseTokens",
      llm_input_tokens AS "llmInputTokens",
      llm_output_tokens AS "llmOutputTokens",
      llm_total_tokens AS "llmTotalTokens",
      cache_reference_input_tokens AS "cacheReferenceInputTokens",
      cache_reference_output_tokens AS "cacheReferenceOutputTokens",
      cache_reference_total_tokens AS "cacheReferenceTotalTokens",
      estimated_cost_input AS "estimatedCostInput",
      estimated_cost_output AS "estimatedCostOutput",
      estimated_cost_total AS "estimatedCostTotal",
      estimated_cost_avoided AS "estimatedCostAvoided",
      currency,
      scope,
      cache_type AS "cacheType",
      provider,
      provider_model AS "providerModel",
      key_source AS "keySource",
      route_type AS "routeType",
      workload_category AS "workloadCategory",
      created_at AS "createdAt"
  `

  return mapTokenUsage(rows[0])
}

async function findTokenUsageByApiKey({ apiKeyId, start, end }) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      api_key_id AS "apiKeyId",
      system_input_tokens_original AS "systemInputTokensOriginal",
      system_input_tokens_optimized AS "systemInputTokensOptimized",
      system_response_tokens AS "systemResponseTokens",
      llm_input_tokens AS "llmInputTokens",
      llm_output_tokens AS "llmOutputTokens",
      llm_total_tokens AS "llmTotalTokens",
      cache_reference_input_tokens AS "cacheReferenceInputTokens",
      cache_reference_output_tokens AS "cacheReferenceOutputTokens",
      cache_reference_total_tokens AS "cacheReferenceTotalTokens",
      estimated_cost_input AS "estimatedCostInput",
      estimated_cost_output AS "estimatedCostOutput",
      estimated_cost_total AS "estimatedCostTotal",
      estimated_cost_avoided AS "estimatedCostAvoided",
      currency,
      scope,
      cache_type AS "cacheType",
      provider,
      provider_model AS "providerModel",
      key_source AS "keySource",
      route_type AS "routeType",
      workload_category AS "workloadCategory",
      created_at AS "createdAt"
    FROM ${schema}.token_usage
    WHERE api_key_id = ${apiKeyId}
      AND created_at >= ${start}
      AND created_at <= ${end}
    ORDER BY created_at DESC
  `

  return rows.map(mapTokenUsage)
}

async function deleteTokenUsageBefore({ apiKeyId, cutoff }) {
  const schema = schemaSql(await getTenantSchemaByApiKeyId(apiKeyId))
  return prisma.$executeRaw`
    DELETE FROM ${schema}.token_usage
    WHERE api_key_id = ${apiKeyId}
      AND created_at < ${cutoff}
  `
}

module.exports = {
  createTokenUsage,
  findTokenUsageByApiKey,
  deleteTokenUsageBefore
}
