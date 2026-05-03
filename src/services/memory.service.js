async function updateConversationSummary() {
  // BYOK mode: avoid platform-owned LLM calls for automatic summaries.
  return null
}

module.exports = {
  updateConversationSummary
}
