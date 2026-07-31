import { getFormTemplate, listSubmissions as esListSubmissions } from '@/lib/elasticsearch';
import { prisma } from '@/lib/db';
import { shouldMaskForm } from './maskingService';
import { coerceAddressValue } from '@/lib/addressValue';
import { isGeocodingEnabled, getMapTileTemplate } from './externalEndpointService';

/**
 * 주소 분포 집계 (docs/주소입력-지도분포-설계.md §4).
 *
 * 지도는 이 플랫폼에서 가장 강한 재식별 경로다 — 핀 하나가 곧 한 가구를 가리킨다.
 * 따라서 워드클라우드·품질 대시보드와 **같은 안전장치를 더 강하게** 적용한다:
 *
 *  - 마스킹 대상 양식지는 전면 제외 (주소 원문을 좌표로 바꿔 표시하는 것은 마스킹 우회다)
 *  - 익명·개인식별자 태그 문항 제외
 *  - 제작자가 `addressOptions.mapEnabled`를 명시적으로 켠 문항만 대상
 *  - **k 미만 지역은 결과에서 제거**하고, 몇 건이 가려졌는지만 알린다
 */

const SCAN_PAGE_SIZE = 200;
const SCAN_HARD_CAP = 3000;

export interface RegionBucket {
  /** 시·도 또는 시·군·구 이름 */
  name: string;
  /** 법정동코드 앞자리 — 상위 구역 키 */
  code: string;
  count: number;
}

export interface AddressMapResult {
  fieldId: string;
  label: string;
  totalWithAddress: number;
  /** k 게이트를 통과한 지역 분포 (내림차순) */
  regions: RegionBucket[];
  /** k 미만이라 표시하지 못한 지역 수와 그 합계 건수 */
  suppressedRegions: number;
  suppressedCount: number;
  /** 표시 기준 k */
  threshold: number;
  /** 지오코딩 미설정이면 false — 핀/클러스터 대신 지역 집계만 제공한다(§2-5) */
  geocodingEnabled: boolean;
  /** 지도 타일 URL 템플릿. null이면 배경 지도 없이 목록만 표시 */
  tileTemplate: string | null;
}

export interface MapEligibleField {
  fieldId: string;
  label: string;
}

/** 이 양식지에서 지도 분석이 허용된 주소 문항 목록. */
export async function listMapEligibleFields(formId: string): Promise<MapEligibleField[]> {
  const [template, registry] = await Promise.all([
    getFormTemplate(formId),
    prisma.formRegistry.findUnique({
      where: { id: formId },
      select: { authorHadPrivacyAuth: true, maskingExemptedAt: true },
    }),
  ]);
  if (!template || !registry) return [];
  // 마스킹 대상 양식지는 주소 원문을 집계하지 않는다 — 워드클라우드와 같은 원칙.
  if (shouldMaskForm(registry)) return [];

  return template.fields
    .filter(
      (f) =>
        f.type === 'map-address' &&
        !f.anonymous &&
        !f.personalIdentifier &&
        f.addressOptions?.mapEnabled === true
    )
    .map((f) => ({ fieldId: f.id, label: f.label }));
}

async function resolveThreshold(formId: string): Promise<number> {
  const [registry, config] = await Promise.all([
    prisma.formRegistry.findUnique({ where: { id: formId }, select: { anonymityThreshold: true } }),
    prisma.systemConfig.findUnique({ where: { id: 'default' } }),
  ]);
  return registry?.anonymityThreshold ?? config?.defaultAnonymityThreshold ?? 5;
}

/**
 * 지역 분포를 집계한다.
 * @param level 'sido' = 시·도 단위, 'sigungu' = 시·군·구 단위
 */
export async function analyzeAddressDistribution(
  formId: string,
  fieldId: string,
  level: 'sido' | 'sigungu' = 'sido'
): Promise<AddressMapResult | null> {
  const eligible = await listMapEligibleFields(formId);
  const target = eligible.find((f) => f.fieldId === fieldId);
  if (!target) return null;

  const threshold = await resolveThreshold(formId);

  // 전체 스캔 — 지역 집계는 값 자체가 아니라 개수만 쓰므로 원문을 밖으로 내보내지 않는다.
  const counts = new Map<string, { name: string; code: string; count: number }>();
  let totalWithAddress = 0;
  let page = 1;
  let collected = 0;

  while (collected < SCAN_HARD_CAP) {
    const result = await esListSubmissions({ formId, page, pageSize: SCAN_PAGE_SIZE });
    for (const item of result.items) {
      const addr = coerceAddressValue(item.data[fieldId]);
      if (!addr) continue;
      // bcode가 없으면(구조화 이전 문자열 응답) 집계 대상에서 제외한다 — 문자열을 억지로
      // 파싱해 잘못된 지역으로 넣느니 "집계 불가"로 두는 편이 안전하다(§coerceAddressValue).
      if (!addr.bcode || !addr.sido) continue;
      totalWithAddress += 1;

      const code = level === 'sido' ? addr.bcode.slice(0, 2) : addr.bcode.slice(0, 5);
      const name = level === 'sido' ? addr.sido : `${addr.sido} ${addr.sigungu ?? ''}`.trim();
      const cur = counts.get(code) ?? { name, code, count: 0 };
      cur.count += 1;
      counts.set(code, cur);
    }
    collected += result.items.length;
    if (result.items.length < SCAN_PAGE_SIZE || collected >= result.total) break;
    page += 1;
  }

  const all = [...counts.values()];
  const passed = all.filter((r) => r.count >= threshold).sort((a, b) => b.count - a.count);
  const suppressed = all.filter((r) => r.count < threshold);

  const [geocodingEnabled, tileTemplate] = await Promise.all([isGeocodingEnabled(), getMapTileTemplate()]);

  return {
    fieldId,
    label: target.label,
    totalWithAddress,
    regions: passed,
    suppressedRegions: suppressed.length,
    suppressedCount: suppressed.reduce((s, r) => s + r.count, 0),
    threshold,
    geocodingEnabled,
    tileTemplate,
  };
}
