const { extractCandidates } = require("./candidateExtractor.service")
const { getDomainProfile } = require("../config/domainProfiles")
const { selectRelevantBlocks } = require("./relevantBlockSelector.service")

function getSchemaProperties(responseFormat) {
  const properties =
    responseFormat?.json_schema?.schema?.properties || {}

  return Object.keys(properties)
}

function getRequiredFields(responseFormat) {
  return responseFormat?.json_schema?.schema?.required || []
}

function normalizeAlias(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function getProfileAliases(field, extractionProfile = "generic_document") {
  const profile = getDomainProfile(extractionProfile)
  const aliases = profile.aliases?.[field] || [field]
  return aliases.map(normalizeAlias)
}

function inferBucketNamesForField(field) {
  const aliasMap = {
    cpf: ["cpf"],
    cnpj: ["cnpj"],
    telefone: ["telefone"],
    email: ["email"],
    nome: ["nome"],
    nome_paciente: ["nome"],
    nome_cliente: ["nome"],
    vencimento: ["data"],
    data_agendamento: ["data"],
    hora_agendamento: ["hora"],
    valor: ["valor"],
    valor_total: ["valor"],
    codigo_barras: ["codigo_barras"],
    endereco: ["endereco"],
    endereco_entrega: ["endereco"],
    cidade: ["cidade"],
    bairro: ["bairro"],
    protocolo: ["protocolo"],
    numero_contrato: ["numero_contrato"],
    numero_pedido: ["numero_pedido"],
    especialidade: ["especialidade"],
    medico: ["medico"],
    unidade: ["unidade"],
    forma_pagamento: ["forma_pagamento"],
    observacao: ["observacao"],
    status: ["status"]
  }

  return aliasMap[field] || [field]
}

function scoreCandidateByAlias(candidate, aliases) {
  if (!candidate?.label) return 0

  const candidateLabel = normalizeAlias(candidate.label)

  const matched = aliases.some((alias) => candidateLabel.includes(alias))
  return matched ? 0.08 : 0
}

function chooseBestCandidate(field, buckets, extractionProfile = "generic_document") {
  const bucketNames = inferBucketNamesForField(field)
  let candidates = []

  for (const bucketName of bucketNames) {
    candidates = candidates.concat(buckets[bucketName] || [])
  }

  if (!candidates.length) return null

  const aliases = getProfileAliases(field, extractionProfile)

  const ranked = [...candidates].sort((a, b) => {
    const aScore = (a.confidence || 0) + scoreCandidateByAlias(a, aliases)
    const bScore = (b.confidence || 0) + scoreCandidateByAlias(b, aliases)

    return bScore - aScore
  })

  return ranked[0]
}

function buildLocalExtractionResult({
  responseFormat,
  text,
  extractionProfile = "generic_document"
}) {
  const properties = getSchemaProperties(responseFormat)
  const required = getRequiredFields(responseFormat)
  const extracted = extractCandidates(text)

  const data = {}
  const confidence = {}
  const provenance = {}
  const missingRequiredFields = []

  for (const field of properties) {
    const best = chooseBestCandidate(field, extracted.buckets, extractionProfile)

    if (best) {
      data[field] = best.value
      confidence[field] = Number((best.confidence || 0).toFixed(2))
      provenance[field] = {
        source: best.source,
        label: best.label || null,
        line: best.line || null
      }
    } else {
      data[field] = null
      confidence[field] = 0
      provenance[field] = {
        source: null,
        label: null,
        line: null
      }
    }

    if (required.includes(field) && !data[field]) {
      missingRequiredFields.push(field)
    }
  }

  const fullyResolved = missingRequiredFields.length === 0 && properties.length > 0

  const relevantBlocks = selectRelevantBlocks({
    text,
    responseFormat,
    extractionProfile,
    candidates: extracted.candidates,
    maxBlocks: 8
  })

  return {
    data,
    confidence,
    provenance,
    missingRequiredFields,
    fullyResolved,
    candidates: extracted.candidates,
    candidateCount: extracted.candidates.length,
    relevantBlocks
  }
}

function buildExtractionHint(localExtraction, extractionProfile = "generic_document") {
  const compactCandidates = localExtraction.candidates.slice(0, 30).map((item) => ({
    fieldType: item.fieldType,
    value: item.value,
    source: item.source,
    label: item.label,
    line: item.line,
    confidence: item.confidence
  }))

  const compactBlocks = (localExtraction.relevantBlocks || []).map((block) => ({
    id: block.id,
    score: block.score || 0,
    text: block.text
  }))

  return [
    `Use o perfil de extração: ${extractionProfile}.`,
    "Use os candidatos extraídos localmente abaixo como evidência preferencial.",
    "Use prioritariamente os blocos relevantes selecionados abaixo.",
    "Preencha apenas os campos pedidos no schema.",
    "Se algum campo não puder ser confirmado, retorne null ou string vazia conforme o contexto.",
    "Não invente valores.",
    `Blocos relevantes: ${JSON.stringify(compactBlocks)}`,
    `Candidatos: ${JSON.stringify(compactCandidates)}`
  ].join("\n")
}

module.exports = {
  buildLocalExtractionResult,
  buildExtractionHint
}