import { countQuasiIdentifierCombinations } from '@/lib/elasticsearch';
import type { FormField } from '@/components/builder/types';

/**
 * 마스킹 계층 — 제작 자격 게이트가 뚫리거나, 자격 이전에 만들어진 양식이 있을 때
 * 실질적 피해를 막는 마지막 방어선.
 *
 * 이 서비스는 다른 어떤 기능(자격 심사, 동의서 게이트)에도 의존하지 않는다.
 * 게이트가 전부 뚫려도, 무자격으로 만들어진 양식의 데이터는 여기서 막힌다.
 * 그래서 단독으로 검증 가능하고, 구현 우선순위도 가장 높다.
 *
 * 규칙(확정):
 *   - 자유서술(textarea)·단답(text)·정규식(regex-input) 필드 → 항상 마스킹
 *   - 선택지(select/radio/checkbox)·숫자(number) 등 나머지 → 평소엔 노출
 *   - 단, 노출되는 필드들의 조합이 이 스코프 안에서 유일(k=1)하면 → 레코드 전체 마스킹
 *     (선택지·숫자만으로도 조합하면 사실상 실명일 수 있기 때문)
 *   - 집계(개수·비율)는 항상 허용 — 개별 식별을 막는 것이지 분석을 막는 것이 아니다
 *
 * 조회·CSV 추출·v1 API 세 경로 모두 이 모듈을 거친다. 화면에서만 가리면 API로
 * 그대로 우회되므로, 마스킹은 반드시 서비스 계층(데이터가 나가는 지점)에서 적용한다.
 */

export const MASKED_FIELD_TYPES = new Set(['text', 'textarea', 'regex-input']);
const FIELD_REDACTED = '••••• (마스킹됨)';
const RECORD_REDACTED = '(비공개 — 다른 응답값과의 조합으로 개인이 식별될 수 있음)';

export interface MaskableRegistry {
  authorHadPrivacyAuth: boolean;
  maskingExemptedAt: Date | null;
}

/**
 * 이 양식의 데이터를 마스킹해야 하는지.
 *
 * 🔴 사후에 제작자가 자격을 얻어도 이 값은 자동으로 바뀌지 않는다 — 제작 시점에
 * `authorHadPrivacyAuth`가 고정되기 때문이다(formService). 무자격으로 걷은 데이터가
 * 나중의 승인으로 소급 정당화되면 "일단 걷고 나중에 자격 따면 된다"가 학습된다.
 * 해제는 슈퍼관리자가 사유를 남기고 `maskingExemptedAt`을 채우는 명시적 예외로만 가능하다.
 */
export function shouldMaskForm(registry: MaskableRegistry): boolean {
  return !registry.authorHadPrivacyAuth && !registry.maskingExemptedAt;
}

/** 마스킹 판정에서 "노출되는 쪽"으로 남는 필드 — k=1 판정의 준식별자 후보다.
 * type을 함께 넘기는 이유는 countQuasiIdentifierCombinations가 필드 타입에 따라
 * ES 경로(.keyword 유무)를 다르게 골라야 하기 때문이다. */
function quasiIdentifierFields(fields: FormField[]): Array<{ id: string; type: string }> {
  return fields
    .filter((f) => !f.anonymous && !MASKED_FIELD_TYPES.has(f.type))
    .map((f) => ({ id: f.id, type: f.type }));
}

export interface MaskableItem {
  submissionId: string;
  campaignId?: string;
  data: Record<string, unknown>;
}

/**
 * 제출 목록을 마스킹 규칙에 따라 가공한다. `shouldMaskForm`이 false면 원본을 그대로
 * 돌려준다 — 이 함수는 판정을 다시 하지 않고 호출부의 판정을 신뢰한다(호출부에서
 * 이미 registry를 갖고 있어 중복 조회를 피하기 위함).
 *
 * k=1 판정은 **회차 단위로 스코프**된다(2단계 익명성 임계값과 같은 원칙) — 회차마다
 * 인원 구성이 다르므로, 회차를 섞어서 세면 실제로는 유일한 조합이 희석되어 가려져야
 * 할 레코드가 노출될 수 있다.
 */
