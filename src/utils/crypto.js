const crypto = require("crypto")

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET

if (!ENCRYPTION_SECRET) {
  throw new Error("ENCRYPTION_SECRET não configurado")
}

const KEY = crypto
  .createHash("sha256")
  .update(String(ENCRYPTION_SECRET))
  .digest()

function encrypt(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv)

  let encrypted = cipher.update(String(text), "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag().toString("hex")

  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

function decrypt(payload) {
  const [ivHex, authTagHex, encrypted] = String(payload).split(":")

  const isValidHex = (value, length) =>
    typeof value === "string" &&
    value.length === length &&
    /^[0-9a-f]+$/i.test(value)

  if (
    !isValidHex(ivHex, 32) ||
    !isValidHex(authTagHex, 32) ||
    !encrypted ||
    !/^[0-9a-f]+$/i.test(encrypted)
  ) {
    const error = new Error(
      "Provider key criptografada em formato inv\u00e1lido. Remova e cadastre a chave novamente."
    )
    error.code = "INVALID_ENCRYPTED_PROVIDER_KEY"
    throw error
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    KEY,
    Buffer.from(ivHex, "hex")
  )

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"))

  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

module.exports = {
  encrypt,
  decrypt
}
