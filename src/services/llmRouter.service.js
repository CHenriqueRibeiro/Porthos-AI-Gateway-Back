const openaiService = require("./openia.service")
const anthropicService = require("./anthropic.service")
const geminiService = require("./gemini.service")

function getProviderFromModel(model = "") {
  if (typeof model !== "string" || !model.trim()) {
    return "openai"
  }

  if (model.startsWith("openai/")) return "openai"
  if (model.startsWith("anthropic/")) return "anthropic"
  if (model.startsWith("gemini/")) return "gemini"

  return "openai"
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages deve ser um array não vazio")
  }

  const validRoles = new Set(["system", "user", "assistant"])

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      throw new Error("Cada message deve ser um objeto válido")
    }

    if (!validRoles.has(msg.role)) {
      throw new Error(`Role inválida em messages: ${msg.role}`)
    }

    if (typeof msg.content !== "string" || !msg.content.trim()) {
      throw new Error("Cada message deve ter content string não vazio")
    }
  }
}

function validateResponseFormat(responseFormat) {
  if (!responseFormat) return

  const validTypes = new Set(["json_object", "json_schema"])

  if (!responseFormat.type || !validTypes.has(responseFormat.type)) {
    throw new Error("responseFormat.type inválido")
  }

  if (responseFormat.type === "json_schema") {
    if (
      !responseFormat.json_schema ||
      !responseFormat.json_schema.name ||
      !responseFormat.json_schema.schema
    ) {
      throw new Error("json_schema inválido em responseFormat")
    }
  }
}

function ensureJsonInstruction(messages = [], responseFormat = null) {
  if (!responseFormat || responseFormat.type !== "json_object") {
    return messages
  }

  const hasJsonInstruction = messages.some((msg) =>
    typeof msg.content === "string" &&
    msg.content.toLowerCase().includes("json")
  )

  if (hasJsonInstruction) {
    return messages
  }

  return [
    {
      role: "system",
      content: "Responda somente em JSON válido."
    },
    ...messages
  ]
}

function normalizeMessagesForProvider(messages, responseFormat) {
  validateMessages(messages)
  validateResponseFormat(responseFormat)

  return ensureJsonInstruction(messages, responseFormat)
}

function normalizeProviderError(provider, error) {
  const message =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "Erro desconhecido no provider"

  return new Error(`[${provider}] ${message}`)
}

async function generateResponse({
  model,
  messages,
  temperature,
  maxTokens,
  responseFormat,
  apiKeyOverride = null
}) {
  const provider = getProviderFromModel(model)
  const normalizedMessages = normalizeMessagesForProvider(messages, responseFormat)

  try {
    if (provider === "openai") {
      return await openaiService.generateResponse({
        model,
        messages: normalizedMessages,
        temperature,
        maxTokens,
        responseFormat,
        apiKeyOverride
      })
    }

    if (provider === "anthropic") {
      return await anthropicService.generateResponse({
        model,
        messages: normalizedMessages,
        temperature,
        maxTokens,
        responseFormat,
        apiKeyOverride
      })
    }

    if (provider === "gemini") {
      return await geminiService.generateResponse({
        model,
        messages: normalizedMessages,
        temperature,
        maxTokens,
        responseFormat,
        apiKeyOverride
      })
    }

    throw new Error("Provider não suportado")
  } catch (error) {
    throw normalizeProviderError(provider, error)
  }
}

module.exports = {
  getProviderFromModel,
  generateResponse
}