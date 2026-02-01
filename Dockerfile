FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN apk update && apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

RUN apk del python3 make g++ && rm -rf /var/cache/apk/*

COPY --from=builder /app/dist ./dist
COPY public ./public

ENV NODE_ENV=production
ENV DATABASE_URL=/data/rsscode.db
ENV PORT=3000

VOLUME ["/data"]

EXPOSE 3000

CMD ["node", "dist/index.js"]
