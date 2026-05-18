FROM node:22-alpine AS base
WORKDIR /app
<<<<<<< HEAD

# Pin pnpm to v9 to match lockfile format
RUN npm install -g pnpm@9

# Copy workspace config & npmrc BEFORE install so catalog/peer settings apply
COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
=======
RUN corepack enable pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json .npmrc ./
>>>>>>> 26ae8c0d480e4f2e4a26aa0d534284eeabf9b7cb
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



