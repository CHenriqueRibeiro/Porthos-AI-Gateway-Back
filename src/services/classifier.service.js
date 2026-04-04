const { normalizeText } = require("../utils/normalizeText")
const { detectSecrets } = require("../utils/secretDetector")

const privateKeywords = [
  "faturamento",
  "faturou",
  "fatura",
  "receita",
  "saldo",
  "lucro",
  "empresa",
  "minha empresa",
  "cpf",
  "cnpj",
  "cliente",
  "pedido",
  "email",
  "telefone",
  "credencial",
  "api key",
  "token",
  "senha",
  "password"
]

function classifyScope(message) {
  const text = normalizeText(message)

  if (detectSecrets(text)) {
    return "private"
  }

  if (privateKeywords.some((keyword) => text.includes(keyword))) {
    return "private"
  }

  return "global"
}

module.exports = {
  classifyScope
}