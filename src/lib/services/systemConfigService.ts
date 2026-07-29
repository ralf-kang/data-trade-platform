import { prisma } from '@/lib/db';
import { isPlatformAdmin, type ActingUser } from '@/lib/auth';
import type { RewardVisibility } from '@/generated/prisma/client';

const CONFIG_ID = 'default';

export async function getSystemConfig() {
  const config = await prisma.systemConfig.findUnique({ where: { id: CONFIG_ID } });
  return (
    config ?? {
      id: CONFIG_ID,
      publicBaseUrl: null,
      defaultAnonymityThreshold: 5,
      rewardVisibility: 'ADMIN_ONLY' as RewardVisibility,
      maxWeeklyInvitesPerUser: 3,
      updatedAt: new Date(0),
    }
  );
}

export async function setPublicBaseUrl(publicBaseUrl: string | null) {
  return prisma.systemConfig.upsert({
    where: { id: CONFIG_ID },
    update: { publicBaseUrl },
    create: { id: CONFIG_ID, publicBaseUrl },
  });
}

export async function setRewardVisibility(rewardVisibility: RewardVisibility) {
  return prisma.systemConfig.upsert({
    where: { id: CONFIG_ID },
    update: { rewardVisibility },
    create: { id: CONFIG_ID, rewardVisibility },
  });
}

/**
 * 보상 화면 단일 게이트 — API와 화면이 서로 다른 판정을 하면 화면만 가리고 API로
 * 우회되는 사고가 나므로(§마스킹 계층과 같은 원칙), 노출 여부 판정은 이 함수 하나만 쓴다.
 *
 * HIDDEN: 아무도 못 봄(관리자 포함) · ADMIN_ONLY: 플랫폼 관리자만 미리보기 · ALL_MEMBERS: 전체 공개.
 */
export async function canSeeRewards(actor: ActingUser): Promise<boolean> {
  const { rewardVisibility } = await getSystemConfig();
  if (rewardVisibility === 'ALL_MEMBERS') return true;
  if (rewardVisibility === 'ADMIN_ONLY') return isPlatformAdmin(actor);
  return false;
}
