function classifyWorkload({
  content = "",
  responseFormat = null,
  extractionProfile = "generic_document"
}) {
  const text = String(content || "")
  const length = text.length

  const hasStructuredExtraction = responseFormat?.type === "json_schema"
  const hasJsonOutput = responseFormat?.type === "json_object"
  const looksLikeLargePayload = length > 12000
  const looksLikeMediumPayload = length > 4000

  let level = "light"
  let score = 0

  if (hasJsonOutput) score += 1
  if (hasStructuredExtraction) score += 3
  if (looksLikeMediumPayload) score += 1
  if (looksLikeLargePayload) score += 2
  if (extractionProfile && extractionProfile !== "generic_document") score += 1

  if (score >= 4) {
    level = "heavy"
  } else if (score >= 2) {
    level = "medium"
  }

  return {
    level,
    score,
    hasStructuredExtraction,
    hasJsonOutput,
    length
  }
}

module.exports = {
  classifyWorkload
}