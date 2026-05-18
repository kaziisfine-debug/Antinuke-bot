FROM node:22-alpine AS base
WORKDIR /app

# Enable pnpm using Corepack (Node 22 এর জন্য সবচেয়ে ভালো ও clean উপায়)
RUN corepack enable pnpm

# Copy all necessary config files first (pnpm এর জন্য খুব important)
COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./

COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY scripts/ ./scripts/

# Install dependencies
RUN pnpm install --ignore-scripts

# esbuild fix (যদি দরকার হয়)
RUN cd node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild && node install.js

# Build workspaces
RUN pnpm --filter @workspace/db run build 2>/dev/null || true
RUN pnpm --filter @workspace/api-zod run build 2>/dev/null || true
RUN pnpm --filter @workspace/api-server run build

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]