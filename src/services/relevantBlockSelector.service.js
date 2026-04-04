const { getDomainProfile } = require("../config/domainProfiles")
const { hashBlock } = require("./documentFingerprint.service")

function normalizeText(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function splitIntoBlocks(text = "") {
  const normalized = String(text).replace(/\r/g, "\n")

  const paragraphBlocks = normalized
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)

  if (paragraphBlocks.length > 1) {
    return paragraphBlocks.map((block, index) => ({
      id: `block_${index + 1}`,
      text: block,
      hash: hashBlock(block)
    }))
  }

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: `line_${index + 1}`,
      text: line,
      hash: hashBlock(line)
    }))
}

function getSchemaFields(responseFormat) {
  const properties = responseFormat?.json_schema?.schema?.properties || {}
  return Object.keys(properties)
}

function getAliasesForField(field, extractionProfile = "generic_document") {
  const profile = getDomainProfile(extractionProfile)
  const aliases = profile.aliases?.[field] || [field]
  return aliases.map(normalizeText)
}

function blockScore(blockText, aliases, candidates = []) {
  const normalizedBlock = normalizeText(blockText)
  let score = 0

  for (const alias of aliases) {
    if (!alias) continue
    if (normalizedBlock.includes(alias)) {
      score += 3
    }
  }

  for (const candidate of candidates) {
    const value = normalizeText(candidate?.value || "")
    const label = normalizeText(candidate?.label || "")

    if (value && normalizedBlock.includes(value)) {
      score += 2
    }

    if (label && normalizedBlock.includes(label)) {
      score += 2
    }
  }

  return score
}

function selectRelevantBlocks({
  text,
  responseFormat,
  extractionProfile = "generic_document",
  candidates = [],
  maxBlocks = 8
}) {
  const fields = getSchemaFields(responseFormat)
  const blocks = splitIntoBlocks(text)

  if (!fields.length) {
    return blocks.slice(0, maxBlocks)
  }

  const scoredBlocks = blocks.map((block) => {
    let score = 0

    for (const field of fields) {
      const aliases = getAliasesForField(field, extractionProfile)
      const fieldCandidates = candidates.filter((item) => {
        const fieldType = normalizeText(item.fieldType || "")
        return aliases.some((alias) => fieldType.includes(alias) || alias.includes(fieldType))
      })

      score += blockScore(block.text, aliases, fieldCandidates)
    }

    return {
      ...block,
      score
    }
  })

  const ranked = scoredBlocks
    .sort((a, b) => b.score - a.score)
    .filter((item) => item.score > 0)

  if (!ranked.length) {
    return blocks.slice(0, maxBlocks)
  }

  return ranked.slice(0, maxBlocks)
}

module.exports = {
  splitIntoBlocks,
  selectRelevantBlocks
}