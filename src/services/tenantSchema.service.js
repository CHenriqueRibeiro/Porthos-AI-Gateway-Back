const { Prisma } = require("@prisma/client")
const prisma = require("../db/prisma")

function normalizeTenantSlug(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  return normalized || "tenant"
}

function buildTenantSchemaName(slugOrId) {
  const slug = normalizeTenantSlug(slugOrId)
  return `tenant_${slug}`.slice(0, 63)
}

function assertSafeSchemaName(schemaName) {
  if (!/^tenant_[a-z0-9_]{1,56}$/.test(schemaName || "")) {
    throw new Error("Nome de schema de tenant inv\u00e1lido")
  }
}

function schemaSql(schemaName) {
  assertSafeSchemaName(schemaName)
  return Prisma.raw(`"${schemaName}"`)
}

function vectorToSqlLiteral(vector = []) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("Embedding inv\u00e1lido para cache vetorial")
  }

  return `[${vector.map((value) => Number(value) || 0).join(",")}]`
}

function isMissingVectorExtensionError(error) {
  const message = error?.meta?.message || error?.message || ""
  return (
    error?.code === "P2010" &&
    (message.includes('extens\u00e3o "vector" n\u00e3o est\u00e1 dispon\u00edvel') ||
      message.includes('extension "vector" is not available'))
  )
}

async function ensureTenantSchema(schemaName, db = prisma, options = {}) {
  assertSafeSchemaName(schemaName)

  const schema = schemaSql(schemaName)
  const requireVector = options.requireVector === true

  await db.$executeRaw`CREATE SCHEMA IF NOT EXISTS ${schema}`
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS ${schema}.tenant_meta (
      id TEXT PRIMARY KEY DEFAULT 'default',
      schema_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await db.$executeRaw`
    INSERT INTO ${schema}.tenant_meta (id, schema_name, created_at, updated_at)
    VALUES ('default', ${schemaName}, NOW(), NOW())
    ON CONFLICT (id)
    DO UPDATE SET schema_name = EXCLUDED.schema_name, updated_at = NOW()
  `

  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS ${schema}.provider_keys (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      label TEXT,
      encrypted_key TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT TRUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      validation_status TEXT DEFAULT 'pending',
      validation_message TEXT,
      last_validated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS provider_keys_api_key_provider_idx
    ON ${schema}.provider_keys (api_key_id, provider)
  `

  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS ${schema}.sessions (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      external_conversation_id TEXT,
      channel TEXT,
      label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      expired_at TIMESTAMPTZ,
      summary TEXT,
      UNIQUE (api_key_id, external_conversation_id)
    )
  `

  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS sessions_api_key_activity_idx
    ON ${schema}.sessions (api_key_id, last_activity_at)
  `

  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS ${schema}.messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES ${schema}.sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS messages_session_created_idx
    ON ${schema}.messages (session_id, created_at)
  `

  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS ${schema}.session_field_memories (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES ${schema}.sessions(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      field_value TEXT NOT NULL,
      source TEXT,
      confidence DOUBLE PRECISION NOT NULL DEFAULT 0.8,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, field_name)
    )
  `

  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS ${schema}.document_memories (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES ${schema}.sessions(id) ON DELETE CASCADE,
      extraction_profile TEXT NOT NULL,
      schema_signature TEXT NOT NULL,
      document_fingerprint TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      raw_content TEXT NOT NULL,
      normalized_content TEXT NOT NULL,
      blocks JSONB NOT NULL,
      extracted_data JSONB NOT NULL,
      confidence_data JSONB NOT NULL,
      provenance_data JSONB NOT NULL,
      llm_used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, extraction_profile, schema_signature, document_fingerprint)
    )
  `

  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS ${schema}.processed_files (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      session_id TEXT REFERENCES ${schema}.sessions(id) ON DELETE SET NULL,
      file_hash TEXT NOT NULL,
      content_hash TEXT,
      filename TEXT,
      mime_type TEXT NOT NULL,
      file_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      extracted_text TEXT,
      block_hashes JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'processed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (api_key_id, file_hash)
    )
  `

  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS processed_files_api_key_content_idx
    ON ${schema}.processed_files (api_key_id, content_hash)
  `

  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS ${schema}.token_usage (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      system_input_tokens_original INTEGER NOT NULL DEFAULT 0,
      system_input_tokens_optimized INTEGER NOT NULL DEFAULT 0,
      system_response_tokens INTEGER NOT NULL DEFAULT 0,
      llm_input_tokens INTEGER NOT NULL DEFAULT 0,
      llm_output_tokens INTEGER NOT NULL DEFAULT 0,
      llm_total_tokens INTEGER NOT NULL DEFAULT 0,
      cache_reference_input_tokens INTEGER NOT NULL DEFAULT 0,
      cache_reference_output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_reference_total_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost_input DOUBLE PRECISION NOT NULL DEFAULT 0,
      estimated_cost_output DOUBLE PRECISION NOT NULL DEFAULT 0,
      estimated_cost_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      estimated_cost_avoided DOUBLE PRECISION NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      scope TEXT,
      cache_type TEXT,
      provider TEXT,
      provider_model TEXT,
      key_source TEXT,
      route_type TEXT,
      workload_category TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS token_usage_api_key_created_idx
    ON ${schema}.token_usage (api_key_id, created_at)
  `

  try {
    await db.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`
  } catch (error) {
    if (requireVector || !isMissingVectorExtensionError(error)) {
      throw error
    }

    console.warn(
      `[TENANT] schema ${schemaName} criado sem pgvector; cache semantico vetorial ficara indisponivel ate instalar a extensao vector.`
    )

    return {
      schemaName,
      vectorAvailable: false
    }
  }

  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS ${schema}.cache (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      question TEXT NOT NULL,
      answer JSONB NOT NULL,
      prompt_vector vector(1536) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (api_key_id, fingerprint)
    )
  `

  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS cache_api_key_expires_idx
    ON ${schema}.cache (api_key_id, expires_at)
  `

  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS cache_prompt_vector_hnsw_idx
    ON ${schema}.cache
    USING hnsw (prompt_vector vector_cosine_ops)
  `

  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS ${schema}.document_chunks (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      processed_file_id TEXT NOT NULL REFERENCES ${schema}.processed_files(id) ON DELETE CASCADE,
      content_hash TEXT NOT NULL,
      block_hash TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      token_count INTEGER NOT NULL DEFAULT 0,
      embedding vector(1536) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (api_key_id, processed_file_id, block_hash)
    )
  `

  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS document_chunks_api_key_content_idx
    ON ${schema}.document_chunks (api_key_id, content_hash)
  `

  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
    ON ${schema}.document_chunks
    USING hnsw (embedding vector_cosine_ops)
  `

  return {
    schemaName,
    vectorAvailable: true
  }
}

async function getTenantByApiKeyId(apiKeyId) {
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
    include: { tenant: true }
  })

  return apiKey?.tenant || null
}

module.exports = {
  normalizeTenantSlug,
  buildTenantSchemaName,
  assertSafeSchemaName,
  schemaSql,
  vectorToSqlLiteral,
  isMissingVectorExtensionError,
  ensureTenantSchema,
  getTenantByApiKeyId
}
