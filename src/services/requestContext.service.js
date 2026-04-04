const crypto = require("crypto")

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

function getLastUserMessage(messages = []) {
  const normalized = normalizeMessages(messages)

  return [...normalized].reverse().find((msg) => msg.role === "user") || null
}

function buildStableHash(input) {
  return crypto
    .createHash("sha256")
    .update(typeof input === "string" ? input : JSON.stringify(input))
    .digest("hex")
}

function buildConversationSignature({
  messages = [],
  responseFormat = null,
  extractionProfile = null,
  model = null
}) {
  const normalized = normalizeMessages(messages)

  return buildStableHash({
    messages: normalized,
    responseFormat,
    extractionProfile,
    model
  })
}

function buildSystemSignature(messages = []) {
  const { systemMessages } = splitMessages(messages)
  return buildStableHash(systemMessages)
}

function buildPromptMessagesFromInput({
  messages = [],
  sessionSummary = null,
  maxConversationMessages = 8
}) {
  const { systemMessages, conversationalMessages } = splitMessages(messages)

  const recentConversation = conversationalMessages.slice(-maxConversationMessages)

  const output = [...systemMessages]

  if (sessionSummary && conversationalMessages.length <= 2) {
    output.push({
      role: "system",
      content: `Resumo da sessão anterior:\n${sessionSummary}`
    })
  }

  output.push(...recentConversation)

  return output
}

module.exports = {
  normalizeMessages,
  splitMessages,
  getLastUserMessage,
  buildConversationSignature,
  buildSystemSignature,
  buildPromptMessagesFromInput
}