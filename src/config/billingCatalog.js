const PLAN_TYPES = {
  FREE: "free",
  PAID: "paid",
  ENTERPRISE: "enterprise"
}

const FEATURE_KEYS = {
  CACHE_INTELIGENTE: "cache_inteligente",
  HISTORICO_OPERACIONAL: "historico_operacional",
  MEMORIA_CONTEUDO: "memoria_conteudo",
  BASE_INTELIGENTE: "base_inteligente",
  ANALYTICS: "analytics",
  API_KEYS: "api_keys",
  STORAGE: "storage",
  CONCURRENCY: "concurrency"
}

const FEATURE_PRESETS = {
  cache_inteligente: {
    desativado: {
      key: "desativado",
      label: "Desativado",
      enabled: false,
      redisEnabled: false,
      semanticEnabled: false,
      ttlHours: 0,
      semanticRetentionDays: 0
    },
    starter: {
      key: "starter",
      label: "Starter",
      enabled: true,
      redisEnabled: true,
      semanticEnabled: true,
      ttlHours: 6,
      semanticRetentionDays: 1
    },
    growth: {
      key: "growth",
      label: "Growth",
      enabled: true,
      redisEnabled: true,
      semanticEnabled: true,
      ttlHours: 24,
      semanticRetentionDays: 7
    },
    pro: {
      key: "pro",
      label: "Pro",
      enabled: true,
      redisEnabled: true,
      semanticEnabled: true,
      ttlHours: 24 * 7,
      semanticRetentionDays: 30
    },
    scale: {
      key: "scale",
      label: "Scale",
      enabled: true,
      redisEnabled: true,
      semanticEnabled: true,
      ttlHours: 24 * 30,
      semanticRetentionDays: 90
    },
    redis_24h_semantic_3d: {
      key: "redis_24h_semantic_3d",
      label: "Redis 24h + Semantico 3 dias",
      enabled: true,
      redisEnabled: true,
      semanticEnabled: true,
      ttlHours: 24,
      semanticRetentionDays: 3
    },
    redis_7d_semantic_15d: {
      key: "redis_7d_semantic_15d",
      label: "Redis 7 dias + Semantico 15 dias",
      enabled: true,
      redisEnabled: true,
      semanticEnabled: true,
      ttlHours: 24 * 7,
      semanticRetentionDays: 15
    },
    redis_30d_semantic_60d: {
      key: "redis_30d_semantic_60d",
      label: "Redis 30 dias + Semantico 60 dias",
      enabled: true,
      redisEnabled: true,
      semanticEnabled: true,
      ttlHours: 24 * 30,
      semanticRetentionDays: 60
    }
  },

  historico_operacional: {
    dias_7: {
      key: "dias_7",
      label: "7 dias",
      retentionDays: 7
    },
    dias_30: {
      key: "dias_30",
      label: "30 dias",
      retentionDays: 30
    },
    dias_60: {
      key: "dias_60",
      label: "60 dias",
      retentionDays: 60
    },
    dias_90: {
      key: "dias_90",
      label: "90 dias",
      retentionDays: 90
    },
    dias_180: {
      key: "dias_180",
      label: "180 dias",
      retentionDays: 180
    },
    dias_365: {
      key: "dias_365",
      label: "365 dias",
      retentionDays: 365
    }
  },

  memoria_conteudo: {
    desativada: {
      key: "desativada",
      label: "Desativada",
      enabled: false,
      retentionDays: 0,
      maxItems: 0
    },
    basica: {
      key: "basica",
      label: "Basica",
      enabled: true,
      retentionDays: 30,
      maxItems: 500
    },
    expandida: {
      key: "expandida",
      label: "Expandida",
      enabled: true,
      retentionDays: 90,
      maxItems: 5000
    },
    avancada: {
      key: "avancada",
      label: "Avancada",
      enabled: true,
      retentionDays: 180,
      maxItems: 20000
    },
    enterprise: {
      key: "enterprise",
      label: "Enterprise",
      enabled: true,
      retentionDays: 365,
      maxItems: 100000
    }
  },

  base_inteligente: {
    pequena: {
      key: "pequena",
      label: "Pequena",
      maxRecords: 10000
    },
    media: {
      key: "media",
      label: "Media",
      maxRecords: 50000
    },
    grande: {
      key: "grande",
      label: "Grande",
      maxRecords: 100000
    },
    enterprise: {
      key: "enterprise",
      label: "Enterprise",
      maxRecords: 500000
    }
  },

  analytics: {
    basico: {
      key: "basico",
      label: "Basico",
      level: "basic",
      retentionDays: 30
    },
    expandido: {
      key: "expandido",
      label: "Expandido",
      level: "expanded",
      retentionDays: 90
    },
    avancado: {
      key: "avancado",
      label: "Avancado",
      level: "advanced",
      retentionDays: 365
    }
  },

  api_keys: {
    uma: {
      key: "uma",
      label: "1 chave",
      maxApiKeys: 1
    },
    tres: {
      key: "tres",
      label: "3 chaves",
      maxApiKeys: 3
    },
    cinco: {
      key: "cinco",
      label: "5 chaves",
      maxApiKeys: 5
    },
    dez: {
      key: "dez",
      label: "10 chaves",
      maxApiKeys: 10
    },
    vinte_cinco: {
      key: "vinte_cinco",
      label: "25 chaves",
      maxApiKeys: 25
    },
    cinquenta: {
      key: "cinquenta",
      label: "50 chaves",
      maxApiKeys: 50
    },
    cem: {
      key: "cem",
      label: "100 chaves",
      maxApiKeys: 100
    }
  },

  storage: {
    mb_50: {
      key: "mb_50",
      label: "50 MB",
      storageMb: 50
    },
    mb_500: {
      key: "mb_500",
      label: "500 MB",
      storageMb: 500
    },
    gb_1: {
      key: "gb_1",
      label: "1 GB",
      storageMb: 1024
    },
    gb_2: {
      key: "gb_2",
      label: "2 GB",
      storageMb: 2048
    },
    gb_5: {
      key: "gb_5",
      label: "5 GB",
      storageMb: 5120
    },
    gb_10: {
      key: "gb_10",
      label: "10 GB",
      storageMb: 10240
    },
    gb_25: {
      key: "gb_25",
      label: "25 GB",
      storageMb: 25600
    },
    gb_50: {
      key: "gb_50",
      label: "50 GB",
      storageMb: 51200
    }
  },

  concurrency: {
    baixa: {
      key: "baixa",
      label: "Baixa",
      lightMaxInFlight: 10,
      mediumMaxInFlight: 3,
      heavyMaxInFlight: 1,
      heavyQueueWaitMs: 3000,
      pollIntervalMs: 250
    },
    media: {
      key: "media",
      label: "Media",
      lightMaxInFlight: 30,
      mediumMaxInFlight: 8,
      heavyMaxInFlight: 2,
      heavyQueueWaitMs: 5000,
      pollIntervalMs: 250
    },
    alta: {
      key: "alta",
      label: "Alta",
      lightMaxInFlight: 80,
      mediumMaxInFlight: 20,
      heavyMaxInFlight: 5,
      heavyQueueWaitMs: 8000,
      pollIntervalMs: 250
    },
    scale: {
      key: "scale",
      label: "Scale",
      lightMaxInFlight: 150,
      mediumMaxInFlight: 40,
      heavyMaxInFlight: 10,
      heavyQueueWaitMs: 10000,
      pollIntervalMs: 250
    }
  }
}

