const secretPatterns = [
  /sk-[a-zA-Z0-9_-]{10,}/,
  /api[_ -]?key/i,
  /client[_ -]?secret/i,
  /bearer\s+[a-zA-Z0-9._-]+/i,
  /basic\s+[a-zA-Z0-9+/=]+/i,
  /password/i,
  /token/i,
  /authorization/i
]

function detectSecrets(text = "") {
  return secretPatterns.some((pattern) => pattern.test(text))
}

module.exports = {
  detectSecrets
}