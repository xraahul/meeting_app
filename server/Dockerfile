# Stage 1: Build & Install Dependencies
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci

# Copy application source
COPY . .

# Stage 2: Production release
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Only install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy built code from builder (avoiding node_modules copy)
COPY --from=builder /usr/src/app/src ./src
COPY --from=builder /usr/src/app/package.json ./

# Ensure storage directories exist with write access
RUN mkdir -p uploads && chmod 777 uploads

EXPOSE 5000

CMD ["npm", "start"]
