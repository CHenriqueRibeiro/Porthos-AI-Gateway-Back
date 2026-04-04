const subscriptionService = require("./subscription.service")
const {
  resolveEffectiveConfig,
  resolveRuntimePolicy
} = require("./billingConfig.service")

async function getRuntimePolicyForApiKey(apiKeyId) {
  const subscription =
    await subscriptionService.getActiveSubscriptionByApiKeyId(apiKeyId)

  const effectiveConfig = resolveEffectiveConfig(subscription)
  const runtimePolicy = resolveRuntimePolicy(effectiveConfig)

  return {
    subscription,
    effectiveConfig,
    runtimePolicy
  }
}

module.exports = {
  getRuntimePolicyForApiKey
}