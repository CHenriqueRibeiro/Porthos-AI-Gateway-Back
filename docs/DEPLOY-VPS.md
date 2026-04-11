# Deploy na VPS (git pull)

O repositório Git é a **fonte da verdade**: o que importa é o que está commitado. A VPS só precisa de **segredos** e **comandos** que não vão no Git.

Na raiz existem **`Dockerfile`** e **`.dockerignore`** para o serviço `app` do `docker-compose.yml`. Faça commit deles para a VPS e o `git pull` alinhar o build com o seu PC.

## O que não entra no Git (e por isso “falta” ao dar pull)

| Arquivo | Onde criar | Motivo |
|---------|------------|--------|
| `.env` ou `.env.production` | Só na máquina / VPS | Senhas e chaves |
| `node_modules` | `npm install` na build | Dependências |

Use o modelo **`.env.example`** na raiz: copie e renomeie na VPS.

```bash
cp .env.example .env.production
nano .env.production   # preencha DATABASE_URL, REDIS_URL, JWT_SECRET, etc.
```

**Formato do `.env.production`:** uma variável por linha. Não pode haver duas chaves na mesma linha (ex.: fim de `DATABASE_URL=` grudado em `ENCRYPTION_SECRET=`). O `DATABASE_URL` dentro do Docker deve usar host **`postgres`** e **`REDIS_URL`** host **`redis`**, iguais aos serviços deste `docker-compose`.

**Segurança:** troque **POSTGRES_PASSWORD** e ajuste o mesmo valor em `DATABASE_URL`. Não commite `.env.production`.

O `docker-compose.yml` referencia `.env.production` no serviço `app` — esse arquivo deve existir na VPS ao subir os containers.

## Fluxo recomendado

1. **No PC (dev):** commit e push de tudo que for código (sem `.env` com segredo).
2. **Na VPS:**
   ```bash
   cd ~/Porthos-AI-Gateway-Back
   git pull
   ```
3. Se aparecerem **novas dependências:** `npm ci` ou rebuild da imagem Docker.
4. Se mudou **Prisma:** `npx prisma migrate deploy` (ou `db push` em dev) **com o mesmo `DATABASE_URL` da VPS**.
5. **Primeiro deploy / banco vazio:** `npm run seed:billing` (fora do container ou com env carregado).
6. Subir stack: `docker compose build --no-cache app && docker compose up -d` (ajuste conforme seu fluxo).

## Por que “quebrava” antes

- Arquivos como **`npm` / `npx`** na raiz não são o Node — costumam ser **saída de comando colada por engano**. Não devem existir no repo; foram removidos e ignorados no `.gitignore`.
- **`.env.production` na VPS** não vem do `git pull` — precisa ser criado uma vez a partir de `.env.example`.

## Checklist rápido após `git pull`

- [ ] `.env.production` existe e está completo na VPS  
- [ ] `docker compose` / app sobe sem erro de env  
- [ ] Migrações Prisma aplicadas  
- [ ] `npm run seed:billing` se o catálogo de planos estiver vazio  
