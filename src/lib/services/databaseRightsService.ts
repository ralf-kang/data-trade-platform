import { prisma } from '@/lib/db';

const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

export interface DatabaseRightsInfo {
  producerName: string;
  completedAt: string;
  lastSubstantialUpdate: string;
  investmentDescription: string;
  // 저작권법 제95조: 가장 최근 "상당한 투자" 갱신일로부터 5년.
  protectionExpiresAt: string;
  recentUpdates: Array<{ occurredAt: string; scope: string; description: string; performedBy: string }>;
}

/**
 * 데이터베이스제작자 등록 정보(정형 데이터)를 조회한다. 서비스 전체에 대해 하나의
 * 등록만 운용한다고 가정하고 가장 최근 레코드를 반환한다.
 */
export async function getDatabaseRights(): Promise<DatabaseRightsInfo | null> {
  const registration = await prisma.databaseRegistration.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      updateLogs: { orderBy: { occurredAt: 'desc' }, take: 20 },
    },
  });
  if (!registration) return null;

  const protectionExpiresAt = new Date(registration.lastSubstantialUpdate.getTime() + FIVE_YEARS_MS);

  return {
    producerName: registration.producerName,
    completedAt: registration.completedAt.toISOString(),
    lastSubstantialUpdate: registration.lastSubstantialUpdate.toISOString(),
    investmentDescription: registration.investmentDescription,
    protectionExpiresAt: protectionExpiresAt.toISOString(),
    recentUpdates: registration.updateLogs.map((l) => ({
      occurredAt: l.occurredAt.toISOString(),
      scope: l.scope,
      description: l.description,
      performedBy: l.performedBy,
    })),
  };
}

/**
 * "상당한 투자"에 의한 갱신이 발생했을 때 호출한다 (예: 대규모 데이터 이관, 필드
 * 스키마 일괄 마이그레이션, 대량 검증/보충 작업 등 — 사소한 단건 수정은 해당하지
 * 않는다). 저작권법 제95조 제2항에 따라 해당 갱신 부분의 보호기간이 이 시점부터
 * 다시 5년 기산되므로, 등록 레코드의 lastSubstantialUpdate를 함께 갱신한다.
 */
export async function recordSubstantialUpdate(params: {
  scope: string;
  description: string;
  performedBy: string;
}) {
  const registration = await prisma.databaseRegistration.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!registration) throw new Error('DatabaseRegistration이 존재하지 않습니다. 시드를 먼저 실행하세요.');

  await prisma.$transaction([
    prisma.databaseUpdateLog.create({
      data: {
        registrationId: registration.id,
        scope: params.scope,
        description: params.description,
        performedBy: params.performedBy,
      },
    }),
    prisma.databaseRegistration.update({
      where: { id: registration.id },
      data: { lastSubstantialUpdate: new Date() },
    }),
  ]);
}
