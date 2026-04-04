function normalizeSpaces(text = "") {
  return String(text)
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function stripGreetingPrefix(text = "") {
  let result = text

  const patterns = [
    /^(oi|ol[aá]|opa|e ai|e aí|bom dia|boa tarde|boa noite)[,!.\s-]*/i,
    /^(por favor|pfv|por gentileza)[,!.\s-]*/i,
    /^(você consegue|vc consegue|consegue|pode me dizer|pode informar|gostaria de saber se você consegue)[,!.\s-]*/i
  ]

  let changed = true

  while (changed) {
    changed = false

    for (const pattern of patterns) {
      const next = result.replace(pattern, "").trim()
      if (next !== result) {
        result = next
        changed = true
      }
    }
  }

  return result
}

function stripTrailingCourtesy(text = "") {
  return String(text)
    .replace(/[,.!\s]+(por favor|por gentileza|obrigado|obrigada|valeu|grato|grata)\s*$/i, "")
    .trim()
}

function conservativeContextStrip(text = "") {
  const normalized = normalizeSpaces(text)
  const strippedPrefix = stripGreetingPrefix(normalized)
  const strippedSuffix = stripTrailingCourtesy(strippedPrefix)
  const finalText = normalizeSpaces(strippedSuffix)

  return {
    original: text,
    stripped: finalText || normalized,
    changed: (finalText || normalized) !== text
  }
}

module.exports = {
  conservativeContextStrip
}