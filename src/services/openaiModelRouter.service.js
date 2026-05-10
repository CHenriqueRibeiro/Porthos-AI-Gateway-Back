const modelPricingService = require("./modelPricing.service")

const ROUTING_MODES = new Set(["auto", "economy", "balanced", "quality"])
const catalogCache = {
  expiresAt: 0,
  items: []
}
const accessCache = new Map()
const CATALOG_TTL_MS = 5 * 60 * 1000
const ACCESS_TTL_MS = 10 * 60 * 1000

function normalizeModel(model = "") {
  return String(model || "").includes("/")
    ? String(model).split("/").slice(1).join("/")
    : String(model || "")
}

function toOpenAiModelRef(model) {
  const normalized = normalizeModel(model)
  return normalized ? `openai/${normalized}` : null
}

function normalizeRoutingMode(model, routingPreference) {
  const rawModel = String(model || "").trim().toLowerCase()
  const rawPreference = String(routingPreference || "").trim().toLowerCase()

  if (rawModel === "auto" || rawModel === "openai/auto") {
    return ROUTING_MODES.has(rawPreference) && rawPreference !== "auto"
      ? rawPreference
      : "auto"
  }

  if (ROUTING_MODES.has(rawModel)) return rawModel
  if (!rawModel && ROUTING_MODES.has(rawPreference)) return rawPreference

  return null
}

function isOpenAiModel(model = "") {
  const value = String(model || "").trim()
  return !value.includes("/") || value.startsWith("openai/")
}

function supportsTemperature(model = "") {
  const normalized = normalizeModel(model).toLowerCase()

  // Modelos de raciocinio da OpenAI costumam rejeitar temperature/top_p.
  return !/^(o\d|o\d-|o[1-9]|gpt-5)/.test(normalized)
}

function usesMaxCompletionTokens(model = "") {
  const normalized = normalizeModel(model).toLowerCase()

  return /^(o\d|o\d-|o[1-9]|gpt-5)/.test(normalized)
}

/**
 * RANK DE INTELIGÊNCIA - CONFIGURAÇÃO POR LISTA BRANCA
 */
function getModelFamilyRank(model = "") {
  const normalized = normalizeModel(model).toLowerCase();
  
  // Modelos de Ultra Alta Performance (Quality)
  const qualityModels = ["gpt-5", "gpt-5.2", "gpt-5.4"];
  // Modelos de Raciocínio de Entrada (Balanced/Small Reasoning)
  const smallReasoning = ["gpt-5-mini", "gpt-5-nano"];

  if (qualityModels.some(m => normalized === m || normalized === `openai/${m}`)) return 3;
  if (smallReasoning.some(m => normalized.includes(m))) return 3;

  // Modelos Rápidos e Diretos
  if (normalized.includes("mini") || normalized.includes("nano")) return 1;
  if (normalized.includes("4o") || normalized.includes("4.1")) return 2;
  
  return 2;
}

/**
 * ESCOLHA DO CANDIDATO
 */
function chooseBestCandidate({
  candidates,
  mode,
  workloadCategory,
  responseFormat
}) {
  const targetRank = getTargetRank(mode, workloadCategory, responseFormat);
  
  // Filtro de Segurança: Apenas Chat + Modelos Permitidos
  const pool = candidates.filter((item) => {
    const normalized = normalizeModel(item.model).toLowerCase();
    
    // Se for da família 5, verificamos se está na sua lista permitida
    if (normalized.includes("gpt-5")) {
      const allowed = ["gpt-5", "gpt-5.2", "gpt-5.4", "gpt-5-mini", "gpt-5-nano"];
      return allowed.some(m => normalized.includes(m)) && isChatModel(item.model);
    }
    
    // Bloqueia modelos "o1", "o3", etc, a menos que você peça no futuro
    if (normalized.startsWith("o1") || normalized.startsWith("o3")) return false;

    return isChatModel(item.model);
  });

  if (mode === "quality") {
    // No modo Quality, priorizamos os Pesos Pesados (5, 5.2, 5.4)
    return [...pool].sort((a, b) => {
      const rankA = getModelFamilyRank(a.model);
      const rankB = getModelFamilyRank(b.model);
      if (rankB !== rankA) return rankB - rankA;
      
      // Se ambos forem Rank 3, priorizamos a versão mais nova (5.4 > 5.2 > 5)
      return b.model.localeCompare(a.model) || scorePrice(a) - scorePrice(b);
    })[0];
  }

  if (mode === "economy") {
    // Mantemos a trava: Economia usa modelos sem "imposto de pensamento" (Rank < 3)
    const economyPool = pool.filter(item => getModelFamilyRank(item.model) < 3);
    const finalPool = economyPool.length > 0 ? economyPool : pool;
    return [...finalPool].sort((a, b) => scorePrice(a) - scorePrice(b))[0];
  }

  // Modo Balanced
  return pool
    .map((item) => ({
      item,
      rank: getModelFamilyRank(item.model),
      price: scorePrice(item)
    }))
    .sort((a, b) =>
      Math.abs(a.rank - targetRank) - Math.abs(b.rank - targetRank) || a.price - b.price
    )[0]?.item || null;
}

