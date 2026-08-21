# ── Build frontend ──────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_API_BASE_URL=""
RUN npm run build

# ── Build backend ──────────────────────────────────────────────────────
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ .
RUN npx prisma generate
RUN npm run build

# ── Production image ───────────────────────────────────────────────────
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app

# Server dependencies (prod only) + tsx for seed
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
RUN npm install tsx

# Prisma schema & config (needed before generate)
COPY server/prisma ./prisma/
COPY server/prisma.config.ts ./
RUN npx prisma generate

# Built server output
COPY --from=backend-build /app/dist ./dist/

# Generated Prisma client
COPY --from=backend-build /app/src/generated ./src/generated/

# Frontend static build
COPY --from=frontend-build /app/dist/public ./dist/public/

# Startup script
COPY deploy-start.sh ./
RUN chmod +x deploy-start.sh

EXPOSE 4000
CMD ["./deploy-start.sh"]
