function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function extractNumbers(text = "") {
  const normalized = normalizeText(text)
  const matches = normalized.match(/\d+/g)
  return matches ? matches : []
}

function hasNumericConflict(questionA, questionB) {
  const numbersA = extractNumbers(questionA)
  const numbersB = extractNumbers(questionB)

  if (numbersA.length === 0 && numbersB.length === 0) {
    return false
  }

  if (numbersA.length !== numbersB.length) {
    return true
  }

  for (let i = 0; i < numbersA.length; i += 1) {
    if (numbersA[i] !== numbersB[i]) {
      return true
    }
  }

  return false
}

module.exports = {
  normalizeText,
  extractNumbers,
  hasNumericConflict
}