const buildApp = require("./app")
const env = require("./config/env")

async function start() {
  const app = buildApp()

  try {
    await app.listen({
      port: env.port,
      host: "0.0.0.0"
    })

    console.log("Servidor rodando 🚀")
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

start()