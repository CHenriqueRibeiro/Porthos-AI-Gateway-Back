export const API_ROUTES = {
  health: "/health",

  auth: {
    register: "/auth/register",
    login: "/auth/login",
    logout: "/auth/logout"
  },

  public: {
    plans: "/public/plans",
    simulatePlan: "/public/plans/simulate",
    recommendPlan: "/public/plans/recommend"
  },

  apiKeys: {
    list: "/apikeys",
    create: "/apikeys"
  },

  sessions: {
    create: "/sessions",
    list: "/sessions",
    detail: (sessionId: string) => `/sessions/${sessionId}`,
    close: (sessionId: string) => `/sessions/${sessionId}/close`,
    messages: (sessionId: string) => `/sessions/${sessionId}/messages`
  },

  messages: {
    create: "/messages"
  },

  llm: {
    chat: "/chat",
    extract: "/extract"
  },

  providerKeys: {
    list: "/provider-keys",
    create: "/provider-keys",
    setDefault: (providerKeyId: string) =>
      `/provider-keys/${providerKeyId}/default`,
    remove: (providerKeyId: string) => `/provider-keys/${providerKeyId}`
  },

  billing: {
    seed: "/billing/seed",
    plans: "/plans",
    currentSubscription: "/subscriptions/current",
    createOrReplaceSubscription: "/subscriptions",
    override: "/subscriptions/override"
  },

  analytics: {
    usage: (apiKeyId: string) => `/usage/${apiKeyId}`,
    dashboard: "/me/dashboard"
  },

  modelPricing: {
    list: "/model-pricing",
    upsert: "/model-pricing"
  },

  admin: {
    runMaintenance: "/admin/maintenance/run"
  }
} as const

export const PLAN_CODES = ["free", "starter", "growth", "pro", "scale"] as const

export const PROVIDERS = ["openai", "anthropic", "gemini"] as const

export const MODEL_PREFIXES = ["openai/", "anthropic/", "gemini/"] as const

export const FEATURE_PRESETS = {
  cache_inteligente: [
    "desativado",
    "starter",
    "growth",
    "pro",
    "scale",
    "redis_24h_semantic_3d",
    "redis_7d_semantic_15d",
    "redis_30d_semantic_60d"
  ],
  historico_operacional: [
    "dias_7",
    "dias_30",
    "dias_60",
    "dias_90",
    "dias_180",
    "dias_365"
  ],
  memoria_conteudo: [
    "desativada",
    "basica",
    "expandida",
    "avancada",
    "enterprise"
  ],
  base_inteligente: ["pequena", "media", "grande", "enterprise"],
  analytics: ["basico", "expandido", "avancado"],
  api_keys: ["uma", "tres", "cinco", "dez", "vinte_cinco", "cinquenta", "cem"],
  storage: ["mb_50", "mb_500", "gb_1", "gb_2", "gb_5", "gb_10", "gb_25", "gb_50"],
  concurrency: ["baixa", "media", "alta", "scale"]
} as const

export const ADDON_CODES = [
  "api_keys_5",
  "api_keys_10",
  "api_keys_25",
  "cache_starter_plus",
  "cache_growth_plus",
  "cache_pro_plus",
  "history_60d",
  "history_180d",
  "history_365d",
  "analytics_advanced",
  "memory_advanced",
  "memory_enterprise",
  "storage_1gb",
  "storage_5gb",
  "storage_25gb"
] as const
