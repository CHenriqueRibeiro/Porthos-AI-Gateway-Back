# Modelo de negocio - LLM Gateway API

## Produto

Gateway multi-tenant para uso de LLMs via OpenAI, Anthropic e Gemini. Cada cliente possui usuario, tenant, uma ou mais API keys gateway, provider keys, assinatura e sessoes de uso.

O gateway centraliza:

- autenticacao e contexto de conta por JWT;
- isolamento de dados por tenant;
- roteamento para provedores de LLM;
- cache, memoria, historico e extracao estruturada;
- estimativa de custo e analytics;
- planos, addons e overrides por presets.

## Entidades principais

| Entidade | Papel |
|---|---|
| `User` | Conta autenticada por email/senha e JWT |
| `Tenant` | Isolamento logico; dados operacionais vivem em schemas do tenant |
| `ApiKey` | Chave gateway usada como unidade de assinatura, provider keys, sessoes e analytics |
| `SubscriptionPlan` | Plano comercial |
| `AddonCatalog` | Upgrade de uma feature especifica |
| `CustomerSubscription` | Assinatura ativa de uma API key gateway |
| `CustomerConfigOverride` | Override de feature/preset na assinatura |
| `ModelPricing` | Preco estimado por provider/model |

## Planos

Planos atuais do catalogo runtime:

| Codigo | Tipo | Preco base |
|---|---|---|
| `free` | `free` | R$ 0,00 |
| `starter` | `paid` | R$ 79,00 |
| `growth` | `paid` | R$ 199,00 |
| `pro` | `paid` | R$ 499,00 |
| `scale` | `enterprise` | R$ 999,00 |

O plano define presets padrao de cache, historico, memoria, base inteligente, analytics, API keys, storage e concorrencia.

## Addons

Addons atuais:

```text
api_keys_5
api_keys_10
api_keys_25
cache_starter_plus
cache_growth_plus
cache_pro_plus
history_60d
history_180d
history_365d
analytics_advanced
memory_advanced
memory_enterprise
storage_1gb
storage_5gb
storage_25gb
```

Regras:

- addon precisa existir e estar ativo no banco;
- addon precisa ser permitido para o plano escolhido;
- nao pode haver dois addons para a mesma `featureKey` na mesma assinatura;
- soma de addons nao pode ultrapassar o budget comercial do plano;
- quando excede o budget, a API sugere upgrade para o proximo plano quando houver.

## Configuracao efetiva

`effectiveConfig` e resolvido nesta ordem:

1. presets do plano;
2. addons ativos;
3. overrides ativos.

Se addon e override atuarem na mesma feature, o override vence.

## Limites operacionais por plano

| Plano | maxInputChars | maxSchemaFields | maxRelevantBlocks | maxCandidateHints |
|---|---:|---:|---:|---:|
| `free` | 8000 | 20 | 4 | 15 |
| `starter` | 15000 | 40 | 8 | 30 |
| `growth` | 35000 | 80 | 12 | 50 |
| `pro` | 50000 | 120 | 16 | 60 |
| `scale` | 100000 | 200 | 24 | 100 |

## Rate limit por plano

| Plano | Requisicoes/minuto | Burst |
|---|---:|---:|
| `free` | 20 | 5 |
| `starter` | 60 | 20 |
| `growth` | 180 | 60 |
| `pro` | 300 | 100 |
| `scale` | 600 | 200 |

## Regras de uso LLM

- `/chat` e `/extract` exigem JWT e `sessionId`.
- A sessao precisa pertencer ao usuario autenticado.
- A API key gateway efetiva vem da sessao.
- O modelo define o provider pelo prefixo: `openai/`, `anthropic/`, `gemini/`.
- O cliente precisa cadastrar uma provider key default para o provider usado.
- Sem provider key, o gateway retorna erro `402`.
- Sessoes fechadas ou expiradas retornam conflito (`409`).
- Sessoes expiram por inatividade em 24 horas quando processadas pelo fluxo LLM.

## Cache, memoria e historico

- Plano `free` desativa cache inteligente e nao persiste historico automatico no fluxo LLM.
- Planos pagos podem usar cache fingerprint, cache semantico, memoria de campos e memoria de documento conforme presets.
- Extracao estruturada pode ser resolvida localmente quando os campos sao encontrados com confianca suficiente.
- Quando resposta vem de cache ou memoria, a API registra uso sem chamar LLM.

## Analytics

O gateway registra eventos de uso com:

- tokens de entrada/saida enviados ao provider;
- tokens economizados por cache/memoria;
- custo estimado;
- provider/model;
- source da chave;
- tipo de cache;
- escopo;
- rota (`chat` ou `extract`);
- workload (`light`, `medium`, `heavy`).

Rotas de leitura:

- `GET /usage/:apiKeyId` para uma API key;
- `GET /me/dashboard` consolidado por usuario.

## Fluxo comercial recomendado

1. Front consulta `GET /public/plans`.
2. Cliente se cadastra com `POST /auth/register`.
3. Sistema retorna usuario, tenant, API key gateway, assinatura e JWT.
4. Cliente cadastra provider key em `POST /provider-keys`.
5. Cliente cria sessao em `POST /sessions`.
6. Cliente usa `/chat` ou `/extract`.
7. Front exibe analytics com `/me/dashboard`.
