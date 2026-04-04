async function safeJson(response) {
  try {
    return await response.json()
  } catch (error) {
    return null
  }
}

function normalizeAnthropicMessages(messages = []) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content:
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content)
  }))
}

async function generateResponse({
  model = "anthropic/claude-3-5-haiku-latest",
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
    model: normalizedModel,
    max_tokens: maxTokens || 300,
    temperature,
    messages: normalizeAnthropicMessages(messages)
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKeyOverride || process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  const data = await safeJson(response)

  if (!response.ok) {
    throw new Error(
      data?.error?.message || "Erro ao chamar Anthropic"
    )
  }

  let content =
    data?.content?.find((item) => item.type === "text")?.text || ""

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

  return {
    content,
    provider: "anthropic",
    providerModel: data?.model || normalizedModel,
    usage: {
      inputTokens: data?.usage?.input_tokens || 0,
      outputTokens: data?.usage?.output_tokens || 0,
      totalTokens:
        (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0)
    }
  }
}

module.exports = {
  generateResponse
}