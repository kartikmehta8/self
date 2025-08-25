# Multi-stage build for TypeScript API
FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies stage
FROM base AS deps
# Copy package files
COPY package.json yarn.lock* ./
COPY sdk/tests/ts-api/package.json ./sdk/tests/ts-api/
COPY sdk/core/package.json ./sdk/core/
COPY common/package.json ./common/

# Install dependencies using yarn workspaces
RUN yarn install --frozen-lockfile

# Build stage
FROM base AS builder
# Copy installed dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/sdk/tests/ts-api/node_modules ./sdk/tests/ts-api/node_modules

# Copy source code for workspace dependencies
COPY common/ ./common/
COPY sdk/core/ ./sdk/core/
COPY sdk/tests/ts-api/ ./sdk/tests/ts-api/

# Build workspace dependencies
RUN cd common && yarn build
RUN cd sdk/core && yarn build

# Build the TypeScript API
RUN cd sdk/tests/ts-api && yarn build

# Production stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 apiuser

# Copy built files
COPY --from=builder --chown=apiuser:nodejs /app/sdk/tests/ts-api/dist ./dist
COPY --from=builder --chown=apiuser:nodejs /app/sdk/tests/ts-api/package.json ./package.json

# Install only production dependencies
RUN yarn install --frozen-lockfile --production && yarn cache clean

USER apiuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/server.js"]
