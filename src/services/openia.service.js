const OpenAI = require("openai")
const {
  supportsTemperature,
  usesMaxCompletionTokens
} = require("./openaiModelRouter.service")

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

function isResponsesModel(model = "") {
  if (!model) return false
  const m = model.toLowerCase()
  // Incluindo modelos o1/o3 e a linha gpt-5
  return (
    m.includes("gpt-5") ||
    m.includes("gpt5") ||
    m.includes("o1") ||
    m.includes("o3") ||
    m.includes("responses")
  )
}

function buildPayload({
  model,
  messages,
  temperature,
  maxTokens = 300,
  responseFormat = null
}) {
  const normalizedModel = normalizeModel(model)
  const payload = {
    model: normalizedModel,
    messages
  }

  if (typeof temperature === "number" && supportsTemperature(normalizedModel)) {
    payload.temperature = temperature
  }

  if (maxTokens) {
    if (usesMaxCompletionTokens(normalizedModel)) {
      payload.max_completion_tokens = maxTokens
    } else {
      payload.max_tokens = maxTokens
    }
  }

  if (responseFormat) {
    payload.response_format = responseFormat
  }

  return payload
}

function tryParseStructuredContent(content, responseFormat) {
  if (!responseFormat) return content
  const isStructured = responseFormat.type === "json_object" || responseFormat.type === "json_schema"
  if (!isStructured) return content
  if (typeof content !== "string") return content

  const trimmed = content.trim()
  if (!trimmed) return content // Evita estourar erro se estiver vazio, deixa o fluxo seguir

  try {
    return JSON.parse(trimmed)
  } catch (error) {
    // Se falhar o parse, retorna o texto bruto para não perder a informação
    return content 
  }
}

// --- RESPONSES API (o1, o3, gpt-5) ---
async function generateResponsesAPI({
  model,
  messages,
  temperature,
  maxTokens = 300,
  responseFormat = null,
  apiKeyOverride = null
}) {
  const client = createClient(apiKeyOverride)
  const normalizedModel = normalizeModel(model)

  const payload = {
    model: normalizedModel,
    input: messages.map((m) => ({
      role: m.role,
      content: m.content
    }))
  }

  if (maxTokens) payload.max_output_tokens = maxTokens
  if (typeof temperature === "number") payload.temperature = temperature
  
  // Na Responses API, se houver responseFormat, ele entra de forma específica
  if (responseFormat) {
    payload.output_format = responseFormat 
  }

  const response = await client.responses.create(payload)

  // 🔥 ESTRATÉGIA DE VARREDURA (Resolve o bug do content vazio)
  // Tentamos todas as profundidades possíveis onde o texto pode estar escondido
  let content = 
    response.output_text || 
    response.output?.text ||
    (response.output && Array.isArray(response.output) && response.output[0]?.text) ||
    (response.output && Array.isArray(response.output) && response.output[0]?.content?.[0]?.text) ||
    "";

  // Se o modelo retornou um objeto em vez de string (comum em schemas)
  if (typeof content === "object") {
    content = JSON.stringify(content)
  }

  return {
    content: tryParseStructuredContent(content, responseFormat),
    provider: "openai-responses",
    providerModel: normalizedModel,
    usage: {
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0
    },
    raw: response
  }
}

// --- CHAT COMPLETIONS (gpt-4o, gpt-3.5) ---
async function generateResponse({
  model = "openai/gpt-4o-mini",
  messages,
  temperature,
  maxTokens = 300,
  responseFormat = null,
  apiKeyOverride = null
}) {
  const client = createClient(apiKeyOverride)

  if (isResponsesModel(model)) {
    return await generateResponsesAPI({
      model,
      messages,
      temperature,
      maxTokens,
      responseFormat,
      apiKeyOverride
    })
  }

  const payload = buildPayload({
    model,
    messages,
    temperature,
    maxTokens,
    responseFormat
  })

  const completion = await client.chat.completions.create(payload)

  const message = completion.choices?.[0]?.message || {}
  
  // 🔥 Captura de Refusal (importante para modelos novos)
  let content = message.content || message.refusal || ""

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