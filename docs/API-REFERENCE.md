# API Reference - LLM Gateway

Base local: `http://localhost:3333`.

Colecao Postman: `postman/llm-gateway-api.postman_collection.json`.

Rotas e contratos para front: `docs/FRONTEND-ROUTES.md` e `docs/frontend-api-routes.ts`.

## Auth

Rotas publicas:

| Metodo | Rota |
|---|---|
| `GET` | `/health` |
| `POST` | `/auth/register` |
| `POST` | `/auth/login` |
| `GET` | `/public/plans` |
| `POST` | `/public/plans/simulate` |
| `POST` | `/public/plans/recommend` |

Todas as outras rotas, exceto `/admin/*`, exigem:

```text
Authorization: Bearer <accessToken>
```

Admin exige:

```text
x-admin-secret: <ADMIN_MAINTENANCE_SECRET>
```

## Endpoints

### Conta

| Metodo | Rota | Body/query |
|---|---|---|
| `POST` | `/auth/register` | `name`, `email`, `password`, `planCode` |
| `POST` | `/auth/login` | `email`, `password` |
| `POST` | `/auth/logout` | vazio |
| `GET` | `/apikeys` | query opcional `highlightApiKeyId` |
| `POST` | `/apikeys` | vazio |
| `POST` | `/users` | `email`, `name` |

### Publico

| Metodo | Rota | Body |
|---|---|---|
| `GET` | `/public/plans` | - |
| `POST` | `/public/plans/simulate` | `planCode`, `addonCodes`, `overrides` |
| `POST` | `/public/plans/recommend` | `estimatedRequestsPerMonth`, `wantsManaged`, `wantsAdvancedRetention`, `wantsLargerSemanticBase` |

### Sessoes e mensagens

| Metodo | Rota | Body/query |
|---|---|---|
| `POST` | `/sessions` | body opcional `apiKeyId`, `externalConversationId`, `channel`, `label` |
| `GET` | `/sessions` | query `page`, `pageSize`, `status`, `apiKeyId` |
| `GET` | `/sessions/:id` | - |
| `POST` | `/sessions/:id/close` | - |
| `POST` | `/messages` | `sessionId`, `role`, `content` |
| `GET` | `/sessions/:id/messages` | - |

### LLM

| Metodo | Rota | Body obrigatorio |
|---|---|---|
| `POST` | `/chat` | `sessionId`, `messages[]` |
| `POST` | `/extract` | `sessionId`, `messages[]`, `response_format` |

`messages[].role`: `system`, `user`, `assistant`.

`model` default: `openai/gpt-4o-mini`.

`response_format` em `/extract`:

```json
{ "type": "json_object" }
```

ou:

```json
{
  "type": "json_schema",
  "json_schema": {
    "name": "schema_name",
    "schema": {
      "type": "object",
      "properties": {}
    }
  }
}
```

### Provider keys

| Metodo | Rota | Body/query |
|---|---|---|
| `GET` | `/provider-keys` | query opcional `apiKeyId` |
| `POST` | `/provider-keys` | query opcional `apiKeyId`; body `provider`, `apiKey`, `label`, `isDefault` |
| `PATCH` | `/provider-keys/:id/default` | query opcional `apiKeyId` |
| `DELETE` | `/provider-keys/:id` | query opcional `apiKeyId` |

Providers aceitos: `openai`, `anthropic`, `gemini`.

### Billing

| Metodo | Rota | Body/query |
|---|---|---|
| `POST` | `/billing/seed` | vazio |
| `GET` | `/plans` | - |
| `GET` | `/subscriptions/current` | query opcional `apiKeyId` |
| `POST` | `/subscriptions` | query opcional `apiKeyId`; body `planCode`, `addonCodes` |
| `POST` | `/subscriptions/override` | query opcional `apiKeyId`; body `featureKey`, `presetKey` |

Planos atuais: `free`, `starter`, `growth`, `pro`, `scale`.

### Analytics

| Metodo | Rota | Query |
|---|---|---|
| `GET` | `/usage/:apiKeyId` | `day`, `startDate`, `endDate`, `includeDaily` |
| `GET` | `/me/dashboard` | `day`, `startDate`, `endDate`, `includeDaily` |

### Model pricing

| Metodo | Rota | Body |
|---|---|---|
| `GET` | `/model-pricing` | - |
| `POST` | `/model-pricing` | `provider`, `model`, `inputPer1k`, `outputPer1k`, `currency`, `isActive` |

### Admin

| Metodo | Rota | Header |
|---|---|---|
| `POST` | `/admin/maintenance/run` | `x-admin-secret` |

## Regras de negocio resumidas

- JWT identifica o usuario de conta.
- `sessionId` resolve a API key gateway efetiva para `/chat` e `/extract`.
- Provider key do cliente e obrigatoria para chamar LLM.
- `effectiveConfig` e resolvido em ordem: plano, addons, overrides.
- Plano define limites de entrada, campos de schema, rate limit, concorrencia e limite de API keys.
- Plano `free` nao persiste historico de conversa no fluxo LLM e desativa cache inteligente.
- Analytics agrega registros de uso por API key, provider, modelo, rota, workload, escopo e tipo de cache.
