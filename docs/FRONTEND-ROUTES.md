# Rotas para o front-end - LLM Gateway API

Base local: `http://localhost:3333`

Use `Authorization: Bearer <accessToken>` em todas as rotas protegidas. O token vem de `auth.accessToken` em `POST /auth/register` ou `POST /auth/login`.

## Fluxo principal do front

1. Buscar catalogo publico: `GET /public/plans`
2. Cadastrar ou entrar: `POST /auth/register` ou `POST /auth/login`
3. Guardar `accessToken`, `apiKey.id` e, se existir, `apiKey.key`
4. Cadastrar provider key antes de chamar LLM: `POST /provider-keys?apiKeyId=:apiKeyId`
5. Criar sessao: `POST /sessions`
6. Usar LLM com `sessionId`: `POST /chat` ou `POST /extract`
7. Mostrar metricas: `GET /me/dashboard` ou `GET /usage/:apiKeyId`

## Autenticacao

| Metodo | Rota | Auth | Body |
|---|---|---|---|
| `POST` | `/auth/register` | Publica | `name`, `email`, `password`, `planCode` |
| `POST` | `/auth/login` | Publica | `email`, `password` |
| `POST` | `/auth/logout` | Bearer | vazio |

Planos atuais para `planCode`: `free`, `starter`, `growth`, `pro`, `scale`.

## Publico

| Metodo | Rota | Uso |
|---|---|---|
| `GET` | `/health` | Status do servico |
| `GET` | `/public/plans` | Planos e addons runtime |
| `POST` | `/public/plans/simulate` | Simula preco/config de plano |
| `POST` | `/public/plans/recommend` | Recomenda plano por perfil de uso |

Exemplo `POST /public/plans/simulate`:

```json
{
  "planCode": "starter",
  "addonCodes": ["cache_starter_plus"],
  "overrides": {
    "historico_operacional": "dias_60"
  }
}
```

## Conta e chaves gateway

| Metodo | Rota | Query | Uso |
|---|---|---|---|
| `GET` | `/apikeys` | `highlightApiKeyId` opcional | Lista chaves gateway do usuario |
| `POST` | `/apikeys` | - | Cria chave gateway respeitando limite do plano |
| `POST` | `/users` | - | Rota legada para criar usuario |

A API key gateway (`apiKeyId`) e o identificador usado para assinatura, provider keys, analytics e sessoes. O segredo `apiKey.key` e retornado no cadastro/login, mas as rotas atuais usam JWT + `apiKeyId`, nao `x-api-key`.

## Sessoes e mensagens

| Metodo | Rota | Body/query | Uso |
|---|---|---|---|
| `POST` | `/sessions` | body: `apiKeyId`, `externalConversationId`, `channel`, `label` | Cria ou reutiliza sessao por conversa externa |
| `GET` | `/sessions` | `page`, `pageSize`, `status`, `apiKeyId` | Lista sessoes |
| `GET` | `/sessions/:id` | - | Detalhe da sessao com mensagens |
| `POST` | `/sessions/:id/close` | - | Encerra sessao |
| `POST` | `/messages` | `sessionId`, `role`, `content` | Cria mensagem manual |
| `GET` | `/sessions/:id/messages` | - | Lista mensagens |

Status de sessao: `active`, `closed`, `expired`. Sessoes expiram por inatividade em 24 horas quando processadas pelo fluxo LLM.

## Chat e extracao

| Metodo | Rota | Body obrigatorio | Observacao |
|---|---|---|---|
| `POST` | `/chat` | `sessionId`, `messages[]` | Retorna formato compativel com `chat.completion` |
| `POST` | `/extract` | `sessionId`, `messages[]`, `response_format` | Extracao estruturada |

`messages[].role`: `system`, `user`, `assistant`. E obrigatorio ter ao menos uma mensagem `user` com `content`.

Modelos usam prefixo por provider:

```text
openai/gpt-4o-mini
anthropic/<modelo>
gemini/<modelo>
```

Antes de usar um provider, cadastre uma provider key default para a `apiKeyId`.

Exemplo `POST /chat`:

```json
{
  "sessionId": "SESSION_UUID",
  "model": "openai/gpt-4o-mini",
  "messages": [
    { "role": "user", "content": "Responda em uma frase." }
  ],
  "temperature": 0.2,
  "max_tokens": 300,
  "debug": false
}
```

Exemplo `POST /extract` com schema:

