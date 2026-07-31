import { prisma } from '@/lib/db';
import type { EndpointMode } from '@/generated/prisma/client';

/**
 * 외부 연결 목록 (docs/주소입력-지도분포-설계.md §3).
 *
 * 이 플랫폼이 외부로 나가는 모든 목적지를 한 곳에서 관리·노출한다. 폐쇄망 반입 시
 * 방화벽 허용 목록을 여기서 그대로 뽑을 수 있어야 하므로, **화면에 보이는 값이 곧 실제
 * 호출 대상**이어야 한다 — 그래서 목적지를 코드가 아니라 DB에 둔다.
 */

export const ENDPOINT_IDS = {
  ADDRESS_SEARCH: 'address-search',
  GEOCODING: 'geocoding',
  MAP_TILES: 'map-tiles',
} as const;

/**
 * 최초 1회 생성되는 기본 항목. 값 자체가 "이 시스템은 이런 외부 연결을 쓸 수 있다"는
 * 목록이므로, 미설정(DISABLED) 상태로라도 행이 존재해야 관리자가 인지할 수 있다.
 */
const DEFAULTS: Array<{
  id: string;
  label: string;
  mode: EndpointMode;
  scheme?: string;
  host?: string;
  port?: number;
  pathTemplate?: string;
  note?: string;
}> = [
  {
    id: ENDPOINT_IDS.ADDRESS_SEARCH,
    label: '주소 검색 (우편번호)',
    mode: 'EXTERNAL',
    scheme: 'https',
    host: 't1.daumcdn.net',
    port: 443,
    note: '카카오(다음) 우편번호 서비스. API 키 불필요. 응답자가 입력한 검색어가 이 목적지로 전송된다.',
  },
  {
    id: ENDPOINT_IDS.GEOCODING,
    label: '지오코딩 (주소 → 좌표)',
    mode: 'DISABLED',
    note: '미설정 시 지도 화면은 행정구역 집계만 제공한다(핀/클러스터 비활성). 키 발급 후 설정하면 지도가 열린다.',
  },
  {
    id: ENDPOINT_IDS.MAP_TILES,
    label: '지도 타일 이미지',
    mode: 'EXTERNAL',
    scheme: 'https',
    host: 'tile.openstreetmap.org',
    port: 443,
    pathTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    note: '공개 OSM 타일은 이용 정책상 대량 트래픽에 적합하지 않다. 운영 규모가 커지면 별도 타일 제공자로 교체할 것.',
  },
];

export interface EndpointView {
  id: string;
  label: string;
  mode: EndpointMode;
  scheme: string | null;
  host: string | null;
  port: number | null;
  pathTemplate: string | null;
  /** 키 원문은 절대 내려보내지 않는다 — 설정 여부만 알린다. */
  hasApiKey: boolean;
  dataAsOf: string | null;
  lastCheckedAt: string | null;
  lastCheckOk: boolean | null;
  note: string | null;
}

function toView(e: {
  id: string;
  label: string;
  mode: EndpointMode;
  scheme: string | null;
  host: string | null;
  port: number | null;
  pathTemplate: string | null;
  apiKey: string | null;
  dataAsOf: Date | null;
  lastCheckedAt: Date | null;
  lastCheckOk: boolean | null;
  note: string | null;
}): EndpointView {
  return {
    id: e.id,
    label: e.label,
    mode: e.mode,
    scheme: e.scheme,
    host: e.host,
    port: e.port,
    pathTemplate: e.pathTemplate,
    hasApiKey: !!e.apiKey,
    dataAsOf: e.dataAsOf?.toISOString() ?? null,
    lastCheckedAt: e.lastCheckedAt?.toISOString() ?? null,
    lastCheckOk: e.lastCheckOk,
    note: e.note,
  };
}

/** 기본 항목을 보장하고 전체 목록을 돌려준다. */
export async function listEndpoints(): Promise<EndpointView[]> {
  for (const d of DEFAULTS) {
    await prisma.externalEndpointConfig.upsert({
      where: { id: d.id },
      update: {}, // 이미 있으면 관리자가 설정한 값을 덮지 않는다
      create: d,
    });
  }
  const rows = await prisma.externalEndpointConfig.findMany({ orderBy: { id: 'asc' } });
  return rows.map(toView);
}

export async function getEndpoint(id: string) {
  return prisma.externalEndpointConfig.findUnique({ where: { id } });
}

export interface UpdateEndpointInput {
  mode?: EndpointMode;
  scheme?: string | null;
  host?: string | null;
  port?: number | null;
  pathTemplate?: string | null;
  /** undefined면 기존 키 유지, 빈 문자열이면 삭제. */
  apiKey?: string;
  note?: string | null;
}

export async function updateEndpoint(id: string, input: UpdateEndpointInput): Promise<EndpointView> {
  const row = await prisma.externalEndpointConfig.update({
    where: { id },
    data: {
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.scheme !== undefined ? { scheme: input.scheme } : {}),
      ...(input.host !== undefined ? { host: input.host } : {}),
      ...(input.port !== undefined ? { port: input.port } : {}),
      ...(input.pathTemplate !== undefined ? { pathTemplate: input.pathTemplate } : {}),
      ...(input.apiKey !== undefined ? { apiKey: input.apiKey === '' ? null : input.apiKey } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  });
  return toView(row);
}

/**
 * 연결 확인 — 목적지에 실제로 닿는지만 본다(응답 내용은 판정하지 않는다).
 * 방화벽이 열려 있는지 확인하는 것이 목적이므로, 4xx가 와도 "연결은 됐다"로 본다.
 */
export async function testEndpoint(id: string): Promise<{ ok: boolean; message: string }> {
  const e = await prisma.externalEndpointConfig.findUnique({ where: { id } });
  if (!e) return { ok: false, message: '설정을 찾을 수 없습니다.' };
  if (e.mode !== 'EXTERNAL') {
    return { ok: false, message: '외부(EXTERNAL) 모드일 때만 연결을 확인할 수 있습니다.' };
  }
  if (!e.host) return { ok: false, message: '호스트가 설정되지 않았습니다.' };

  const url = `${e.scheme || 'https'}://${e.host}${e.port && e.port !== 443 && e.port !== 80 ? `:${e.port}` : ''}/`;
  let ok = false;
  let message = '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    ok = true; // 응답 코드와 무관하게 "닿았다"는 사실이 중요하다
    message = `연결 성공 (HTTP ${res.status})`;
  } catch (err) {
    ok = false;
    message = `연결 실패: ${err instanceof Error ? err.message : String(err)}`;
  }

  await prisma.externalEndpointConfig.update({
    where: { id },
    data: { lastCheckedAt: new Date(), lastCheckOk: ok },
  });
  return { ok, message };
}

/** 지도 화면이 쓰는 타일 URL 템플릿. 미설정/비활성이면 null. */
export async function getMapTileTemplate(): Promise<string | null> {
  const e = await prisma.externalEndpointConfig.findUnique({ where: { id: ENDPOINT_IDS.MAP_TILES } });
  if (!e || e.mode === 'DISABLED') return null;
  return e.pathTemplate ?? null;
}

/** 지오코딩이 사용 가능한지 — 미설정은 오류가 아니라 정상 상태다(§2-5). */
export async function isGeocodingEnabled(): Promise<boolean> {
  const e = await prisma.externalEndpointConfig.findUnique({ where: { id: ENDPOINT_IDS.GEOCODING } });
  return !!e && e.mode === 'EXTERNAL' && !!e.host;
}
