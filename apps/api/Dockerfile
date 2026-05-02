FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/

RUN pnpm install --filter api...

COPY apps/api ./apps/api

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["sh", "-c", "pnpm db:migrate && pnpm dev"]