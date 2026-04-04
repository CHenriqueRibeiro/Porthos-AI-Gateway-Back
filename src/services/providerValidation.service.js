function buildInvalidResult(validationStatus, validationMessage, statusCode = 400) {
  return {
    isValid: false,
    validationStatus,
    validationMessage,
    statusCode
  }
}

function buildValidResult(provider, message = "Chave validada com sucesso") {
  return {
    isValid: true,
    validationStatus: "valid",
    validationMessage: message,
    provider
  }
}

async function safeJson(response) {
  try {
    return await response.json()
  } catch (error) {
    return null
  }
}

async function validateOpenAiKey(apiKey) {
  try {
    const modelsResponse = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!modelsResponse.ok) {
      const errorBody = await safeJson(modelsResponse)

      if (modelsResponse.status === 401) {
        return buildInvalidResult(
          "invalid_auth",
          "Falha na autenticação com a OpenAI",
          400
        )
      }

      if (modelsResponse.status === 429) {
        return buildInvalidResult(
          "billing_or_quota_issue",
          "A chave da OpenAI autentica, mas há limite/quota/billing impedindo o uso",
          400
        )
      }

      return buildInvalidResult(
        "unknown_error",
        errorBody?.error?.message || "Falha ao validar chave da OpenAI",
        400
      )
    }

    const runtimeResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: "oi"
          }
        ],
        max_tokens: 1,
        temperature: 0
      })
    })

    if (!runtimeResponse.ok) {
      const errorBody = await safeJson(runtimeResponse)

      if (runtimeResponse.status === 401) {
        return buildInvalidResult(
          "invalid_auth",
          "Falha na autenticação com a OpenAI",
          400
        )
      }

      if (runtimeResponse.status === 403) {
        return buildInvalidResult(
          "model_access_issue",
          "A chave da OpenAI é válida, mas não possui acesso ao modelo de teste",
          400
        )
      }

      if (runtimeResponse.status === 429) {
        return buildInvalidResult(
          "billing_or_quota_issue",
          "A chave da OpenAI autentica, mas o teste operacional falhou por limite/quota/billing",
          400
        )
      }

      return buildInvalidResult(
        "unknown_error",
        errorBody?.error?.message || "Falha no teste operacional com a OpenAI",
        400
      )
    }

    return buildValidResult(
      "openai",
      "Chave OpenAI validada com sucesso e teste operacional concluído"
    )
  } catch (error) {
    return buildInvalidResult(
      "unknown_error",
      error.message || "Erro ao validar chave da OpenAI",
      500
    )
  }
}

async function validateAnthropicKey(apiKey) {
  try {
    const modelsResponse = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    })

    if (!modelsResponse.ok) {
      const errorBody = await safeJson(modelsResponse)

      if (modelsResponse.status === 401) {
        return buildInvalidResult(
          "invalid_auth",
          "Falha na autenticação com a Anthropic",
          400
        )
      }

      if (modelsResponse.status === 403) {
        return buildInvalidResult(
          "model_access_issue",
          "A chave da Anthropic não possui acesso permitido",
          400
        )
      }

      if (modelsResponse.status === 402 || modelsResponse.status === 429) {
        return buildInvalidResult(
          "billing_or_quota_issue",
          "A chave da Anthropic autentica, mas há problema de billing/quota",
          400
        )
      }

      return buildInvalidResult(
        "unknown_error",
        errorBody?.error?.message || "Falha ao validar chave da Anthropic",
        400
      )
    }

    const runtimeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 1,
        messages: [
          {
            role: "user",
            content: "oi"
          }
        ]
      })
    })

    if (!runtimeResponse.ok) {
      const errorBody = await safeJson(runtimeResponse)

      if (runtimeResponse.status === 401) {
        return buildInvalidResult(
          "invalid_auth",
          "Falha na autenticação com a Anthropic",
          400
        )
      }

      if (runtimeResponse.status === 403) {
        return buildInvalidResult(
          "model_access_issue",
          "A chave da Anthropic é válida, mas não possui acesso ao modelo de teste",
          400
        )
      }

      if (runtimeResponse.status === 402 || runtimeResponse.status === 429) {
        return buildInvalidResult(
          "billing_or_quota_issue",
          "A chave da Anthropic autentica, mas o teste operacional falhou por billing/quota",
          400
        )
      }

      return buildInvalidResult(
        "unknown_error",
        errorBody?.error?.message || "Falha no teste operacional com a Anthropic",
        400
      )
    }

    return buildValidResult(
      "anthropic",
      "Chave Anthropic validada com sucesso e teste operacional concluído"
    )
  } catch (error) {
    return buildInvalidResult(
      "unknown_error",
      error.message || "Erro ao validar chave da Anthropic",
      500
    )
  }
}

async function validateGeminiKey(apiKey) {
  try {
    const modelsResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      {
        method: "GET"
      }
    )

    if (!modelsResponse.ok) {
      const errorBody = await safeJson(modelsResponse)

      if (modelsResponse.status === 400 || modelsResponse.status === 401) {
        return buildInvalidResult(
          "invalid_auth",
          "Falha na autenticação com o Gemini",
          400
        )
      }

      if (modelsResponse.status === 403) {
        return buildInvalidResult(
          "model_access_issue",
          "A chave do Gemini não possui acesso permitido",
          400
        )
      }

      if (modelsResponse.status === 429) {
        return buildInvalidResult(
          "billing_or_quota_issue",
          "A chave do Gemini autentica, mas há limite/quota/billing impedindo o uso",
          400
        )
      }

      return buildInvalidResult(
        "unknown_error",
        errorBody?.error?.message || "Falha ao validar chave do Gemini",
        400
      )
    }

    const runtimeResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "oi"
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 1
          }
        })
      }
    )

    if (!runtimeResponse.ok) {
      const errorBody = await safeJson(runtimeResponse)

      if (runtimeResponse.status === 400 || runtimeResponse.status === 401) {
        return buildInvalidResult(
          "invalid_auth",
          "Falha na autenticação com o Gemini",
          400
        )
      }

      if (runtimeResponse.status === 403) {
        return buildInvalidResult(
          "model_access_issue",
          "A chave do Gemini é válida, mas não possui acesso ao modelo de teste",
          400
        )
      }

      if (runtimeResponse.status === 429) {
        return buildInvalidResult(
          "billing_or_quota_issue",
          "A chave do Gemini autentica, mas o teste operacional falhou por limite/quota/billing",
          400
        )
      }

      return buildInvalidResult(
        "unknown_error",
        errorBody?.error?.message || "Falha no teste operacional com o Gemini",
        400
      )
    }

    return buildValidResult(
      "gemini",
      "Chave Gemini validada com sucesso e teste operacional concluído"
    )
  } catch (error) {
    return buildInvalidResult(
      "unknown_error",
      error.message || "Erro ao validar chave do Gemini",
      500
    )
  }
}

async function validateProviderKey(provider, apiKey) {
  if (provider === "openai") {
    return validateOpenAiKey(apiKey)
  }

  if (provider === "anthropic") {
    return validateAnthropicKey(apiKey)
  }

  if (provider === "gemini") {
    return validateGeminiKey(apiKey)
  }

  return buildInvalidResult(
    "unsupported_provider",
    "Provider inválido. Use openai, anthropic ou gemini",
    400
  )
}

module.exports = {
  validateProviderKey
}