# Referência da API — LLM Gateway

**Base URL (local):** `http://localhost:3333` (ou a URL do seu deploy).

## Autenticação

| Contexto | Obrigatório |
|----------|----------------|
| **Maioria das rotas** | Header `Authorization: Bearer <accessToken>` — token retornado em `auth.accessToken` no login ou cadastro. |
| **Público** | Nenhum — apenas rotas listadas em “Sem autenticação”. |
| **Admin manutenção** | Header `x-admin-secret` — valor igual a `ADMIN_MAINTENANCE_SECRET` no servidor. |

Não há mais uso de `x-api-key` no gateway: o contexto da chave gateway (cobrança, limites) vem da **sessão** (`sessionId` no body) ou de **`apiKeyId`** no body/query quando aplicável.

---

## Sem autenticação

| Método | Rota | Body (JSON) | Observação |
|--------|------|-------------|------------|
| GET | `/health` | — | Status do serviço. |
| POST | `/auth/register` | `name`, `email`, `password`, `planCode` | Cria usuário, primeira API key e assinatura. |
| POST | `/auth/login` | `email`, `password` | Retorna `auth.accessToken`, `user`, `apiKey`, `apiKeys`, `subscription`. |
| GET | `/public/plans` | — | Catálogo público de planos/addons. |
| POST | `/public/plans/simulate` | `planCode` (obr.), `addonCodes` (opc.), `overrides` (opc.) | Simulação de plano. |
| POST | `/public/plans/recommend` | `estimatedRequestsPerMonth`, `wantsManaged`, `wantsAdvancedRetention`, `wantsLargerSemanticBase` (todos opcionais) | Recomenda plano. |

---

## Com JWT (`Authorization: Bearer`)

### Auth (JWT obrigatório)

| Método | Rota | Body | Observação |
|--------|------|------|------------|
| POST | `/auth/logout` | — | Estado no servidor é stateless; envie Bearer se quiser consistência com o restante da API. |

### API keys

| Método | Rota | Query | Body |
|--------|------|-------|------|
| GET | `/apikeys` | `highlightApiKeyId` (opc.) — marca `isCurrent` na lista | — |
| POST | `/apikeys` | — | — (cria chave para o usuário do token) |

### Analytics

| Método | Rota | Params / query |
|--------|------|----------------|
| GET | `/usage/:apiKeyId` | Query: `day`, `startDate`, `endDate`, `includeDaily` (opcionais). `:apiKeyId` deve ser uma API key **sua** (mesmo `userId`). |

### Sessões

| Método | Rota | Query | Body |
|--------|------|-------|------|
| POST | `/sessions` | — | `apiKeyId` (opc.) — UUID da chave gateway; se omitir, usa a chave mais antiga. `externalConversationId`, `channel`, `label` (opc.) |
| GET | `/sessions` | `page`, `pageSize`, `status`, `apiKeyId` (opc.) | — |
| GET | `/sessions/:id` | — | — |
| POST | `/sessions/:id/close` | — | — |

### Mensagens

| Método | Rota | Body |
|--------|------|------|
| POST | `/messages` | `sessionId` (obr.), `role`, `content` |
| GET | `/sessions/:id/messages` | — |

### Chat e extração (LLM)

Sessão deve pertencer ao usuário do JWT. O servidor resolve a chave gateway pela sessão.

**Chat**

| Método | Rota | Body (JSON) |
|--------|------|-------------|
| POST | `/chat` | `sessionId` (obr.), `messages` (array: `role` = `system` \| `user` \| `assistant`, `content` string), pelo menos um `user` com `content` não vazio. Opcionais: `model` (default `openai/gpt-4o-mini`), `temperature` (default `0.2`), `max_tokens` (default `300`) |

**Extract**

| Método | Rota | Body (JSON) |
|--------|------|-------------|
| POST | `/extract` | Igual ao chat **mais** `response_format` (obr.): `{ "type": "json_object" }` ou `{ "type": "json_schema", "json_schema": { "name", "schema" } }`. Opcionais: `extraction_profile` (default `generic_document`), `model`, `temperature`, `max_tokens`, `messages` |

### Provider keys (OpenAI / Anthropic / Gemini no gateway)

Todas aceitam query opcional `apiKeyId` (UUID da chave gateway). Se omitir, usa a chave gateway mais antiga do usuário.

| Método | Rota | Query | Body |
|--------|------|-------|------|
| GET | `/provider-keys` | `apiKeyId` (opc.) | — |
| POST | `/provider-keys` | `apiKeyId` (opc.) | `provider` (`openai` \| `anthropic` \| `gemini`), `apiKey` (string do provedor), `label`, `isDefault` |
| PATCH | `/provider-keys/:id/default` | `apiKeyId` (opc.) | — |
| DELETE | `/provider-keys/:id` | `apiKeyId` (opc.) | — |

### Model pricing

| Método | Rota | Body |
|--------|------|------|
| GET | `/model-pricing` | — |
| POST | `/model-pricing` | `provider`, `model`, `inputPer1k`, `outputPer1k` (números), `currency` (opc., default USD), `isActive` (opc.) |

### Billing / planos

| Método | Rota | Query | Body |
|--------|------|-------|------|
| POST | `/billing/seed` | — | — (popula catálogo; uso administrativo) |
| GET | `/plans` | — | — |
| GET | `/subscriptions/current` | `apiKeyId` (opc.) | — |
| POST | `/subscriptions` | `apiKeyId` (opc.) | `planCode` (obr.), `addonCodes` (array opc.) |
| POST | `/subscriptions/override` | `apiKeyId` (opc.) | `featureKey`, `presetKey` (obr.) |

### Usuários (legado)

| Método | Rota | Body |
|--------|------|------|
| POST | `/users` | `email`, `name` |

---

## Admin (sem JWT)

| Método | Rota | Headers |
|--------|------|---------|
| POST | `/admin/maintenance/run` | `x-admin-secret: <ADMIN_MAINTENANCE_SECRET>` |

---

## Modelos no gateway

Prefixos em `model`: `openai/`, `anthropic/`, `gemini/` (ver serviço de roteamento).

---

## Importar no Postman / Insomnia

Use o arquivo `postman/llm-gateway-api.postman_collection.json` na raiz do repositório (pasta `postman/`). Ajuste a variável de coleção `baseUrl` e, após o login, `accessToken`.
