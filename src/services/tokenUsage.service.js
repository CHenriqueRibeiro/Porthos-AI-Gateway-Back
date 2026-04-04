const prisma = require("../db/prisma")

async function createTokenUsage({
  apiKeyId,
  systemInputTokensOriginal = 0,
  systemInputTokensOptimized = 0,
  systemResponseTokens = 0,
  llmInputTokens = 0,
  llmOutputTokens = 0,
  llmTotalTokens = 0,
  estimatedCostInput = 0,
  estimatedCostOutput = 0,
  estimatedCostTotal = 0,
  currency = "USD",
  scope = null,
  cacheType = null,
  provider = null,
  providerModel = null,
  keySource = null,
  routeType = null,
  workloadCategory = null
}) {
  return prisma.tokenUsage.create({
    data: {
      apiKeyId,
      systemInputTokensOriginal,
      systemInputTokensOptimized,
      systemResponseTokens,
      llmInputTokens,
      llmOutputTokens,
      llmTotalTokens,
      estimatedCostInput,
      estimatedCostOutput,
      estimatedCostTotal,
      currency,
      scope,
      cacheType,
      provider,
      providerModel,
      keySource,
      routeType,
      workloadCategory
    }
  })
}

module.exports = {
  createTokenUsage
}