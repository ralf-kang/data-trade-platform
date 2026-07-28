# syntax=docker/dockerfile:1
#
# WAS(Web Application Server) 계층 이미지 — Next.js 앱(서버 API 레이어 포함)을 빌드/구동한다.
# 3-tier 구성: nginx(web, 리버스 프록시) -> 이 이미지(was) -> postgres/elasticsearch(db)
#
# 멀티스테이지 빌드로 최종 런타임 이미지에는 devDependencies와 소스가 포함되지 않는다.
# next.config.ts 의 `output: "standalone"` 옵션과 짝을 이룬다.

ARG NODE_VERSION=20-alpine

# ---------------------------------------------------------------------------
# 1) deps: 의존성 설치 (devDependencies 포함 — build 단계에서 prisma/typescript 필요)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# 2) build: Prisma Client 생성 + Next.js 프로덕션 빌드
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 시점에는 실제 DB에 접속하지 않지만, prisma generate/schema validate가
# DATABASE_URL 존재를 요구하므로 더미 값을 넣어준다. 런타임 값은 compose의
# environment/.env 로 별도 주입된다.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# 2-b) migrator: `prisma migrate deploy` 전용 — CLI가 필요하므로 devDependencies를
#      포함한 이 스테이지에서만 실행하고, 최종 런타임(runner) 이미지에는 포함하지 않는다.
#      docker-compose 에서 별도 1회성 서비스(migrate)로 사용된다.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------
# 3) runner: standalone 산출물만 담은 경량 런타임 이미지
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
