import { prisma } from '@/lib/db';
import { getSubmission } from '@/lib/elasticsearch';
import type { FormField } from '@/components/builder/types';

/**
 * 사전 채움(3단계) — 반복 수집에서 응답자가 겪는 "지난번과 똑같은 걸 또 적는" 고통을 없앤다.
 *
 * 응답 부담이 줄어드는 것이 포인트 보상보다 응답률에 크게 작용할 수 있다.
 * 다만 무분별하게 채우면 확인 없이 통과한 값이 최신 데이터로 둔갑하므로,
 * 필드별 정책과 "확인 필요" 표시로 균형을 잡는다.
 */

export interface PrefillEntry {
  value: unknown;
  policy: 'carry-over' | 'carry-with-confirm';
  /** 사용자가 확인 체크를 해야 제출할 수 있는 항목인지 */
  needsConfirm: boolean;
}

export interface PrefillResult {
  /** 필드 id → 채워질 값 */
  values: Record<string, PrefillEntry>;
  /** 값을 가져온 직전 회차 이름 (화면 안내용) */
  sourceCampaignName: string | null;
  /** 스키마 버전이 달라 일부 필드를 채우지 않았는지 */
  schemaChanged: boolean;
}

const EMPTY: PrefillResult = { values: {}, sourceCampaignName: null, schemaChanged: false };

/**
 * 이 응답자의 직전 회차 응답에서 사전 채움 값을 계산한다.
 *
 * 안전한 기본값은 "확실할 때만 채운다"이다. 애매하면 비워 둔다:
 *  - 익명 문항: 지난 익명 응답을 찾을 방법이 원천적으로 없다(익명성의 필연적 대가).
 *  - 스키마 버전이 다르고 필드 정의가 바뀐 경우: 값이 더 이상 유효하지 않을 수 있다.
 */
export async function computePrefill(
  formId: string,
  respondentId: string,
  currentCampaignId: string,
  fields: FormField[]
): Promise<PrefillResult> {
  const current = await prisma.campaign.findUnique({ where: { id: currentCampaignId } });
  if (!current) return EMPTY;

  // 직전(이전 sequence 중 가장 최근) 회차에서 이 사람의 참여 기록을 찾는다.
  const previous = await prisma.campaign.findFirst({
    where: { formId, sequence: { lt: current.sequence } },
    orderBy: { sequence: 'desc' },
  });
  if (!previous) return EMPTY;

  const participation = await prisma.campaignParticipation.findUnique({
    where: { campaignId_userId: { campaignId: previous.id, userId: respondentId } },
  });
  if (!participation) return EMPTY;

  const doc = await getSubmission(formId, participation.submissionId);
  const prevData = doc?.data;
  if (!prevData) return EMPTY;

  const schemaChanged = previous.schemaVersion !== current.schemaVersion;
  const values: Record<string, PrefillEntry> = {};

  for (const field of fields) {
    const policy = field.prefillPolicy ?? 'clear';
    if (policy === 'clear') continue;

    // 익명 문항은 응답자와의 연결이 없어 지난 값을 특정할 수 없다.
    if (field.anonymous) continue;

    const value = prevData[field.id];
    if (value === undefined || value === null || value === '') continue;

    // 스키마가 바뀌었다면 선택지·타입이 달라졌을 수 있다. 값이 여전히 유효한지
    // 확인 가능한 경우(선택지 포함 여부)만 채우고, 확인할 수 없으면 비워 둔다.
    if (schemaChanged) {
      const hasOptions = Array.isArray(field.options) && field.options.length > 0;
      if (hasOptions) {
        const stillValid = Array.isArray(value)
          ? value.every((v) => field.options!.includes(String(v)))
          : field.options!.includes(String(value));
        if (!stillValid) continue;
      } else {
        // 자유 입력 필드는 타입 변경 여부를 알 수 없으므로 보수적으로 건너뛴다.
        continue;
      }
    }

    values[field.id] = {
      value,
      policy,
      needsConfirm: policy === 'carry-with-confirm',
    };
  }

  return { values, sourceCampaignName: previous.name, schemaChanged };
}
