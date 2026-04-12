# Modelo de negócio e produto — Porthos / LLM Gateway API

Documento de referência interna (visão consolidada do sistema descrita no código e nas decisões de produto).

## Visão do produto

API **multi-tenant** que funciona como **gateway** para provedores de LLM (OpenAI, Anthropic, Gemini). Cada cliente possui **usuário**, uma ou mais **API keys gateway** (`sk_live_…`), **assinatura** (plano + addons), **chaves de provedor** opcionais e **sessões** de uso.

- **Receita:** planos mensais (BRL) + addons que elevam presets de features.
- **Custo variável:** uso de tokens dos provedores; o gateway estima e registra uso (`TokenUsage`).

---

## Identidade e autenticação

| Camada | Mecanismo | Uso |
|--------|-----------|-----|
| Conta (painel, billing, api keys, provider keys, analytics em modo leitura agregada) | **JWT** (`Authorization: Bearer`) após login/cadastro | Quem é o usuário (`sub` = `User.id`). |
| Uso do modelo (chat, extract, sessões, mensagens) | **JWT** + contexto da **sessão** | A chave gateway efetiva é resolvida pela sessão (`sessionId` no body) pertencente ao usuário do token. |
| Público | Sem auth | Health, cadastro, login, rotas `/public/*`. |
| Manutenção administrativa | Header **`x-admin-secret`** | Rotas `/admin/*`. |

Não há mais uso de **`x-api-key`** no gateway para rotas de conta; o fluxo atual centraliza identidade no JWT para gestão e na sessão para faturamento por evento LLM.

---

## Billing e planos

- **Planos** (`SubscriptionPlan`): códigos como `flex_start`, `flex_pro`, `prime_start`, `prime_pro` — preço em centavos BRL, tipo flex/prime.
- **Presets por plano:** cada plano define um mapa `featureKey → presetKey` (cache, histórico, memória, base semântica, analytics). Valores numéricos reais vêm do catálogo `FEATURE_PRESETS` em `src/config/billingCatalog.js`.
- **Addons** (`AddonCatalog`): vendem upgrade por **código** (ex.: `cache_expandido`); cada addon associa uma feature a um preset mais alto e preço adicional.
- **Assinatura** (`CustomerSubscription`): uma por **API key gateway** ativa; pode ter **addons** e **overrides** (`CustomerConfigOverride`).

### Rotas de configuração comercial

- `GET /plans` — catálogo de planos e addons.
- `POST /subscriptions` — define `planCode` + `addonCodes[]` para uma `apiKeyId` (query opcional).
- `GET /subscriptions/current` — assinatura ativa + `effectiveConfig` resolvido.
- `POST /subscriptions/override` — por assinatura: `featureKey` + `presetKey` (deve existir em `FEATURE_PRESETS`).

O cliente **não** envia números livres (ex. TTL custom); escolhe **presets** e **planos/addons** aprovados no catálogo.

---

## Features negociáveis (presets)

Definidas em `FEATURE_PRESETS`: entre outras,

- **cache_inteligente** — `ttlHours` por preset (padrão / expandido / avançado).
- **historico_operacional** — retenção em dias.
- **memoria_conteudo** — retenção + `maxItems`.
- **base_inteligente** — `maxRecords` (tamanho da base semântica).
- **analytics** — retenção de dados de analytics.

**Resolução efetiva:** plano → addons → overrides (override vence na mesma `featureKey`).

---

## Limites só por plano (não configuráveis pelo cliente via API)

Definidos em `billingConfig.service.js` por **`plan.code`**:

- Limites operacionais: `maxInputChars`, `maxSchemaFields`, `maxRelevantBlocks`, `maxCandidateHints`.
- **Rate limit** (requisições/minuto e janela).
- **Concorrência** (slots light/medium/heavy, timeouts).

Ou seja: **SKU do plano** manda nesses tetos; não são alterados por override de feature.

---

## Uso técnico do gateway

- **Chat / extract:** corpo com `sessionId`, mensagens, modelo no formato `openai/…`, `anthropic/…`, `gemini/…`.
- **Provider keys:** o cliente pode cadastrar chaves dos provedores; fallback para env global se existir.
- **Memória de sessão, cache semântico, fingerprint, document memory** — conforme serviços já implementados e política de runtime (`getRuntimePolicyForApiKey`).

---

## Métricas e uso (`TokenUsage`)

- Cada **evento** relevante (LLM, hit de cache, etc.) pode gerar **uma linha** em `TokenUsage` — granularidade para custo, tipo de cache, provedor, rota.
- **Analytics** (`GET /usage/:apiKeyId`): agrega no período (soma tokens, custos estimados, contagem por tipo).
- **Retenção:** manutenção (`pruneAnalyticsByApiKey`) remove registros antigos conforme `analytics.retentionDays` do plano.

---

## Operações e deploy

- **Seed de catálogo:** `npm run seed:billing` (planos + addons no banco); necessário para cadastro com `planCode` válido.
- **Docker:** `Dockerfile` + `docker-compose`; `.env.production` na VPS **não** vai ao Git; modelo em `.env.example`.
- **Banco:** Prisma + PostgreSQL; `db push` no `CMD` do container aplica schema ao subir (homologação; produção crítica pode preferir migrations).

---

## Resumo de posicionamento

| Pergunta | Resposta curta |
|----------|----------------|
| O que vendemos? | Assinatura de gateway LLM com limites e features por plano + addons. |
| O que o cliente configura? | Plano, addons e overrides por **preset** (catálogo fechado). |
| O que é fixo? | Tetos de rate limit, concorrência e limites operacionais por código de plano. |
| Como cobramos uso? | Registro por evento (`TokenUsage`) + estimativa de custo; analytics agrega. |

---

*Última consolidação: documento interno; alinhar com o código em caso de divergência.*
