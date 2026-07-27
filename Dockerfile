FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Schema + Prisma-Config werden für das postinstall-Skript (prisma generate) benötigt
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_-Variablen werden von Next.js beim Build fest in das Client-Bundle
# eingebacken — müssen daher als Build-ARG hier ankommen, ein Setzen zur Laufzeit
# im Runner-Container wirkt sich auf den Client-Code nicht mehr aus.
# Optional: bleibt das ARG leer, greift der fest hinterlegte Standard-DSN aus
# lib/sentry-dsn.ts — der Browser meldet also auch ohne Build-Secret an GlitchTip.
# Nur setzen, um auf ein anderes Projekt umzulenken oder mit "off" abzuschalten.
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/kundefutter.db

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql

# Install Prisma CLI + Geo-Proxy-Abhängigkeiten
COPY package.json package-lock.json ./
RUN npm install --ignore-scripts --no-fund --no-audit prisma dotenv geoip-lite && \
    chown -R nextjs:nodejs /app/node_modules/.prisma \
                           /app/node_modules/@prisma \
                           /app/node_modules/prisma

# Geo-Proxy (+ abhängigkeitsfreier GlitchTip-Reporter für PID 1)
COPY geo-server.js ./
COPY scripts/sentry-store-report.cjs ./scripts/

# Entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

RUN mkdir -p /data && chown nextjs:nodejs /data
RUN mkdir -p public/uploads/artikel && chown -R nextjs:nodejs public/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/db-check || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
