const prisma = require("../db/prisma")
const messageService = require("./message.service")
const providerKeyService = require("./providerKey.service")
const llmRouterService = require("./llmRouter.service")
const { estimateLlmCost } = require("./costEstimator.service")
const { classifyScope } = require("./classifier.service")
const fingerprintService = require("./fingerprint.service")
const semanticCacheService = require("./semanticCache.service")
const tokenUsageService = require("./tokenUsage.service")
const { estimateTokens } = require("../utils/tokenCounter")
const { optimizePrompt } = require("./optimizer.service")
const memoryService = require("./memory.service")
const sessionService = require("./session.service")
const { getRuntimePolicyForApiKey } = require("./subscriptionRuntime.service")
const { ensureSessionSystemSignature } = require("./sessionAgentState.service")
const {
  getSessionFieldMemory,
  upsertSessionFieldMemory,
  applySessionMemoryToExtraction
} = require("./fieldMemory.service")
const {
  findExactDocumentMemory,
  findLatestDocumentMemoryByProfile,
  saveDocumentMemory
} = require("./documentMemory.service")
const {
  buildDeltaAgainstPrevious,
  applyDeltaReuse
} = require("./deltaExtraction.service")
const { conservativeContextStrip } = require("./contextStripper.service")
const {
  buildLocalExtractionResult,
  buildExtractionHint
} = require("./extractionHelper.service")
const {
  detectDynamicIntent,
  buildDynamicResponse
} = require("./dynamic.service")
const { buildPromptMessages } = require("./promptBuilder.service")
const {
  normalizeMessages,
  getLastUserMessage,
  buildConversationSignature,
  buildSystemSignature
} = require("./requestContext.service")

async function runSafe(label, fn) {
  try {
    return await fn()
  } catch (error) {
    console.error(`[SAFE ERROR] ${label}:`, error.message)
    return null
  }
}

function normalizePersistedContent(content) {
  if (content === null || content === undefined) return ""
  return typeof content === "string" ? content : JSON.stringify(content)
}

async function shouldPersistMessagePair({
  sessionId,
  userContent,
  assistantContent
}) {
  const normalizedUserContent = normalizePersistedContent(userContent)
  const normalizedAssistantContent = normalizePersistedContent(assistantContent)

  const lastMessages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: 2
  })

  if (lastMessages.length < 2) {
    return true
  }

  const [lastAssistant, lastUser] = lastMessages

  const isDuplicatePair =
    lastAssistant?.role === "assistant" &&
    lastUser?.role === "user" &&
    lastUser.content === normalizedUserContent &&
    lastAssistant.content === normalizedAssistantContent

  return !isDuplicatePair
}

async function persistConversationTurnIfNeeded({
  sessionId,
  userContent,
  assistantContent
}) {
  const normalizedUserContent = normalizePersistedContent(userContent)
  const normalizedAssistantContent = normalizePersistedContent(assistantContent)

  const shouldPersist = await shouldPersistMessagePair({
    sessionId,
    userContent: normalizedUserContent,
    assistantContent: normalizedAssistantContent
  })

  if (!shouldPersist) {
    return false
  }

  await messageService.createMessage({
    sessionId,
    role: "user",
    content: normalizedUserContent
  })

  await messageService.createMessage({
    sessionId,
    role: "assistant",
    content: normalizedAssistantContent
  })

  return true
}

