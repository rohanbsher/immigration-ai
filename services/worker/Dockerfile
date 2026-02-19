FROM node:20-slim AS builder

WORKDIR /app

# Install root dependencies first (for type resolution during compilation).
# Shared code in src/lib/ imports packages like @supabase/ssr, next/headers,
# etc. that live in the main app's package.json. These are needed at compile
# time but discarded in the production image.
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Install worker-specific dependencies
COPY services/worker/package.json services/worker/package-lock.json* services/worker/
WORKDIR /app/services/worker
RUN npm install --legacy-peer-deps

# Copy shared library code (used via @/lib/* path alias)
WORKDIR /app
COPY src/lib/ src/lib/
COPY src/types/ src/types/

# Copy worker source
COPY services/worker/src/ services/worker/src/
COPY services/worker/tsconfig.json services/worker/tsconfig.json

# Build TypeScript and rewrite path aliases
WORKDIR /app/services/worker
RUN npm run build

# --- Production stage (lean — only worker code and its deps) ---
FROM node:20-slim

WORKDIR /app

# Copy compiled output and worker-only production dependencies
COPY --from=builder /app/services/worker/dist/ dist/
COPY --from=builder /app/services/worker/node_modules/ node_modules/
COPY --from=builder /app/services/worker/package.json package.json

EXPOSE 3001

CMD ["node", "dist/services/worker/src/index.js"]