const DEFAULT_PLANS = [
  {
    code: "free",
    name: "Free",
    type: PLAN_TYPES.FREE,
    priceCents: 0,
    addonBudgetCents: 0,
    featurePresets: {
      cache_inteligente: "desativado",
      historico_operacional: "dias_7",
      memoria_conteudo: "desativada",
      base_inteligente: "pequena",
      analytics: "basico",
      api_keys: "uma",
      storage: "mb_50",
      concurrency: "baixa"
    }
  },
  {
    code: "starter",
    name: "Starter",
    type: PLAN_TYPES.PAID,
    priceCents: 7900,
    addonBudgetCents: 8000,
    featurePresets: {
      cache_inteligente: "starter",
      historico_operacional: "dias_30",
      memoria_conteudo: "basica",
      base_inteligente: "pequena",
      analytics: "basico",
      api_keys: "tres",
      storage: "mb_500",
      concurrency: "media"
    }
  },
  {
    code: "growth",
    name: "Growth",
    type: PLAN_TYPES.PAID,
    priceCents: 19900,
    addonBudgetCents: 20000,
    featurePresets: {
      cache_inteligente: "growth",
      historico_operacional: "dias_90",
      memoria_conteudo: "expandida",
      base_inteligente: "media",
      analytics: "expandido",
      api_keys: "dez",
      storage: "gb_2",
      concurrency: "alta"
    }
  },
  {
    code: "pro",
    name: "Pro",
    type: PLAN_TYPES.PAID,
    priceCents: 49900,
    addonBudgetCents: 30000,
    featurePresets: {
      cache_inteligente: "pro",
      historico_operacional: "dias_180",
      memoria_conteudo: "avancada",
      base_inteligente: "grande",
      analytics: "avancado",
      api_keys: "vinte_cinco",
      storage: "gb_10",
      concurrency: "alta"
    }
  },
  {
    code: "scale",
    name: "Scale",
    type: PLAN_TYPES.ENTERPRISE,
    priceCents: 99900,
    addonBudgetCents: 99999900,
    featurePresets: {
      cache_inteligente: "scale",
      historico_operacional: "dias_365",
      memoria_conteudo: "enterprise",
      base_inteligente: "enterprise",
      analytics: "avancado",
      api_keys: "cinquenta",
      storage: "gb_50",
      concurrency: "scale"
    }
  }
]

