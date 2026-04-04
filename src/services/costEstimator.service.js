const modelPricingService = require("./modelPricing.service")

function roundCost(value) {
  return Number((value || 0).toFixed(8))
}

async function estimateLlmCost({
  provider,
  providerModel,
  inputTokens = 0,
  outputTokens = 0
}) {
  const pricing = await modelPricingService.getModelPricing(provider, providerModel)

  if (!pricing) {
    return {
      estimatedCostInput: 0,
      estimatedCostOutput: 0,
      estimatedCostTotal: 0,
      currency: "USD",
      pricingFound: false
    }
  }

  const estimatedCostInput = (inputTokens / 1000) * pricing.inputPer1k
  const estimatedCostOutput = (outputTokens / 1000) * pricing.outputPer1k
  const estimatedCostTotal = estimatedCostInput + estimatedCostOutput

  return {
    estimatedCostInput: roundCost(estimatedCostInput),
    estimatedCostOutput: roundCost(estimatedCostOutput),
    estimatedCostTotal: roundCost(estimatedCostTotal),
    currency: pricing.currency || "USD",
    pricingFound: true
  }
}

module.exports = {
  estimateLlmCost
}