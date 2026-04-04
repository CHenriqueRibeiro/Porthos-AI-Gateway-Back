function onlyDigits(value = "") {
  return String(value).replace(/\D+/g, "")
}

function normalizeMoney(value = "") {
  const text = String(value).replace(/[^\d,.-]/g, "").trim()

  if (!text) return null

  if (text.includes(",") && text.includes(".")) {
    return text.replace(/\./g, "").replace(",", ".")
  }

  if (text.includes(",")) {
    return text.replace(",", ".")
  }

  return text
}

function normalizeDateBrToIso(value = "") {
  const match = String(value).match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/)
  if (!match) return null

  const [, dd, mm, yyyy] = match
  return `${yyyy}-${mm}-${dd}`
}

function uniqueByValue(items = []) {
  const seen = new Set()
  const result = []

  for (const item of items) {
    const key = `${item.fieldType || ""}:${item.value || ""}:${item.line || ""}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }

  return result
}

function extractLines(text = "") {
  return String(text)
    .split("\n")
    .map((line, index) => ({
      lineNumber: index + 1,
      text: line.trim()
    }))
    .filter((item) => item.text)
}

function pushCandidate(bucket, candidate) {
  if (!candidate || !candidate.value) return
  bucket.push(candidate)
}

function extractCpfCandidates(lines) {
  const result = []

  for (const line of lines) {
    const matches = line.text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g) || []

    for (const match of matches) {
      pushCandidate(result, {
        fieldType: "cpf",
        value: onlyDigits(match),
        source: "regex_cpf",
        label: /cpf/i.test(line.text) ? "CPF" : null,
        line: line.lineNumber,
        confidence: /cpf/i.test(line.text) ? 0.99 : 0.93
      })
    }
  }

  return uniqueByValue(result)
}

function extractCnpjCandidates(lines) {
  const result = []

  for (const line of lines) {
    const matches = line.text.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g) || []

    for (const match of matches) {
      pushCandidate(result, {
        fieldType: "cnpj",
        value: onlyDigits(match),
        source: "regex_cnpj",
        label: /cnpj/i.test(line.text) ? "CNPJ" : null,
        line: line.lineNumber,
        confidence: /cnpj/i.test(line.text) ? 0.99 : 0.93
      })
    }
  }

  return uniqueByValue(result)
}

function extractPhoneCandidates(lines) {
  const result = []

  for (const line of lines) {
    const matches =
      line.text.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4})-?\d{4}\b/g) || []

    for (const match of matches) {
      const digits = onlyDigits(match)

      if (digits.length < 10 || digits.length > 13) continue

      pushCandidate(result, {
        fieldType: "telefone",
        value: digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits,
        source: "regex_phone",
        label: /(telefone|celular|fone|contato|whatsapp)/i.test(line.text)
          ? "Telefone"
          : null,
        line: line.lineNumber,
        confidence: /(telefone|celular|fone|contato|whatsapp)/i.test(line.text)
          ? 0.98
          : 0.9
      })
    }
  }

  return uniqueByValue(result)
}

function extractEmailCandidates(lines) {
  const result = []

  for (const line of lines) {
    const matches = line.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []

    for (const match of matches) {
      pushCandidate(result, {
        fieldType: "email",
        value: match.toLowerCase(),
        source: "regex_email",
        label: /email|e-mail/i.test(line.text) ? "Email" : null,
        line: line.lineNumber,
        confidence: 0.99
      })
    }
  }

  return uniqueByValue(result)
}

function extractDateCandidates(lines) {
  const result = []

  for (const line of lines) {
    const matches = line.text.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) || []

    for (const match of matches) {
      const iso = normalizeDateBrToIso(match)
      if (!iso) continue

      let label = null
      let confidence = 0.9

      if (/venc/i.test(line.text)) {
        label = "Vencimento"
        confidence = 0.96
      } else if (/emiss|gera/i.test(line.text)) {
        label = "Data de emissão"
        confidence = 0.94
      } else if (/pagamento/i.test(line.text)) {
        label = "Data de pagamento"
        confidence = 0.93
      } else if (/consulta|agendamento/i.test(line.text)) {
        label = "Data"
        confidence = 0.95
      }

      pushCandidate(result, {
        fieldType: "data",
        value: iso,
        source: "date_parser",
        label,
        line: line.lineNumber,
        confidence
      })
    }
  }

  return uniqueByValue(result)
}

function extractTimeCandidates(lines) {
  const result = []

  for (const line of lines) {
    const matches = line.text.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/g) || []

    for (const match of matches) {
      pushCandidate(result, {
        fieldType: "hora",
        value: match,
        source: "time_parser",
        label: /(hora|horário|horario)/i.test(line.text) ? "Horário" : null,
        line: line.lineNumber,
        confidence: /(hora|horário|horario)/i.test(line.text) ? 0.96 : 0.9
      })
    }
  }

  return uniqueByValue(result)
}

function extractMoneyCandidates(lines) {
  const result = []

  for (const line of lines) {
    const matches = line.text.match(/R\$\s?\d{1,3}(?:\.\d{3})*,\d{2}|\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g) || []

    for (const match of matches) {
      const normalized = normalizeMoney(match)
      if (!normalized) continue

      let label = null
      let confidence = 0.9

      if (/valor total|total da fatura|total a pagar|valor em aberto|valor|total do pedido|valor mensal/i.test(line.text)) {
        label = "Valor"
        confidence = 0.97
      }

      pushCandidate(result, {
        fieldType: "valor",
        value: normalized,
        source: "currency_parser",
        label,
        line: line.lineNumber,
        confidence
      })
    }
  }

  return uniqueByValue(result)
}

function extractBarcodeCandidates(lines) {
  const result = []

  for (const line of lines) {
    const compact = line.text.replace(/\s+/g, " ")
    const matches =
      compact.match(/\b\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}\s\d\s\d{14}\b/g) || []

    for (const match of matches) {
      pushCandidate(result, {
        fieldType: "codigo_barras",
        value: onlyDigits(match),
        source: "barcode_parser",
        label: /(c[oó]digo de barras|linha digit[aá]vel)/i.test(line.text)
          ? "Código de barras"
          : null,
        line: line.lineNumber,
        confidence: 0.99
      })
    }
  }

  return uniqueByValue(result)
}

function extractLabeledTextCandidates(lines) {
  const result = []

  const labelMap = [
    { regex: /^(cliente|titular|assinante|contratante|paciente|nome do cliente|nome do paciente|nome)\s*:\s*(.+)$/i, fieldType: "nome", confidence: 0.93 },
    { regex: /^(endere[cç]o|logradouro|rua|local da entrega|entrega)\s*:\s*(.+)$/i, fieldType: "endereco", confidence: 0.94 },
    { regex: /^(cidade)\s*:\s*(.+)$/i, fieldType: "cidade", confidence: 0.94 },
    { regex: /^(bairro)\s*:\s*(.+)$/i, fieldType: "bairro", confidence: 0.94 },
    { regex: /^(protocolo|n[úu]mero do protocolo|numero do protocolo|nro protocolo)\s*:\s*(.+)$/i, fieldType: "protocolo", confidence: 0.95 },
    { regex: /^(contrato|n[úu]mero do contrato|numero do contrato)\s*:\s*(.+)$/i, fieldType: "numero_contrato", confidence: 0.95 },
    { regex: /^(pedido|n[úu]mero do pedido|numero do pedido)\s*:\s*(.+)$/i, fieldType: "numero_pedido", confidence: 0.95 },
    { regex: /^(especialidade|especialista)\s*:\s*(.+)$/i, fieldType: "especialidade", confidence: 0.92 },
    { regex: /^(m[eé]dico|medico|doutor|profissional)\s*:\s*(.+)$/i, fieldType: "medico", confidence: 0.92 },
    { regex: /^(unidade|cl[ií]nica|clinica|local)\s*:\s*(.+)$/i, fieldType: "unidade", confidence: 0.91 },
    { regex: /^(forma de pagamento|pagamento)\s*:\s*(.+)$/i, fieldType: "forma_pagamento", confidence: 0.9 },
    { regex: /^(status|situa[cç][aã]o|situacao)\s*:\s*(.+)$/i, fieldType: "status", confidence: 0.9 },
    { regex: /^(observa[cç][aã]o|observacao|obs)\s*:\s*(.+)$/i, fieldType: "observacao", confidence: 0.88 }
  ]

  for (const line of lines) {
    for (const item of labelMap) {
      const match = line.text.match(item.regex)
      if (!match) continue

      const label = match[1]
      const value = match[2]?.trim()

      pushCandidate(result, {
        fieldType: item.fieldType,
        value,
        source: "label_match",
        label,
        line: line.lineNumber,
        confidence: item.confidence
      })
    }
  }

  return uniqueByValue(result)
}

function buildBuckets(candidates = []) {
  const buckets = {}

  for (const candidate of candidates) {
    if (!buckets[candidate.fieldType]) {
      buckets[candidate.fieldType] = []
    }

    buckets[candidate.fieldType].push(candidate)
  }

  return buckets
}

function extractCandidates(text = "") {
  const lines = extractLines(text)

  const allCandidates = [
    ...extractCpfCandidates(lines),
    ...extractCnpjCandidates(lines),
    ...extractPhoneCandidates(lines),
    ...extractEmailCandidates(lines),
    ...extractDateCandidates(lines),
    ...extractTimeCandidates(lines),
    ...extractMoneyCandidates(lines),
    ...extractBarcodeCandidates(lines),
    ...extractLabeledTextCandidates(lines)
  ]

  const unique = uniqueByValue(allCandidates)

  return {
    lines,
    candidates: unique,
    buckets: buildBuckets(unique)
  }
}

module.exports = {
  extractCandidates
}