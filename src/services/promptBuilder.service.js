function normalizeMessages(messages = []) {
  return (messages || [])
    .filter(
      (msg) =>
        msg &&
        typeof msg.role === "string" &&
        typeof msg.content === "string" &&
        ["system", "user", "assistant"].includes(msg.role)
    )
    .map((msg) => ({
      role: msg.role,
      content: String(msg.content).trim()
    }))
    .filter((msg) => msg.content.length > 0)
}

function splitMessages(messages = []) {
  const normalized = normalizeMessages(messages)

  return {
    normalized,
    systemMessages: normalized.filter((msg) => msg.role === "system"),
    conversationalMessages: normalized.filter((msg) => msg.role !== "system")
  }
}

function buildPromptMessages({
  scope,
  optimizedContent,
  sessionSummary,
  recentMessages,
  messages
}) {
  const llmMessages = []

  // fluxo novo: quando vier array completo de messages
  if (Array.isArray(messages) && messages.length > 0) {
    const { systemMessages, conversationalMessages } = splitMessages(messages)

    // system sempre entra, porque pode ser o prompt do agente
    llmMessages.push(...systemMessages)

    // para perguntas globais, tenta economizar mais
    if (scope === "global") {
      const lastUser = [...conversationalMessages]
        .reverse()
        .find((msg) => msg.role === "user")

      if (lastUser) {
        llmMessages.push({
          role: "user",
          content: optimizedContent || lastUser.content
        })
      }

      return llmMessages
    }

    // para conversas privadas, usa resumo se existir
    if (sessionSummary) {
      llmMessages.push({
        role: "system",
        content: `Resumo da conversa até agora: ${sessionSummary}`
      })
    }

    // pega só as últimas mensagens conversacionais para não explodir token
    const trimmedConversation = conversationalMessages.slice(-8)
    llmMessages.push(...trimmedConversation)

    return llmMessages
  }

  // fluxo antigo: mantém compatibilidade com sua regra atual
  if (scope === "global") {
    llmMessages.push({
      role: "user",
      content: optimizedContent
    })

    return llmMessages
  }

  if (sessionSummary) {
    llmMessages.push({
      role: "system",
      content: `Resumo da conversa até agora: ${sessionSummary}`
    })
  }

  const historyMessages = (recentMessages || []).map((msg) => ({
    role: msg.role,
    content: msg.content
  }))

  llmMessages.push(...historyMessages)

  llmMessages.push({
    role: "user",
    content: optimizedContent
  })

  return llmMessages
}

module.exports = {
  buildPromptMessages
}