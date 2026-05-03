# Deploy no VPS com pgvector

## Pré-requisitos
- Docker e Docker Compose instalados no VPS
- Arquivo `.env.production` no diretório do projeto (não commitar)

## Passos para deploy

1. **Clone/atualize o repositório:**
   ```bash
   git pull origin main
   ```

2. **Configure o .env.production:**
   - Copie `.env.example` para `.env.production`
   - Ajuste as variáveis para produção (senhas, URLs, etc.)
   - Exemplo mínimo:
     ```
     POSTGRES_PASSWORD=sua_senha_segura
     DATABASE_URL="postgresql://porthos:sua_senha_segura@localhost:5432/porthos_gateway"
     REDIS_URL=redis://127.0.0.1:6379
     # ... outras variáveis
     ```

3. **Suba os containers:**
   ```bash
   docker compose up -d --build
   ```

4. **Verifique se pgvector foi instalado:**
   ```bash
   docker exec -it porthos_postgres psql -U porthos -d porthos_gateway -c "SELECT name FROM pg_available_extensions WHERE name = 'vector';"
   ```
   Deve retornar: `vector`

## Observações
- A extensão `vector` será criada automaticamente no primeiro startup
- Se o volume `postgres_data` já existir, pode precisar recriar para aplicar o init script
- Para recriar volumes: `docker compose down -v && docker compose up -d --build`