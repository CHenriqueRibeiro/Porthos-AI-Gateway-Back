const modelPricingService = require("./modelPricing.service")

const LLM_PRICES_URL = "https://www.llm-prices.com/current-v1.json"

const VENDOR_TO_PROVIDER = {
  google: "gemini"
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
}

function normalizeProvider(vendor) {
  return VENDOR_TO_PROVIDER[vendor] || vendor
}

function normalizePriceItem(item) {
  if (!item || typeof item !== "object") return null

  if (
    typeof item.id !== "string" ||
    typeof item.vendor !== "string" ||
    !isFiniteNumber(item.input) ||
    !isFiniteNumber(item.output)
  ) {
    return null
  }

  return {
    provider: normalizeProvider(item.vendor),
    model: item.id,
    inputPer1k: item.input / 1000,
    outputPer1k: item.output / 1000,
    currency: "USD",
    isActive: true
  }
}

function normalizeLlmPricesPayload(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.prices)) {
    throw new Error("Formato invalido do catalogo llm-prices")
  }

  const items = payload.prices.map(normalizePriceItem).filter(Boolean)

  if (!items.length) {
    throw new Error("Catalogo llm-prices sem precos validos")
  }

  return {
    updatedAt: payload.updated_at || null,
    items
  }
}

async function fetchLlmPrices(fetcher = fetch) {
  const response = await fetcher(LLM_PRICES_URL)

  if (!response.ok) {
    throw new Error(`Falha ao buscar llm-prices: HTTP ${response.status}`)
  }

  return normalizeLlmPricesPayload(await response.json())
}

async function syncLlmPrices({ fetcher = fetch } = {}) {
  const catalog = await fetchLlmPrices(fetcher)
  const result = await modelPricingService.syncModelPricing(catalog.items)

  return {
    source: LLM_PRICES_URL,
    updatedAt: catalog.updatedAt,
    received: catalog.items.length,
    ...result
  }
}

module.exports = {
  LLM_PRICES_URL,
  normalizeLlmPricesPayload,
  syncLlmPrices
}
