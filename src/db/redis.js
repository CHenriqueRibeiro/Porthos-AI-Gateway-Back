const Redis = require("ioredis")

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379"

const redis = new Redis(redisUrl)

redis.on("connect", () => {
  console.log("Redis conectado")
})

redis.on("error", (err) => {
  console.error("Erro Redis:", err)
})

module.exports = redis