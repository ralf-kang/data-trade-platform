import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// 정형 데이터(계정, 폼 배포/운영 메타데이터, 감사로그, 공유 워크플로우)를 담당하는
// PostgreSQL 연결 설정. 실제 폼 필드 구성/제출 데이터는 Elasticsearch(src/lib/elasticsearch.ts)가 담당한다.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
