# ================================================
# Stage 1: Builder — installs all deps and builds
# ================================================
FROM node:20-alpine AS builder
RUN npm install -g pnpm@9 --quiet
WORKDIR /app

# Copy workspace manifests first (for layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig*.json ./

# Copy all workspace source
COPY lib/ ./lib/
COPY artifacts/ ./artifacts/
COPY scripts/ ./scripts/

# Install all dependencies
RUN pnpm install --no-frozen-lockfile

# Build API server (esbuild → dist/index.mjs, fully bundled)
RUN pnpm --filter @workspace/api-server run build

# Build frontend (Vite → dist/public, static files)
# VITE_* vars are baked into the bundle at build time
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_CLERK_PROXY_URL=""
ENV PORT=3000 \
    BASE_PATH=/ \
    NODE_ENV=production \
    VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY} \
    VITE_CLERK_PROXY_URL=${VITE_CLERK_PROXY_URL}
RUN pnpm --filter @workspace/cloud-marketplace run build

# ================================================
# Stage 2: API — Node + pnpm (for db migrations)
# ================================================
FROM node:20-alpine AS api
RUN npm install -g pnpm@9 --quiet
WORKDIR /app

# Copy the full built workspace (pnpm needs it for filter commands)
COPY --from=builder /app .

ENV NODE_ENV=production PORT=8080

COPY docker/api-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]

# ================================================
# Stage 3: Frontend — nginx serving static files
# ================================================
FROM nginx:alpine AS frontend
COPY --from=builder /app/artifacts/cloud-marketplace/dist/public /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
