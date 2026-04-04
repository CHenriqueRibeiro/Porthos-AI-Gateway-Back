const PLAN_TYPES = {
  FLEX: "flex",
  PRIME: "prime"
}

const FEATURE_KEYS = {
  CACHE_INTELIGENTE: "cache_inteligente",
  HISTORICO_OPERACIONAL: "historico_operacional",
  MEMORIA_CONTEUDO: "memoria_conteudo",
  BASE_INTELIGENTE: "base_inteligente",
  ANALYTICS: "analytics"
}

const FEATURE_PRESETS = {
  cache_inteligente: {
    padrao: {
      key: "padrao",
      label: "Padrão",
      ttlHours: 24
    },
    expandido: {
      key: "expandido",
      label: "Expandido",
      ttlHours: 24 * 7
    },
    avancado: {
      key: "avancado",
      label: "Avançado",
      ttlHours: 24 * 30
    }
  },

  historico_operacional: {
    dias_30: {
      key: "dias_30",
      label: "30 dias",
      retentionDays: 30
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
    basica: {
      key: "basica",
      label: "Básica",
      retentionDays: 30,
      maxItems: 500
    },
    expandida: {
      key: "expandida",
      label: "Expandida",
      retentionDays: 90,
      maxItems: 5000
    },
    avancada: {
      key: "avancada",
      label: "Avançada",
      retentionDays: 180,
      maxItems: 20000
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
      label: "Média",
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
      label: "Básico",
      retentionDays: 30
    },
    expandido: {
      key: "expandido",
      label: "Expandido",
      retentionDays: 90
    },
    avancado: {
      key: "avancado",
      label: "Avançado",
      retentionDays: 365
    }
  }
}

const DEFAULT_PLANS = [
  {
    code: "flex_start",
    name: "Flex Start",
    type: PLAN_TYPES.FLEX,
    priceCents: 9900,
    featurePresets: {
      cache_inteligente: "padrao",
      historico_operacional: "dias_30",
      memoria_conteudo: "basica",
      base_inteligente: "pequena",
      analytics: "basico"
    }
  },
  {
    code: "flex_pro",
    name: "Flex Pro",
    type: PLAN_TYPES.FLEX,
    priceCents: 24900,
    featurePresets: {
      cache_inteligente: "expandido",
      historico_operacional: "dias_90",
      memoria_conteudo: "expandida",
      base_inteligente: "media",
      analytics: "expandido"
    }
  },
  {
    code: "prime_start",
    name: "Prime Start",
    type: PLAN_TYPES.PRIME,
    priceCents: 49900,
    featurePresets: {
      cache_inteligente: "padrao",
      historico_operacional: "dias_30",
      memoria_conteudo: "basica",
      base_inteligente: "pequena",
      analytics: "basico"
    }
  },
  {
    code: "prime_pro",
    name: "Prime Pro",
    type: PLAN_TYPES.PRIME,
    priceCents: 99900,
    featurePresets: {
      cache_inteligente: "expandido",
      historico_operacional: "dias_90",
      memoria_conteudo: "expandida",
      base_inteligente: "media",
      analytics: "avancado"
    }
  }
]

const DEFAULT_ADDONS = [
  {
    code: "cache_expandido",
    name: "Cache Inteligente Expandido",
    featureKey: FEATURE_KEYS.CACHE_INTELIGENTE,
    presetKey: "expandido",
    priceCents: 1900
  },
  {
    code: "cache_avancado",
    name: "Cache Inteligente Avançado",
    featureKey: FEATURE_KEYS.CACHE_INTELIGENTE,
    presetKey: "avancado",
    priceCents: 3900
  },
  {
    code: "historico_90",
    name: "Histórico Operacional 90 dias",
    featureKey: FEATURE_KEYS.HISTORICO_OPERACIONAL,
    presetKey: "dias_90",
    priceCents: 1900
  },
  {
    code: "historico_180",
    name: "Histórico Operacional 180 dias",
    featureKey: FEATURE_KEYS.HISTORICO_OPERACIONAL,
    presetKey: "dias_180",
    priceCents: 3900
  },
  {
    code: "historico_365",
    name: "Histórico Operacional 365 dias",
    featureKey: FEATURE_KEYS.HISTORICO_OPERACIONAL,
    presetKey: "dias_365",
    priceCents: 6900
  },
  {
    code: "memoria_expandida",
    name: "Memória de Conteúdo Expandida",
    featureKey: FEATURE_KEYS.MEMORIA_CONTEUDO,
    presetKey: "expandida",
    priceCents: 2900
  },
  {
    code: "memoria_avancada",
    name: "Memória de Conteúdo Avançada",
    featureKey: FEATURE_KEYS.MEMORIA_CONTEUDO,
    presetKey: "avancada",
    priceCents: 5900
  },
  {
    code: "base_media",
    name: "Base Inteligente Média",
    featureKey: FEATURE_KEYS.BASE_INTELIGENTE,
    presetKey: "media",
    priceCents: 2900
  },
  {
    code: "base_grande",
    name: "Base Inteligente Grande",
    featureKey: FEATURE_KEYS.BASE_INTELIGENTE,
    presetKey: "grande",
    priceCents: 5900
  },
  {
    code: "base_enterprise",
    name: "Base Inteligente Enterprise",
    featureKey: FEATURE_KEYS.BASE_INTELIGENTE,
    presetKey: "enterprise",
    priceCents: 12900
  },
  {
    code: "analytics_expandido",
    name: "Analytics Expandido",
    featureKey: FEATURE_KEYS.ANALYTICS,
    presetKey: "expandido",
    priceCents: 1900
  },
  {
    code: "analytics_avancado",
    name: "Analytics Avançado",
    featureKey: FEATURE_KEYS.ANALYTICS,
    presetKey: "avancado",
    priceCents: 3900
  }
]

module.exports = {
  PLAN_TYPES,
  FEATURE_KEYS,
  FEATURE_PRESETS,
  DEFAULT_PLANS,
  DEFAULT_ADDONS
}