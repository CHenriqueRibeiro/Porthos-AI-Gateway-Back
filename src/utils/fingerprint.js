const crypto = require("crypto")
const { normalizeText } = require("./normalizeText")

function createFingerprint(text) {
  const normalized = normalizeText(text)

  return crypto
    .createHash("sha256")
    .update(normalized)
    .digest("hex")
}

module.exports = {
  createFingerprint
}