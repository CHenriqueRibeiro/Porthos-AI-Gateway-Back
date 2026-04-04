const OpenAI = require("openai")

function createClient(apiKeyOverride = null) {
  const apiKey = apiKeyOverride || process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada")
  }

  return new OpenAI({ apiKey })
}

function normalizeModel(model = "openai/gpt-4o-mini") {
  return model.includes("/") ? model.split("/")[1] : model
}

function buildPayload({
  model,
  messages,
  temperature = 0.2,
  maxTokens = 300,
  responseFormat = null
}) {
  const payload = {
    model: normalizeModel(model),
    messages,
    temperature
  }

  if (maxTokens) {
    // Mantém compatibilidade com Chat Completions atual
    payload.max_tokens = maxTokens
  }

  if (responseFormat) {
    payload.response_format = responseFormat
  }

  return payload
}

function tryParseStructuredContent(content, responseFormat) {
  if (!responseFormat) {
    return content
  }

  const isStructured =
    responseFormat.type === "json_object" ||
    responseFormat.type === "json_schema"

  if (!isStructured) {
    return content
  }

  if (typeof content !== "string") {
    return content
  }

  const trimmed = content.trim()

  if (!trimmed) {
    throw new Error("Resposta estruturada vazia retornada pela OpenAI")
  }

  try {
    return JSON.parse(trimmed)
  } catch (error) {
    throw new Error(
      "OpenAI retornou conteúdo não parseável para response_format estruturado"
    )
  }
}

async function generateResponse({
  model = "openai/gpt-4o-mini",
  messages,
  temperature = 0.2,
  maxTokens = 300,
  responseFormat = null,
  apiKeyOverride = null
}) {
  const client = createClient(apiKeyOverride)
  const payload = buildPayload({
    model,
    messages,
    temperature,
    maxTokens,
    responseFormat
  })

  const completion = await client.chat.completions.create(payload)

  const message = completion.choices?.[0]?.message || {}
  let content = message.content || ""

  content = tryParseStructuredContent(content, responseFormat)

  return {
    content,
    provider: "openai",
    providerModel: completion.model || normalizeModel(model),
    usage: {
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0
    },
    raw: {
      id: completion.id,
      finishReason: completion.choices?.[0]?.finish_reason || null
    }
  }
}

module.exports = {
  generateResponse
}