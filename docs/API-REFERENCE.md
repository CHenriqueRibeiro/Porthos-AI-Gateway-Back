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

`model` default: `auto`.

`model` pode ser `auto`, `economy`, `balanced`, `quality` ou um modelo manual como `openai/gpt-4o-mini`.

`attachments` opcional em `/chat` e `/extract`:

```json
[
  {
    "filename": "contrato.txt",
    "mimeType": "text/plain",
    "text": "Conteudo extraido do arquivo..."
  }
]
```

Tambem e aceito `extractedText` no lugar de `text`. Arquivos PDF, imagem e audio ja sao validados por tipo, mas nesta etapa precisam enviar `extractedText` para entrar no fluxo textual de cache e roteamento.

Fluxo de armazenamento dos anexos:

- Redis guarda apenas cache temporario de embeddings por hash.
- Postgres guarda metadados do arquivo, hashes, texto extraido e blocos.
- Postgres/pgvector guarda vetores dos blocos de texto para busca semantica futura.
- Arquivo binario bruto nao e armazenado pelo fluxo atual.
- Audio deve ser transcrito antes de entrar como `extractedText`.
- Imagem/PDF escaneado precisa de OCR ou envio para modelo com visao em etapa futura.

Limites por plano:

| Plano | Anexos | Tipos | Vetor semantico |
|---|---:|---|---|
| `free` | 0 | bloqueado | nao |
| `starter` | 1 arquivo ate 256 KB | texto/json/csv/markdown | nao |
| `growth` | 3 arquivos ate 2 MB | texto/json/csv/markdown/pdf com texto extraido | ate 12 chunks por arquivo |
| `pro` | 5 arquivos ate 8 MB | documentos + imagem/audio com texto extraido/transcricao | ate 24 chunks por arquivo |
| `scale` | 10 arquivos ate 20 MB | documentos + imagem/audio com texto extraido/transcricao | ate 50 chunks por arquivo |

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
