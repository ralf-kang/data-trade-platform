/**
 * 3단계 마이그레이션 — 기존 양식에 기본 회차를 만들고 기존 제출을 귀속시킨다.
 *
 * 회차 도입 이전의 제출은 소속 회차가 없다. 그대로 두면 "모든 제출은 어떤 회차엔가
 * 속한다"는 전제가 깨져 추세·집계가 반쪽이 되므로, 양식마다 1회차를 만들어 넣는다.
 *
 * 원본을 지우거나 바꾸지 않는 덧붙이기 작업이라 실패해도 되돌리기 쉽다.
 * 실행: npx tsx scripts/migrate-campaigns.ts  (또는 node --experimental-strip-types)
 */
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client as ElasticClient } from '@elastic/elasticsearch';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const es = new ElasticClient({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
  },
});

async function main() {
  const forms = await prisma.formRegistry.findMany({ include: { campaigns: true } });
  console.log(`[migrate] 양식 ${forms.length}건 확인`);

  for (const form of forms) {
    if (form.campaigns.length > 0) {
      console.log(`  - ${form.id}: 회차 이미 존재 (${form.campaigns.length}개), 건너뜀`);
      continue;
    }

    // 기존 양식의 기간을 그대로 1회차로 옮긴다.
    const campaign = await prisma.campaign.create({
      data: {
        formId: form.id,
        name: '기본 수집',
        sequence: 1,
        startsAt: form.startsAt ?? form.createdAt,
        endsAt: form.expiresAt,
        schemaVersion: form.schemaVersion,
        status: form.status === 'OPEN' ? 'OPEN' : 'CLOSED',
      },
    });

    // 기존 제출 문서에 campaignId 백필.
    const res = await es.updateByQuery({
      index: 'webreport-submissions',
      refresh: true,
      query: {
        bool: {
          must: [{ term: { formId: form.id } }],
          must_not: [{ exists: { field: 'campaignId' } }],
        },
      },
      script: {
        source: 'ctx._source.campaignId = params.cid; if (ctx._source.revision == null) { ctx._source.revision = 0 }',
        params: { cid: campaign.id },
      },
    });

    // 참여 기록은 respondentId가 있는 제출만 만들 수 있다.
    // 1단계 이전 제출은 응답자를 알 수 없어 소급 보상이 불가능하다 — 이 점은
    // 보상 시작 시점 공지에 반드시 포함되어야 한다.
    const identified = await es.search<{ respondentId?: string; submissionId: string; submittedAt: string }>({
      index: 'webreport-submissions',
      size: 1000,
      query: {
        bool: {
          must: [{ term: { formId: form.id } }, { exists: { field: 'respondentId' } }],
        },
      },
    });

    let participations = 0;
    for (const hit of identified.hits.hits) {
      const src = hit._source;
      if (!src?.respondentId) continue;
      const exists = await prisma.campaignParticipation.findUnique({
        where: { campaignId_userId: { campaignId: campaign.id, userId: src.respondentId } },
      });
      if (exists) continue;
      await prisma.campaignParticipation.create({
        data: {
          campaignId: campaign.id,
          userId: src.respondentId,
          submissionId: src.submissionId,
          submittedAt: new Date(src.submittedAt),
        },
      });
      participations++;
    }

    // 익명 버퍼의 미귀속 잔여분도 이 회차로 옮긴다.
    const buffered = await prisma.anonymousResponseBuffer.updateMany({
      where: { formId: form.id, campaignId: null },
      data: { campaignId: campaign.id },
    });

    console.log(
      `  - ${form.id}: 회차 생성 · 제출 ${res.updated}건 귀속 · 참여기록 ${participations}건 · 버퍼 ${buffered.count}건`
    );
  }

  // 익명 인덱스의 미귀속 문서도 각 양식의 1회차로.
  for (const form of forms) {
    const c = await prisma.campaign.findFirst({ where: { formId: form.id }, orderBy: { sequence: 'asc' } });
    if (!c) continue;
    await es
      .updateByQuery({
        index: 'webreport-anon-submissions',
        refresh: true,
        query: {
          bool: {
            must: [{ term: { formId: form.id } }],
            must_not: [{ exists: { field: 'campaignId' } }],
          },
        },
        script: { source: 'ctx._source.campaignId = params.cid', params: { cid: c.id } },
      })
      .catch(() => undefined);
  }

  console.log('[migrate] 완료');
}

main()
  .catch((err) => {
    console.error('[migrate] 실패:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
