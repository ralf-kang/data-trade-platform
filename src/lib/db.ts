import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

// 정형 데이터(계정/폼 운영 메타데이터/감사로그/공유요청) 전용 PostgreSQL 클라이언트.
// 비정형 데이터(폼 필드 정의, 제출 데이터)는 elasticsearch.ts 를 사용한다.
//
// Next.js dev 모드의 모듈 핫 리로드로 인해 매 요청마다 새 PrismaClient가 생성되는 것을
// 방지하기 위해 전역 싱글턴으로 캐싱한다 (Prisma 공식 권장 패턴).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
