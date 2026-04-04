const OpenAI = require("openai")
const env = require("../config/env")
const redis = require("../db/redis")
const { createFingerprint } = require("../utils/fingerprint")

const client = new OpenAI({
  apiKey: env.openAiApiKey
})

async function generateEmbedding(text) {
  const fingerprint = createFingerprint(text)
  const redisKey = `embedding:${fingerprint}`

  const cached = await redis.get(redisKey)

  if (cached) {
    return JSON.parse(cached)
  }

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  })

  const embedding = response.data[0].embedding

  await redis.set(redisKey, JSON.stringify(embedding), "EX", 86400)

  return embedding
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

module.exports = {
  generateEmbedding,
  cosineSimilarity
}