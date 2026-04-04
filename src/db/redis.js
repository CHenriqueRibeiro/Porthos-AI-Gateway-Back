const Redis = require("ioredis")

const redis = new Redis({
  host: "127.0.0.1",
  port: 6379
})

redis.on("connect", () => {
  console.log("Redis conectado")
})

redis.on("error", (err) => {
  console.error("Erro Redis:", err)
})

module.exports = redis