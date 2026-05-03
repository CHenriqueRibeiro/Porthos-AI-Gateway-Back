const { createFingerprint } = require("./fingerprint")
const { serializeResponseFormat } = require("./responseFormat")

function buildCacheKey(question, responseFormat = null) {
  const serializedFormat = serializeResponseFormat(responseFormat)
  return createFingerprint(`${question}::${serializedFormat}`)
}

function buildSemanticQuestion(question, responseFormat = null) {
  const serializedFormat = serializeResponseFormat(responseFormat)

  if (!serializedFormat) {
    return question
  }

  return `${question} ::FORMAT:: ${serializedFormat}`
}

module.exports = {
  buildCacheKey,
  buildSemanticQuestion
}