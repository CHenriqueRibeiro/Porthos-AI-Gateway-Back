-- Init script para habilitar pgvector no banco porthos_gateway
-- Este arquivo será executado automaticamente quando o container iniciar

-- Criar extensão pgvector se não existir
CREATE EXTENSION IF NOT EXISTS vector;

-- Verificar se foi criada
SELECT name FROM pg_available_extensions WHERE name = 'vector';