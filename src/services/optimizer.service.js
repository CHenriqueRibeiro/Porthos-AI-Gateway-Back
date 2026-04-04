const removablePatterns = [
  "ola",
  "olá",
  "me",
  "oi",
  "opa",
  "salve",
  "bom dia",
  "boa tarde",
  "boa noite",
  "por favor",
  "gentileza",
  "obrigado",
  "obrigada",
  "valeu",
  "tudo bem",
  "como vai",
  "fico no aguardo",
  "atenciosamente",
  "pfv"
].join("|")

const cleanRegex = new RegExp(`\\b(${removablePatterns})\\b`, "gi")

function optimizePrompt(content, scope) {
  const original = String(content || "")
  let optimized = original

  // remove espaços duplicados
  optimized = optimized.replace(/\s+/g, " ").trim()

  if (scope === "global") {

    // deixa tudo minúsculo
    optimized = optimized.toLowerCase()

    // remove acentos
    optimized = optimized
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")

    // remove palavras inúteis
    optimized = optimized.replace(cleanRegex, " ")

    // limpa espaços novamente
    optimized = optimized.replace(/\s+/g, " ").trim()
  }

  // fallback caso o prompt fique vazio
  if (!optimized) {
    optimized = original
  }

  return optimized
}

module.exports = {
  optimizePrompt
}