function isChatModel(model = "") {
  const normalized = normalizeModel(model).toLowerCase()

  return (
    normalized.startsWith("gpt-") ||
    /^o\d/.test(normalized) ||
    normalized.startsWith("chatgpt-")
  ) && !normalized.includes("image")
}

function getWorkloadRank(workloadCategory, responseFormat) {
  if (responseFormat?.type === "json_schema") return 3
  if (workloadCategory === "heavy") return 3
  if (workloadCategory === "medium") return 2
  return 1
}

function getTargetRank(mode, workloadCategory, responseFormat) {
  const workloadRank = getWorkloadRank(workloadCategory, responseFormat)

  if (mode === "economy") return 1
  if (mode === "quality") return Math.max(2, workloadRank)

  return workloadRank
}

function scorePrice(item) {
  return Number(item.inputPer1k || 0) + Number(item.outputPer1k || 0)
}

async function getOpenAiCatalog() {
  const now = Date.now()

  if (catalogCache.expiresAt > now) {
    return catalogCache.items
  }

  const items = await modelPricingService.listActiveModelPricingByProvider("openai")
  catalogCache.items = items
  catalogCache.expiresAt = now + CATALOG_TTL_MS

  return items
}

async function getAccessibleModelIds({ providerKeyId, apiKey }) {
  const now = Date.now()
  const cached = accessCache.get(providerKeyId)

  if (cached?.expiresAt > now) {
    return cached.modelIds
  }

  let response = null

  try {
    response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })
  } catch (error) {
    return null
  }

  if (!response.ok) return null

  const data = await response.json()
  const modelIds = new Set((data.data || []).map((item) => item.id).filter(Boolean))

  accessCache.set(providerKeyId, {
    expiresAt: now + ACCESS_TTL_MS,
    modelIds
  })

  return modelIds
}

function isAccessible(modelIds, model) {
  if (!modelIds) return true

  const normalized = normalizeModel(model)
  const withoutDate = normalized.replace(/-\d{4}-\d{2}-\d{2}$/, "")

  return modelIds.has(normalized) || modelIds.has(withoutDate)
}



async function resolveOpenAiModel({
  requestedModel,
  routingPreference = "balanced",
  workloadCategory = "light",
  responseFormat = null,
  temperature,
  providerKey = null
}) {
  const mode = normalizeRoutingMode(requestedModel, routingPreference)

  if (!mode) {
    if (providerKey) {
      const accessibleModelIds = await getAccessibleModelIds({
        providerKeyId: providerKey.id,
        apiKey: providerKey.apiKey
      })

      if (!isAccessible(accessibleModelIds, requestedModel)) {
        const error = new Error(
          `A chave OpenAI cadastrada nao possui acesso ao modelo ${normalizeModel(requestedModel)}`
        )
        error.statusCode = 403
        throw error
      }
    }

    return {
      model: toOpenAiModelRef(requestedModel),
      routingMode: "manual",
      autoSelected: false,
      supportsTemperature: supportsTemperature(requestedModel)
    }
  }

  const catalog = await getOpenAiCatalog()
  const activeOpenAiModels = catalog.filter((item) => item?.model)

  if (activeOpenAiModels.length === 0) {
    return {
      model: "openai/gpt-4o-mini",
      routingMode: mode,
      autoSelected: true,
      supportsTemperature: true,
      routingReason: "fallback_no_catalog"
    }
  }

  const accessibleModelIds = providerKey
    ? await getAccessibleModelIds({
        providerKeyId: providerKey.id,
        apiKey: providerKey.apiKey
      })
    : null

  const accessibleCatalog = activeOpenAiModels.filter((item) =>
    isAccessible(accessibleModelIds, item.model)
  )
  const candidates = accessibleCatalog.length > 0
    ? accessibleCatalog
    : activeOpenAiModels
  const selected = chooseBestCandidate({
    candidates,
    mode,
    workloadCategory,
    responseFormat,
    requireTemperature: typeof temperature === "number"
  })

  return {
    model: toOpenAiModelRef(selected?.model || activeOpenAiModels[0].model),
    routingMode: mode,
    autoSelected: true,
    supportsTemperature: supportsTemperature(selected?.model),
    routingReason: `${mode}_${workloadCategory}`,
    catalogSize: activeOpenAiModels.length,
    accessibleCatalogSize: accessibleCatalog.length
  }
}

module.exports = {
  ROUTING_MODES,
  isOpenAiModel,
  supportsTemperature,
  usesMaxCompletionTokens,
  resolveOpenAiModel
}