```json
{
  "sessionId": "SESSION_UUID",
  "model": "openai/gpt-4o-mini",
  "messages": [
    { "role": "user", "content": "Contrato assinado por Maria em 2026-05-03." }
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "contract_extract",
      "schema": {
        "type": "object",
        "properties": {
          "nome": { "type": "string" },
          "data": { "type": "string" }
        },
        "required": ["nome", "data"]
      }
    }
  },
  "extraction_profile": "generic_document"
}
```

Resposta base de `/chat` e `/extract`:

```json
{
  "id": "chatcmpl-gateway-...",
  "object": "chat.completion",
  "created": 1770000000,
  "model": "openai/gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0
  },
  "meta": {
    "scope": "global",
    "cache": null,
    "durationMs": 123,
    "provider": "openai",
    "providerModel": "gpt-4o-mini",
    "llmCalled": true,
    "routeType": "chat",
    "workloadCategory": "light"
  }
}
```

## Provider keys

| Metodo | Rota | Query/body |
|---|---|---|
| `GET` | `/provider-keys` | query opcional `apiKeyId` |
| `POST` | `/provider-keys` | query opcional `apiKeyId`; body `provider`, `apiKey`, `label`, `isDefault` |
| `PATCH` | `/provider-keys/:id/default` | query opcional `apiKeyId` |
| `DELETE` | `/provider-keys/:id` | query opcional `apiKeyId` |

Providers aceitos: `openai`, `anthropic`, `gemini`.

## Billing

| Metodo | Rota | Uso |
|---|---|---|
| `POST` | `/billing/seed` | Popula catalogo no banco |
| `GET` | `/plans` | Lista planos/addons do banco |
| `GET` | `/subscriptions/current` | Assinatura atual e `effectiveConfig` |
| `POST` | `/subscriptions` | Cria/troca assinatura |
| `POST` | `/subscriptions/override` | Aplica override de feature |

Features/presets atuais:

| Feature | Presets |
|---|---|
| `cache_inteligente` | `desativado`, `starter`, `growth`, `pro`, `scale`, `redis_24h_semantic_3d`, `redis_7d_semantic_15d`, `redis_30d_semantic_60d` |
| `historico_operacional` | `dias_7`, `dias_30`, `dias_60`, `dias_90`, `dias_180`, `dias_365` |
| `memoria_conteudo` | `desativada`, `basica`, `expandida`, `avancada`, `enterprise` |
| `base_inteligente` | `pequena`, `media`, `grande`, `enterprise` |
| `analytics` | `basico`, `expandido`, `avancado` |
| `api_keys` | `uma`, `tres`, `cinco`, `dez`, `vinte_cinco`, `cinquenta`, `cem` |
| `storage` | `mb_50`, `mb_500`, `gb_1`, `gb_2`, `gb_5`, `gb_10`, `gb_25`, `gb_50` |
| `concurrency` | `baixa`, `media`, `alta`, `scale` |

Addons atuais: `api_keys_5`, `api_keys_10`, `api_keys_25`, `cache_starter_plus`, `cache_growth_plus`, `cache_pro_plus`, `history_60d`, `history_180d`, `history_365d`, `analytics_advanced`, `memory_advanced`, `memory_enterprise`, `storage_1gb`, `storage_5gb`, `storage_25gb`.

## Analytics e dashboard

| Metodo | Rota | Query |
|---|---|---|
| `GET` | `/usage/:apiKeyId` | `day`, `startDate`, `endDate`, `includeDaily` |
| `GET` | `/me/dashboard` | `day`, `startDate`, `endDate`, `includeDaily` |

Use `day=YYYY-MM-DD` para um dia especifico ou `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` para periodo. Sem filtro, retorna o mes atual ate hoje.

## Model pricing

| Metodo | Rota | Body |
|---|---|---|
| `GET` | `/model-pricing` | - |
| `POST` | `/model-pricing` | `provider`, `model`, `inputPer1k`, `outputPer1k`, `currency`, `isActive` |

## Admin

| Metodo | Rota | Auth |
|---|---|---|
| `POST` | `/admin/maintenance/run` | Header `x-admin-secret` |

## Regras de negocio importantes

- Identidade de conta usa JWT.
- O uso LLM e faturado pela `apiKeyId` resolvida a partir da `sessionId`.
- Rotas de LLM exigem provider key do cliente; sem ela, o gateway retorna erro `402`.
- Plano `free` desativa cache inteligente e historico persistido de conversa no fluxo LLM.
- Limites operacionais por plano bloqueiam tamanho de entrada e numero de campos de schema.
- Addons precisam ser permitidos no plano e nao podem duplicar a mesma feature na mesma assinatura.
- `effectiveConfig` e resolvido na ordem: plano, addons, overrides.
- `externalConversationId` em `POST /sessions` evita criar sessoes duplicadas para a mesma conversa externa.
