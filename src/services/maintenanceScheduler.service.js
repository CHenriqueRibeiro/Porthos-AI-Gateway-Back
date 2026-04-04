const { runMaintenanceForAllApiKeys } = require("./maintenance.service")

function startMaintenanceScheduler() {
  const enabled = process.env.MAINTENANCE_SCHEDULER_ENABLED === "true"
  const intervalMinutes = Number(process.env.MAINTENANCE_INTERVAL_MINUTES || 60)

  if (!enabled) {
    console.log("[MAINTENANCE] scheduler desativado")
    return
  }

  const intervalMs = intervalMinutes * 60 * 1000

  console.log(
    `[MAINTENANCE] scheduler ativado para rodar a cada ${intervalMinutes} minuto(s)`
  )

  setInterval(async () => {
    try {
      console.log("[MAINTENANCE] iniciando execução automática")
      await runMaintenanceForAllApiKeys()
      console.log("[MAINTENANCE] execução automática finalizada")
    } catch (error) {
      console.error("[MAINTENANCE] erro na execução automática:", error.message)
    }
  }, intervalMs)
}

module.exports = {
  startMaintenanceScheduler
}