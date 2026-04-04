async function safeJson(response) {
  try {
    return await response.json()
  } catch (error) {
    return null
  }
}

function normalizeGeminiMessages(messages = []) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [
      {
        text:
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content)
      }
    ]
  }))
}

function buildGeminiGenerationConfig({
  temperature = 0.2,
  maxTokens = 300,
  responseFormat = null
}) {
  const config = {
    temperature,
    maxOutputTokens: maxTokens || 300
  }

  if (responseFormat?.type === "json_object") {
    config.responseMimeType = "application/json"
  }

  if (responseFormat?.type === "json_schema" && responseFormat.json_schema?.schema) {
    config.responseMimeType = "application/json"
    config.responseSchema = responseFormat.json_schema.schema
  }

  return config
}

async function generateResponse({
  model = "gemini/gemini-1.5-flash",
  messages,
  temperature = 0.2,
  maxTokens = 300,
  responseFormat = null,
  apiKeyOverride = null
}) {
  const normalizedModel = model.includes("/")
    ? model.split("/")[1]
    : model

  const payload = {
    contents: normalizeGeminiMessages(messages),
    generationConfig: buildGeminiGenerationConfig({
      temperature,
      maxTokens,
      responseFormat
    })
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizedModel)}:generateContent?key=${encodeURIComponent(apiKeyOverride || process.env.GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  )

  const data = await safeJson(response)

  if (!response.ok) {
    throw new Error(
      data?.error?.message || "Erro ao chamar Gemini"
    )
  }

  let content =
    data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || ""

  if (
    responseFormat &&
    (responseFormat.type === "json_object" ||
      responseFormat.type === "json_schema")
  ) {
    try {
      content = JSON.parse(content)
    } catch (error) {
      // mantém string se não vier JSON parseável
    }
  }

  const promptTokenCount = data?.usageMetadata?.promptTokenCount || 0
  const candidatesTokenCount = data?.usageMetadata?.candidatesTokenCount || 0
  const totalTokenCount = data?.usageMetadata?.totalTokenCount || (promptTokenCount + candidatesTokenCount)

  return {
    content,
    provider: "gemini",
    providerModel: normalizedModel,
    usage: {
      inputTokens: promptTokenCount,
      outputTokens: candidatesTokenCount,
      totalTokens: totalTokenCount
    }
  }
}

module.exports = {
  generateResponse
}