FROM node:20-slim AS builder

WORKDIR /app

# Copy worker package files and install dependencies
COPY services/worker/package.json services/worker/package-lock.json* services/worker/
WORKDIR /app/services/worker
RUN npm install

# Copy shared library code (used via @/lib/* path alias)
WORKDIR /app
COPY src/lib/ src/lib/

# Copy worker source
COPY services/worker/src/ services/worker/src/
COPY services/worker/tsconfig.json services/worker/tsconfig.json

# Build TypeScript and rewrite path aliases
WORKDIR /app/services/worker
RUN npm run build

# --- Production stage ---
FROM node:20-slim

WORKDIR /app

# Copy compiled output and production dependencies
COPY --from=builder /app/services/worker/dist/ dist/
COPY --from=builder /app/services/worker/node_modules/ node_modules/
COPY --from=builder /app/services/worker/package.json package.json

EXPOSE 3001

CMD ["node", "dist/services/worker/src/index.js"]
