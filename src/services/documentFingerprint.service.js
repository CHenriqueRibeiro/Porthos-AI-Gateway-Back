const crypto = require("crypto")

function hashText(value = "") {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex")
}

function stableSortObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableSortObject)
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableSortObject(value[key])
        return acc
      }, {})
  }

  return value
}

function buildSchemaSignature(responseFormat = null) {
  if (!responseFormat?.json_schema?.schema) {
    return "no_schema"
  }

  return hashText(JSON.stringify(stableSortObject(responseFormat.json_schema.schema)))
}

function buildDocumentFingerprint({
  text,
  extractionProfile = "generic_document",
  responseFormat = null
}) {
  const schemaSignature = buildSchemaSignature(responseFormat)
  const contentHash = hashText(text)

  const documentFingerprint = hashText(
    `${extractionProfile}::${schemaSignature}::${contentHash}`
  )

  return {
    schemaSignature,
    contentHash,
    documentFingerprint
  }
}

function hashBlock(text = "") {
  return hashText(String(text).trim())
}

module.exports = {
  hashText,
  hashBlock,
  buildSchemaSignature,
  buildDocumentFingerprint
}