const prisma = require("../db/prisma")
const openaiService = require("./openia.service")

async function updateConversationSummary(sessionId) {
  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" }
  })

  if (messages.length < 12) {
    return
  }

  const text = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")

  const summaryPrompt = `
Resuma a conversa abaixo de forma curta e objetiva, preservando os pontos principais.

${text}
`

  const summary = await openaiService.generateResponse([
    { role: "user", content: summaryPrompt }
  ])

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      summary
    }
  })
}

module.exports = {
  updateConversationSummary
}