function normalize(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function detectDynamicIntent(content) {
  const text = normalize(content)

  if (
    text.includes("que dia e hj") ||
    text.includes("que dia e hoje") ||
    text.includes("qual a data de hoje") ||
    text.includes("data de hoje") ||
    text.includes("que dia do mes e hoje") ||
    text.includes("dia de hoje")
  ) {
    return "current_date"
  }

  if (
    text.includes("que horas sao agora") ||
    text.includes("que horas e agora") ||
    text.includes("que horas sao") ||
    text.includes("qual a hora") ||
    text.includes("hora atual") ||
    text.includes("horario atual")
  ) {
    return "current_time"
  }

  return null
}

function buildDynamicResponse(intent) {
  const now = new Date()

  if (intent === "current_date") {
    const formatted = now.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })

    return `Hoje é ${formatted}.`
  }

  if (intent === "current_time") {
    const formatted = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })

    return `Agora são ${formatted}.`
  }

  return null
}

module.exports = {
  detectDynamicIntent,
  buildDynamicResponse
}