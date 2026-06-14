# ── Stage 1: Production dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

RUN mkdir -p uploads/recordings && chown -R nodejs:nodejs uploads \
    && apk add --no-cache wget

USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/ || exit 1

CMD ["node", "src/server.js"]