export async function maskSubmissionList(
  formId: string,
  fields: FormField[],
  items: MaskableItem[]
): Promise<MaskableItem[]> {
  if (items.length === 0) return items;

  // 1) 필드 단위 마스킹 — 항상 적용.
  const fieldMasked = items.map((it) => ({
    ...it,
    data: Object.fromEntries(
      Object.entries(it.data).map(([fieldId, value]) => {
        const field = fields.find((f) => f.id === fieldId);
        return field && MASKED_FIELD_TYPES.has(field.type) ? [fieldId, FIELD_REDACTED] : [fieldId, value];
      })
    ),
  }));

  // 2) k=1 레코드 마스킹 — 준식별자가 없으면(전부 마스킹/익명 대상이면) 판정할 것이 없다.
  const quasiFields = quasiIdentifierFields(fields);
  const quasiIds = quasiFields.map((f) => f.id);
  if (quasiIds.length === 0) return fieldMasked;

  const byCampaign = new Map<string | undefined, MaskableItem[]>();
  for (const it of fieldMasked) {
    const key = it.campaignId;
    if (!byCampaign.has(key)) byCampaign.set(key, []);
    byCampaign.get(key)!.push(it);
  }

  const result: MaskableItem[] = [];
  for (const [campaignId, group] of byCampaign) {
    const combos = await countQuasiIdentifierCombinations(formId, campaignId, quasiFields);
    const uniqueKeys = new Set(
      combos
        .filter((c) => c.count === 1)
        .map((c) => JSON.stringify(quasiIds.map((id) => c.key[id] ?? null)))
    );

    for (const it of group) {
      const myKey = JSON.stringify(quasiIds.map((id) => it.data[id] ?? null));
      if (uniqueKeys.has(myKey)) {
        result.push({
          ...it,
          data: Object.fromEntries(Object.keys(it.data).map((k) => [k, RECORD_REDACTED])),
        });
      } else {
        result.push(it);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 조합 위험 — 설계 시점 경고 + 응답 축적 후 사후 진단
// ---------------------------------------------------------------------------

/**
 * 설계 시점 휴리스틱. 아직 응답이 없으므로 실제 k=1을 계산할 수 없어, 대신
 * "노출되는 준식별자 후보가 2개 이상이면 조합 위험이 있다"는 보수적인 신호만 준다.
 * 정밀한 판정은 diagnoseCombinationRisk(응답 축적 후)가 담당한다.
 */
export function hasCombinationRisk(fields: FormField[]): boolean {
  return quasiIdentifierFields(fields).length >= 2;
}

export interface CombinationRiskDiagnosis {
  totalRecords: number;
  uniqueRecords: number;
  quasiFieldLabels: string[];
}

/**
 * 응답이 쌓인 뒤의 사후 진단 — 익명성 게이트(2단계)와 같은 k=1 판정 로직
 * (countQuasiIdentifierCombinations)을 그대로 재사용한다. 새 계산식을 또 만들지 않고
 * "얼마나 많은 레코드가 실제로 유일한 조합인가"만 집계해 알려준다.
 */
export async function diagnoseCombinationRisk(
  formId: string,
  campaignId: string | undefined,
  fields: FormField[]
): Promise<CombinationRiskDiagnosis> {
  const quasiFields = quasiIdentifierFields(fields);
  if (quasiFields.length === 0) {
    return { totalRecords: 0, uniqueRecords: 0, quasiFieldLabels: [] };
  }

  const combos = await countQuasiIdentifierCombinations(formId, campaignId, quasiFields);
  const totalRecords = combos.reduce((sum, c) => sum + c.count, 0);
  const uniqueRecords = combos.filter((c) => c.count === 1).length;
  const quasiFieldLabels = quasiFields.map((f) => f.id).map((id) => fields.find((f) => f.id === id)?.label ?? id);

  return { totalRecords, uniqueRecords, quasiFieldLabels };
}

/** 단건 편의 함수 — 상세 조회 화면 등에서 쓴다. */
export async function maskSubmissionOne(
  formId: string,
  fields: FormField[],
  item: MaskableItem
): Promise<MaskableItem> {
  const [masked] = await maskSubmissionList(formId, fields, [item]);
  return masked;
}

/** 마스킹 표기 상수 — 화면이 "이 셀은 가려졌다"를 판정할 때 쓴다. */
export const MASK_MARKERS = { field: FIELD_REDACTED, record: RECORD_REDACTED };
