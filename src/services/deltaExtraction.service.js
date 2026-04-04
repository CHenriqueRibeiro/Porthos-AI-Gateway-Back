const { hashBlock } = require("./documentFingerprint.service")

function normalizeBlocks(blocks = []) {
  return (blocks || []).map((block, index) => ({
    id: block.id || `block_${index + 1}`,
    text: String(block.text || ""),
    score: block.score || 0,
    hash: block.hash || hashBlock(block.text || "")
  }))
}

function buildDeltaAgainstPrevious({
  previousMemory,
  currentBlocks = []
}) {
  const normalizedCurrentBlocks = normalizeBlocks(currentBlocks)

  if (!previousMemory || !Array.isArray(previousMemory.blocks)) {
    return {
      hasPrevious: false,
      unchangedBlocks: [],
      changedBlocks: normalizedCurrentBlocks,
      changedBlockCount: normalizedCurrentBlocks.length,
      unchangedBlockCount: 0,
      reuseData: {},
      reuseConfidence: {},
      reuseProvenance: {}
    }
  }

  const previousBlocks = normalizeBlocks(previousMemory.blocks)
  const previousHashes = new Set(previousBlocks.map((block) => block.hash))

  const unchangedBlocks = normalizedCurrentBlocks.filter((block) =>
    previousHashes.has(block.hash)
  )

  const changedBlocks = normalizedCurrentBlocks.filter(
    (block) => !previousHashes.has(block.hash)
  )

  const previousData = previousMemory.extractedData || {}
  const previousConfidence = previousMemory.confidenceData || {}
  const previousProvenance = previousMemory.provenanceData || {}

  const reuseData = {}
  const reuseConfidence = {}
  const reuseProvenance = {}

  for (const [field, value] of Object.entries(previousData)) {
    if (!value) continue

    const provenance = previousProvenance[field]
    const source = provenance?.source || ""

    if (
      source === "regex_cpf" ||
      source === "regex_cnpj" ||
      source === "regex_phone" ||
      source === "regex_email" ||
      source === "label_match" ||
      source === "date_parser" ||
      source === "time_parser" ||
      source === "currency_parser" ||
      source === "barcode_parser" ||
      source === "session_memory"
    ) {
      reuseData[field] = value
      reuseConfidence[field] = previousConfidence[field] || 0.8
      reuseProvenance[field] = {
        source: "document_delta_reuse",
        label: provenance?.label || null,
        line: provenance?.line || null
      }
    }
  }

  return {
    hasPrevious: true,
    unchangedBlocks,
    changedBlocks,
    changedBlockCount: changedBlocks.length,
    unchangedBlockCount: unchangedBlocks.length,
    reuseData,
    reuseConfidence,
    reuseProvenance
  }
}

function applyDeltaReuse(localExtraction, deltaInfo) {
  if (!deltaInfo?.hasPrevious) {
    return localExtraction
  }

  const merged = {
    ...localExtraction,
    data: { ...localExtraction.data },
    confidence: { ...localExtraction.confidence },
    provenance: { ...localExtraction.provenance }
  }

  for (const [field, value] of Object.entries(deltaInfo.reuseData || {})) {
    if (merged.data[field]) continue

    merged.data[field] = value
    merged.confidence[field] = Number(
      ((deltaInfo.reuseConfidence?.[field] || 0.8) * 0.92).toFixed(2)
    )
    merged.provenance[field] = deltaInfo.reuseProvenance?.[field] || {
      source: "document_delta_reuse",
      label: null,
      line: null
    }
  }

  merged.missingRequiredFields = merged.missingRequiredFields.filter(
    (field) => !merged.data[field]
  )

  merged.fullyResolved =
    merged.missingRequiredFields.length === 0 &&
    Object.keys(merged.data).length > 0

  return merged
}

module.exports = {
  buildDeltaAgainstPrevious,
  applyDeltaReuse
}