FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm
RUN apk add --no-cache python3 make g++

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --filter web

COPY apps/web ./apps/web

WORKDIR /app/apps/web

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]