const DEFAULT_ADDONS = [
  {
    code: "api_keys_5",
    name: "+5 API Keys",
    featureKey: FEATURE_KEYS.API_KEYS,
    presetKey: "cinco",
    priceCents: 2900,
    allowedPlans: ["starter"]
  },
  {
    code: "api_keys_10",
    name: "+10 API Keys",
    featureKey: FEATURE_KEYS.API_KEYS,
    presetKey: "dez",
    priceCents: 4900,
    allowedPlans: ["growth"]
  },
  {
    code: "api_keys_25",
    name: "+25 API Keys",
    featureKey: FEATURE_KEYS.API_KEYS,
    presetKey: "vinte_cinco",
    priceCents: 9900,
    allowedPlans: ["pro"]
  },
  {
    code: "cache_starter_plus",
    name: "Cache Starter Plus",
    featureKey: FEATURE_KEYS.CACHE_INTELIGENTE,
    presetKey: "redis_24h_semantic_3d",
    priceCents: 2900,
    allowedPlans: ["starter"]
  },
  {
    code: "cache_growth_plus",
    name: "Cache Growth Plus",
    featureKey: FEATURE_KEYS.CACHE_INTELIGENTE,
    presetKey: "redis_7d_semantic_15d",
    priceCents: 7900,
    allowedPlans: ["growth"]
  },
  {
    code: "cache_pro_plus",
    name: "Cache Pro Plus",
    featureKey: FEATURE_KEYS.CACHE_INTELIGENTE,
    presetKey: "redis_30d_semantic_60d",
    priceCents: 17900,
    allowedPlans: ["pro"]
  },
  {
    code: "history_60d",
    name: "Historico 60 dias",
    featureKey: FEATURE_KEYS.HISTORICO_OPERACIONAL,
    presetKey: "dias_60",
    priceCents: 1900,
    allowedPlans: ["starter"]
  },
  {
    code: "history_180d",
    name: "Historico 180 dias",
    featureKey: FEATURE_KEYS.HISTORICO_OPERACIONAL,
    presetKey: "dias_180",
    priceCents: 4900,
    allowedPlans: ["growth"]
  },
  {
    code: "history_365d",
    name: "Historico 365 dias",
    featureKey: FEATURE_KEYS.HISTORICO_OPERACIONAL,
    presetKey: "dias_365",
    priceCents: 9900,
    allowedPlans: ["pro"]
  },
  {
    code: "analytics_advanced",
    name: "Analytics Avancado",
    featureKey: FEATURE_KEYS.ANALYTICS,
    presetKey: "avancado",
    priceCents: 7900,
    allowedPlans: ["growth"]
  },
  {
    code: "memory_advanced",
    name: "Memoria Avancada",
    featureKey: FEATURE_KEYS.MEMORIA_CONTEUDO,
    presetKey: "avancada",
    priceCents: 8900,
    allowedPlans: ["growth"]
  },
  {
    code: "memory_enterprise",
    name: "Memoria Enterprise",
    featureKey: FEATURE_KEYS.MEMORIA_CONTEUDO,
    presetKey: "enterprise",
    priceCents: 19900,
    allowedPlans: ["pro"]
  },
  {
    code: "storage_1gb",
    name: "Storage 1 GB",
    featureKey: FEATURE_KEYS.STORAGE,
    presetKey: "gb_1",
    priceCents: 1900,
    allowedPlans: ["starter"]
  },
  {
    code: "storage_5gb",
    name: "Storage 5 GB",
    featureKey: FEATURE_KEYS.STORAGE,
    presetKey: "gb_5",
    priceCents: 5900,
    allowedPlans: ["growth"]
  },
  {
    code: "storage_25gb",
    name: "Storage 25 GB",
    featureKey: FEATURE_KEYS.STORAGE,
    presetKey: "gb_25",
    priceCents: 19900,
    allowedPlans: ["pro"]
  }
]

const PLAN_ORDER = ["free", "starter", "growth", "pro", "scale"]

module.exports = {
  PLAN_TYPES,
  FEATURE_KEYS,
  FEATURE_PRESETS,
  DEFAULT_PLANS,
  DEFAULT_ADDONS,
  PLAN_ORDER
}
