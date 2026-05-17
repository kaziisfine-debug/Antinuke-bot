FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json .npmrc ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY scripts/ ./scripts/

RUN pnpm install --ignore-scripts
RUN cd node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild && node install.js

RUN pnpm --filter @workspace/db run build 2>/dev/null || true
RUN pnpm --filter @workspace/api-zod run build 2>/dev/null || true
RUN pnpm --filter @workspace/api-server run build

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
