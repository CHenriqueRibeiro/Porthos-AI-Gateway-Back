# Produção — alinhado ao fluxo VPS: schema Prisma + app + db push ao subir
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Código + prisma/ + prisma.config.ts (Prisma 6)
COPY . .

RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 3333

# db push: aplica schema no Postgres (homolog/dev). Produção crítica: prefira `prisma migrate deploy` em pipeline.
# exec: sinal SIGTERM chega ao Node
CMD ["sh", "-c", "npx prisma db push && exec node src/server.js"]