async function saveTokenUsage({
  apiKeyId,
  originalContent,
  optimizedContent,
  response,
  scope,
  cacheType,
  llmInputTokens = 0,
  llmOutputTokens = 0,
  provider = null,
  providerModel = null,
  keySource = null,
  estimatedCostInput = 0,
  estimatedCostOutput = 0,
  estimatedCostTotal = 0,
  currency = "USD",
  routeType = null,
  workloadCategory = null
}) {
  const systemInputTokensOriginal = estimateTokens(originalContent)
  const systemInputTokensOptimized = estimateTokens(optimizedContent)
  const responseText =
    typeof response === "string" ? response : JSON.stringify(response)
  const systemResponseTokens = estimateTokens(responseText)
  const llmTotalTokens = llmInputTokens + llmOutputTokens

  await tokenUsageService.createTokenUsage({
    apiKeyId,
    systemInputTokensOriginal,
    systemInputTokensOptimized,
    systemResponseTokens,
    llmInputTokens,
    llmOutputTokens,
    llmTotalTokens,
    estimatedCostInput,
    estimatedCostOutput,
    estimatedCostTotal,
    currency,
    scope,
    cacheType,
    provider,
    providerModel,
    keySource,
    routeType,
    workloadCategory
  })
}

function buildOpenAICompatibleResponse({
  response,
  model,
  cache,
  scope,
  durationMs,
  meta,
  llmInputTokens,
  llmOutputTokens,
  llmTotalTokens
}) {
  return {
    id: `chatcmpl-gateway-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: response
        },
        finish_reason: "stop"
      }
    ],
    usage: {
      prompt_tokens: llmInputTokens,
      completion_tokens: llmOutputTokens,
      total_tokens: llmTotalTokens
    },
    meta: {
      scope,
      cache,
      durationMs,
      ...meta
    }
  }
}

async function sendMessage({
  sessionId,
  apiKeyId,
  messages = [],
  model = "openai/gpt-4o-mini",
  temperature = 0.2,
  maxTokens = null,
  responseFormat = null,
  extractionProfile = "generic_document",
  routeType = "chat",
  workloadCategory = "light"
}) {
  const startedAt = Date.now()

  const normalizedMessages = normalizeMessages(messages)
  const lastUserMessage = getLastUserMessage(normalizedMessages)

  if (!lastUserMessage) {
    throw new Error("É necessário ao menos uma mensagem do usuário")
  }

  const { runtimePolicy, effectiveConfig } =
    await getRuntimePolicyForApiKey(apiKeyId)

  const stripped = conservativeContextStrip(lastUserMessage.content)

  if (stripped.stripped.length > runtimePolicy.limits.maxInputChars) {
    throw new Error("Conteúdo excede o limite operacional do plano")
  }

  if (responseFormat?.type === "json_schema") {
    const schemaFields = Object.keys(
      responseFormat?.json_schema?.schema?.properties || {}
    )

    if (schemaFields.length > runtimePolicy.limits.maxSchemaFields) {
      throw new Error("Schema excede o limite operacional do plano")
    }
  }

  const systemSignature = buildSystemSignature(normalizedMessages)
  const agentState = await ensureSessionSystemSignature({
    sessionId,
    systemSignature
  })

  if (agentState.changed) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { summary: null }
    })
  }

  const conversationSignature = buildConversationSignature({
    messages: normalizedMessages,
    responseFormat,
    extractionProfile,
    model
  })

  const debug = {
    llmCalled: false,
    cacheLayer: null,
    fingerprintHit: false,
    semanticHit: false,
    redisHit: false,
    postgresHit: false,
    optimizerApplied: false,
    originalContent: JSON.stringify(normalizedMessages),
    strippedContent: stripped.stripped,
    strippedChanged: stripped.changed,
    optimizedContent: null,
    similarity: null,
    historyUsed: false,
    historyCount: 0,
    summaryUsed: false,
    llmMessagesCount: 0,
    provider: null,
    providerModel: null,
    llmInputTokens: 0,
    llmOutputTokens: 0,
    llmTotalTokens: 0,
    estimatedCostInput: 0,
    estimatedCostOutput: 0,
    estimatedCostTotal: 0,
    currency: "USD",
    pricingFound: false,
    temperature,
    maxTokens,
    responseFormat,
    extractionProfile,
    keySource: "platform",
    extractionUsed: false,
    extractionResolvedLocally: 0,
    extractionResolvedByLLM: 0,
    extractionCandidateCount: 0,
    extractionRelevantBlockCount: 0,
    extractionMemoryHits: 0,
    documentMemoryHit: false,
    deltaUsed: false,
    deltaChangedBlockCount: 0,
    deltaUnchangedBlockCount: 0,
    missingRequiredFields: [],
    runtimePolicy,
    effectiveConfig,
    systemSignatureChanged: agentState.changed,
    systemMessagesCount: normalizedMessages.filter((m) => m.role === "system").length,
    assistantMessagesCount: normalizedMessages.filter((m) => m.role === "assistant").length,
    routeType,
    workloadCategory
  }

  let session = await sessionService.expireSessionIfNeeded({
    sessionId,
    apiKeyId
  })

  if (!session) {
    throw new Error("Sessão não encontrada")
  }

  if (session.status === "closed") {
    throw new Error("Sessão encerrada")
  }

  if (session.status === "expired") {
    throw new Error("Sessão expirada")
  }

  const scope = classifyScope(stripped.stripped)
  const optimizedContent = optimizePrompt(stripped.stripped, scope)

  debug.optimizerApplied = true
  debug.optimizedContent = optimizedContent

  const sessionFieldMemory = await getSessionFieldMemory(sessionId)

  let localExtraction = null

  if (responseFormat?.type === "json_schema") {
    const exactMemoryLookup = await findExactDocumentMemory({
      sessionId,
      text: stripped.stripped,
      extractionProfile,
      responseFormat
    })

    if (exactMemoryLookup.found) {
      debug.documentMemoryHit = true

      const memoryResponse = {
        data: exactMemoryLookup.found.extractedData || {},
        confidence: exactMemoryLookup.found.confidenceData || {},
        provenance: exactMemoryLookup.found.provenanceData || {},
        meta: {
          llmUsed: false,
          resolvedLocally: Object.keys(exactMemoryLookup.found.extractedData || {}).length,
          resolvedByLLM: exactMemoryLookup.found.llmUsed ? 1 : 0,
          documentMemoryHit: true
        }
      }

      await persistConversationTurnIfNeeded({
        sessionId,
        userContent: lastUserMessage.content,
        assistantContent: JSON.stringify(memoryResponse)
      })

      await prisma.session.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date() }
      })

      await runSafe("saveTokenUsage document memory", () =>
        saveTokenUsage({
          apiKeyId,
          originalContent: JSON.stringify(normalizedMessages),
          optimizedContent,
          response: memoryResponse,
          scope: "document_memory",
          cacheType: "local",
          provider: "internal",
          providerModel: "internal",
          keySource: "none",
          estimatedCostInput: 0,
          estimatedCostOutput: 0,
          estimatedCostTotal: 0,
          currency: "USD",
          routeType,
          workloadCategory
        })
      )

      const durationMs = Date.now() - startedAt

      return buildOpenAICompatibleResponse({
        response: memoryResponse,
        model,
        cache: "local",
        scope: "document_memory",
        durationMs,
        llmInputTokens: 0,
        llmOutputTokens: 0,
        llmTotalTokens: 0,
        meta: {
          ...debug
        }
      })
    }

    localExtraction = buildLocalExtractionResult({
      responseFormat,
      text: stripped.stripped,
      extractionProfile
    })

    if ((localExtraction.relevantBlocks || []).length > runtimePolicy.limits.maxRelevantBlocks) {
      localExtraction.relevantBlocks = localExtraction.relevantBlocks.slice(
        0,
        runtimePolicy.limits.maxRelevantBlocks
      )
    }

    if ((localExtraction.candidates || []).length > runtimePolicy.limits.maxCandidateHints) {
      localExtraction.candidates = localExtraction.candidates.slice(
        0,
        runtimePolicy.limits.maxCandidateHints
      )
    }

    const previousDocumentMemory = await findLatestDocumentMemoryByProfile({
      sessionId,
      extractionProfile
    })

    const deltaInfo = buildDeltaAgainstPrevious({
      previousMemory: previousDocumentMemory,
      currentBlocks: localExtraction.relevantBlocks || []
    })

    if (deltaInfo.hasPrevious) {
      debug.deltaUsed = true
      debug.deltaChangedBlockCount = deltaInfo.changedBlockCount
      debug.deltaUnchangedBlockCount = deltaInfo.unchangedBlockCount

      localExtraction = applyDeltaReuse(localExtraction, deltaInfo)
      localExtraction.deltaInfo = deltaInfo
    }

    localExtraction = applySessionMemoryToExtraction(
      localExtraction,
      sessionFieldMemory
    )

    debug.extractionUsed = true
    debug.extractionCandidateCount = localExtraction.candidateCount
    debug.extractionRelevantBlockCount = (localExtraction.relevantBlocks || []).length
    debug.missingRequiredFields = localExtraction.missingRequiredFields
    debug.extractionResolvedLocally = Object.values(localExtraction.data).filter(Boolean).length
    debug.extractionMemoryHits = Object.values(localExtraction.provenance).filter(
      (item) => item?.source === "session_memory"
    ).length

    if (localExtraction.fullyResolved) {
      const localResponse = {
        data: localExtraction.data,
        confidence: localExtraction.confidence,
        provenance: localExtraction.provenance,
        meta: {
          llmUsed: false,
          resolvedLocally: debug.extractionResolvedLocally,
          resolvedByLLM: 0,
          memoryHits: debug.extractionMemoryHits,
          deltaUsed: debug.deltaUsed
        }
      }

      await persistConversationTurnIfNeeded({
        sessionId,
        userContent: lastUserMessage.content,
        assistantContent: JSON.stringify(localResponse)
      })

      await prisma.session.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date() }
      })

      await runSafe("upsertSessionFieldMemory local", () =>
        upsertSessionFieldMemory({
          sessionId,
          fields: localExtraction.data,
          source: "local_extraction",
          defaultConfidence: 0.92,
          retentionDays: runtimePolicy.memory.retentionDays,
          maxItems: runtimePolicy.memory.maxItems
        })
      )

      await runSafe("saveDocumentMemory local", () =>
        saveDocumentMemory({
          sessionId,
          text: lastUserMessage.content,
          normalizedContent: stripped.stripped,
          extractionProfile,
          responseFormat,
          blocks: localExtraction.relevantBlocks || [],
          data: localExtraction.data,
          confidence: localExtraction.confidence,
          provenance: localExtraction.provenance,
          llmUsed: false,
          retentionDays: runtimePolicy.memory.retentionDays,
          maxItemsPerProfile: runtimePolicy.memory.maxItems
        })
      )

      await runSafe("saveTokenUsage local extraction", () =>
        saveTokenUsage({
          apiKeyId,
          originalContent: JSON.stringify(normalizedMessages),
          optimizedContent,
          response: localResponse,
          scope: "structured_local",
          cacheType: "local",
          provider: "internal",
          providerModel: "internal",
          keySource: "none",
          estimatedCostInput: 0,
          estimatedCostOutput: 0,
          estimatedCostTotal: 0,
          currency: "USD",
          routeType,
          workloadCategory
        })
      )

      const durationMs = Date.now() - startedAt

      return buildOpenAICompatibleResponse({
        response: localResponse,
        model,
        cache: "local",
        scope: "structured_local",
        durationMs,
        llmInputTokens: 0,
        llmOutputTokens: 0,
        llmTotalTokens: 0,
        meta: {
          ...debug
        }
      })
    }
  }

  const dynamicIntent = detectDynamicIntent(stripped.stripped)

  if (dynamicIntent && !responseFormat && normalizedMessages.length <= 2) {
    const dynamicResponse = buildDynamicResponse(dynamicIntent)

    await persistConversationTurnIfNeeded({
      sessionId,
      userContent: lastUserMessage.content,
      assistantContent: dynamicResponse
    })

    await prisma.session.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() }
    })

    await runSafe("saveTokenUsage dynamic", () =>
      saveTokenUsage({
        apiKeyId,
        originalContent: JSON.stringify(normalizedMessages),
        optimizedContent,
        response: dynamicResponse,
        scope: "dynamic",
        cacheType: "local",
        provider: "internal",
        providerModel: "internal",
        keySource: "none",
        estimatedCostInput: 0,
        estimatedCostOutput: 0,
        estimatedCostTotal: 0,
        currency: "USD",
        routeType,
        workloadCategory
      })
    )

    const durationMs = Date.now() - startedAt

    return buildOpenAICompatibleResponse({
      response: dynamicResponse,
      model,
      cache: "local",
      scope: "dynamic",
      durationMs,
      llmInputTokens: 0,
      llmOutputTokens: 0,
      llmTotalTokens: 0,
      meta: {
        ...debug,
        llmCalled: false,
        cacheLayer: "local",
        dynamicIntent
      }
    })
  }

  const fingerprintCacheKey = conversationSignature
  const semanticCacheKey = optimizedContent

  if (scope === "global") {
    const cached = await fingerprintService.findCachedAnswer(
      apiKeyId,
      fingerprintCacheKey,
      responseFormat
    )

    if (cached) {
      debug.cacheLayer = "fingerprint"
      debug.fingerprintHit = true
      debug.llmCalled = false
      debug.redisHit = cached.source === "redis"
      debug.postgresHit = cached.source === "postgres"

      const cachedResponseContent =
        typeof cached.data.answer === "string"
          ? cached.data.answer
          : JSON.stringify(cached.data.answer)

      await persistConversationTurnIfNeeded({
        sessionId,
        userContent: lastUserMessage.content,
        assistantContent: cachedResponseContent
      })

      await prisma.session.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date() }
      })

      await runSafe("saveTokenUsage fingerprint", () =>
        saveTokenUsage({
          apiKeyId,
          originalContent: JSON.stringify(normalizedMessages),
          optimizedContent,
          response: cached.data.answer,
          scope,
          cacheType: "fingerprint",
          llmInputTokens: 0,
          llmOutputTokens: 0,
          provider: "internal",
          providerModel: "internal",
          keySource: "none",
          estimatedCostInput: 0,
          estimatedCostOutput: 0,
          estimatedCostTotal: 0,
          currency: "USD",
          routeType,
          workloadCategory
        })
      )

      const durationMs = Date.now() - startedAt

      return buildOpenAICompatibleResponse({
        response: cached.data.answer,
        model,
        cache: "fingerprint",
        scope,
        durationMs,
        llmInputTokens: 0,
        llmOutputTokens: 0,
        llmTotalTokens: 0,
        meta: {
          ...debug
        }
      })
    }

    const semanticMatch = await semanticCacheService.findSemanticMatch(
      apiKeyId,
      semanticCacheKey,
      responseFormat
    )

    if (semanticMatch) {
      debug.cacheLayer = "semantic"
      debug.semanticHit = true
      debug.llmCalled = false
      debug.postgresHit = semanticMatch.source === "postgres"
      debug.similarity = semanticMatch.score

      const semanticResponseContent =
        typeof semanticMatch.match.answer === "string"
          ? semanticMatch.match.answer
          : JSON.stringify(semanticMatch.match.answer)

      await persistConversationTurnIfNeeded({
        sessionId,
        userContent: lastUserMessage.content,
        assistantContent: semanticResponseContent
      })

      await prisma.session.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date() }
      })

      await runSafe("save fingerprint from semantic", () =>
        fingerprintService.saveCachedAnswer(
          apiKeyId,
          fingerprintCacheKey,
          semanticMatch.match.answer,
          responseFormat,
          {
            ttlSeconds: runtimePolicy.cache.ttlSeconds
          }
        )
      )

      await runSafe("saveTokenUsage semantic", () =>
        saveTokenUsage({
          apiKeyId,
          originalContent: JSON.stringify(normalizedMessages),
          optimizedContent,
          response: semanticMatch.match.answer,
          scope,
          cacheType: "semantic",
          llmInputTokens: 0,
          llmOutputTokens: 0,
          provider: "internal",
          providerModel: "internal",
          keySource: "none",
          estimatedCostInput: 0,
          estimatedCostOutput: 0,
          estimatedCostTotal: 0,
          currency: "USD",
          routeType,
          workloadCategory
        })
      )

      const durationMs = Date.now() - startedAt

      return buildOpenAICompatibleResponse({
        response: semanticMatch.match.answer,
        model,
        cache: "semantic",
        scope,
        durationMs,
        llmInputTokens: 0,
        llmOutputTokens: 0,
        llmTotalTokens: 0,
        meta: {
          ...debug
        }
      })
    }
  }

  let sessionSummary = null

  if (normalizedMessages.length <= 2 && !agentState.changed) {
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId }
    })

    sessionSummary = sessionData.summary
    debug.summaryUsed = !!sessionSummary
  }

  const llmMessages = buildPromptMessages({
    scope,
    optimizedContent,
    sessionSummary,
    messages: normalizedMessages
  })

  if (localExtraction) {
    llmMessages.unshift({
      role: "system",
      content: buildExtractionHint(localExtraction, extractionProfile)
    })
  }

  debug.llmMessagesCount = llmMessages.length
  debug.llmCalled = true

  const provider = llmRouterService.getProviderFromModel(model)
  const customerProviderKey = await providerKeyService.getDefaultProviderKey(
    apiKeyId,
    provider
  )

  const resolvedKeySource = customerProviderKey ? "customer" : "platform"

  if (customerProviderKey) {
    debug.keySource = "customer"
  } else {
    debug.keySource = "platform"
  }

  const apiKeyOverrides = {
    openai: process.env.OPENAI_API_KEY || null,
    anthropic: process.env.ANTHROPIC_API_KEY || null,
    gemini: process.env.GEMINI_API_KEY || null
  }

  const llmResult = await llmRouterService.generateResponse({
    model,
    messages: llmMessages,
    temperature,
    maxTokens,
    responseFormat,
    apiKeyOverride: customerProviderKey
      ? customerProviderKey.apiKey
      : apiKeyOverrides[provider]
  })

  let response = llmResult.content

  if (
    localExtraction &&
    response &&
    typeof response === "object" &&
    !Array.isArray(response)
  ) {
    const responseKeys = Object.keys(response)
    const confidence = {}
    const provenance = {}

    for (const key of responseKeys) {
      if (localExtraction.confidence[key] !== undefined && localExtraction.data[key]) {
        confidence[key] = localExtraction.confidence[key]
        provenance[key] = localExtraction.provenance[key]
      } else if (sessionFieldMemory[key]?.value && !localExtraction.data[key]) {
        confidence[key] = Number((sessionFieldMemory[key].confidence || 0.85).toFixed(2))
        provenance[key] = {
          source: "session_memory",
          label: null,
          line: null
        }
      } else {
        confidence[key] = 0.75
        provenance[key] = {
          source: "llm_resolution",
          label: null,
          line: null
        }
      }
    }

    debug.extractionResolvedByLLM = responseKeys.filter(
      (key) => !localExtraction.data[key]
    ).length

    response = {
      data: response,
      confidence,
      provenance,
      meta: {
        llmUsed: true,
        resolvedLocally: debug.extractionResolvedLocally,
        resolvedByLLM: debug.extractionResolvedByLLM,
        memoryHits: debug.extractionMemoryHits,
        documentMemoryHit: debug.documentMemoryHit,
        deltaUsed: debug.deltaUsed
      }
    }
  }

  debug.provider = llmResult.provider
  debug.providerModel = llmResult.providerModel
  debug.llmInputTokens = llmResult.usage.inputTokens
  debug.llmOutputTokens = llmResult.usage.outputTokens
  debug.llmTotalTokens = llmResult.usage.totalTokens

  const estimatedCost = await estimateLlmCost({
    provider: llmResult.provider,
    providerModel: llmResult.providerModel,
    inputTokens: llmResult.usage.inputTokens,
    outputTokens: llmResult.usage.outputTokens
  })

  debug.estimatedCostInput = estimatedCost.estimatedCostInput
  debug.estimatedCostOutput = estimatedCost.estimatedCostOutput
  debug.estimatedCostTotal = estimatedCost.estimatedCostTotal
  debug.currency = estimatedCost.currency
  debug.pricingFound = estimatedCost.pricingFound

  await persistConversationTurnIfNeeded({
    sessionId,
    userContent: lastUserMessage.content,
    assistantContent:
      typeof response === "string" ? response : JSON.stringify(response)
  })

  if (response && typeof response === "object" && response.data) {
    await runSafe("upsertSessionFieldMemory llm structured", () =>
      upsertSessionFieldMemory({
        sessionId,
        fields: response.data,
        source: "llm_structured_extraction",
        defaultConfidence: 0.82,
        retentionDays: runtimePolicy.memory.retentionDays,
        maxItems: runtimePolicy.memory.maxItems
      })
    )

    await runSafe("saveDocumentMemory llm structured", () =>
      saveDocumentMemory({
        sessionId,
        text: lastUserMessage.content,
        normalizedContent: stripped.stripped,
        extractionProfile,
        responseFormat,
        blocks: localExtraction?.relevantBlocks || [],
        data: response.data,
        confidence: response.confidence || {},
        provenance: response.provenance || {},
        llmUsed: true,
        retentionDays: runtimePolicy.memory.retentionDays,
        maxItemsPerProfile: runtimePolicy.memory.maxItems
      })
    )
  } else if (localExtraction?.data) {
    await runSafe("upsertSessionFieldMemory partial local", () =>
      upsertSessionFieldMemory({
        sessionId,
        fields: localExtraction.data,
        source: "partial_local_extraction",
        defaultConfidence: 0.88,
        retentionDays: runtimePolicy.memory.retentionDays,
        maxItems: runtimePolicy.memory.maxItems
      })
    )
  }

  if (scope === "global") {
    await runSafe("saveCachedAnswer llm", () =>
      fingerprintService.saveCachedAnswer(
        apiKeyId,
        fingerprintCacheKey,
        response,
        responseFormat,
        {
          ttlSeconds: runtimePolicy.cache.ttlSeconds
        }
      )
    )

    await runSafe("saveSemanticCache llm", () =>
      semanticCacheService.saveSemanticCache(
        apiKeyId,
        semanticCacheKey,
        response,
        responseFormat,
        {
          ttlSeconds: runtimePolicy.cache.ttlSeconds
        }
      )
    )
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { lastActivityAt: new Date() }
  })

  await runSafe("updateConversationSummary", () =>
    memoryService.updateConversationSummary(sessionId)
  )

  await runSafe("saveTokenUsage llm", () =>
    saveTokenUsage({
      apiKeyId,
      originalContent: JSON.stringify(normalizedMessages),
      optimizedContent,
      response,
      scope,
      cacheType: "llm",
      llmInputTokens: llmResult.usage.inputTokens,
      llmOutputTokens: llmResult.usage.outputTokens,
      provider: llmResult.provider,
      providerModel: llmResult.providerModel,
      keySource: resolvedKeySource,
      estimatedCostInput: estimatedCost.estimatedCostInput,
      estimatedCostOutput: estimatedCost.estimatedCostOutput,
      estimatedCostTotal: estimatedCost.estimatedCostTotal,
      currency: estimatedCost.currency,
      routeType,
      workloadCategory
    })
  )

  const durationMs = Date.now() - startedAt

  return buildOpenAICompatibleResponse({
    response,
    model,
    cache: null,
    scope,
    durationMs,
    llmInputTokens: llmResult.usage.inputTokens,
    llmOutputTokens: llmResult.usage.outputTokens,
    llmTotalTokens: llmResult.usage.totalTokens,
    meta: {
      ...debug
    }
  })
}

module.exports = {
  sendMessage
}