import { prisma } from '@/lib/db';
import { getIndexDocCounts, getFormTemplate, listFormTemplates } from '@/lib/elasticsearch';

/**
 * 데이터 구조 관계도(ERD 마인드맵) — 슈퍼관리자가 실제 수집·저장 중인 데이터가
 * 어떻게 서로 연결되는지 한눈에 보기 위한 화면의 데이터 소스.
 *
 * 노드·엣지는 prisma/schema.prisma의 실제 @relation을 그대로 옮긴 것이다 — 이 파일과
 * 스키마가 어긋나면 없는 관계를 있는 것처럼 보여주게 되므로, 스키마에 모델/관계를
 * 추가·삭제할 때 반드시 함께 갱신할 것 (seed.ts가 SUBMISSION_MAPPING을 사본으로
 * 유지하는 것과 같은 이유).
 *
 * 집계(카운트)는 화면을 열 때마다 실시간으로 구해 붙인다 — 구조는 정적이지만
 * "지금 데이터가 실제로 얼마나 쌓여 있는가"는 정적일 수 없기 때문이다.
 */

export type DataMapCluster = 'identity' | 'form' | 'response' | 'reward' | 'audit' | 'unstructured';
/** 정형(PostgreSQL) vs 비정형(Elasticsearch) — 화면에서 색상·테두리로 구분해서 보여준다. */
export type DataStore = 'postgres' | 'elasticsearch';

export interface DataMapNode {
  id: string;
  label: string;
  cluster: DataMapCluster;
  store: DataStore;
  /** 이 모델을 설명하는 한 줄 — 비개발자 관리자도 이해할 수 있도록 실무 용어로 쓴다. */
  description: string;
  /** prisma 클라이언트 접근자 — 실시간 카운트 조회에 쓴다. postgres 노드에만 있다. */
  countKey?: keyof typeof prisma;
}

export interface DataMapEdge {
  /** FK를 들고 있는 쪽(N) → 참조당하는 쪽(1) */
  from: string;
  to: string;
  /** FK 컬럼명 — 관계의 실제 근거. */
  field: string;
  cardinality: 'N:1' | '1:1';
  optional: boolean;
  /**
   * 'fk' — 같은 저장소(Postgres) 안의 실제 외래키 제약.
   * 'shared-key' — Postgres와 Elasticsearch처럼 서로 다른 저장소를 formId 같은 공유 값으로만
   * 잇는 논리적 연결. DB 레벨의 참조 무결성이 없다 — 화면에서 점선으로 구분해 보여준다.
   */
  linkType: 'fk' | 'shared-key';
}

export const DATA_MAP_NODES: DataMapNode[] = [
  { id: 'User', label: '임직원 (User)', cluster: 'identity', store: 'postgres', description: 'LDAP/로컬 계정 — 모든 관계의 출발점', countKey: 'user' },
  { id: 'UserRole', label: '역할 (UserRole)', cluster: 'identity', store: 'postgres', description: 'MEMBER/AUTHOR/PLATFORM_ADMIN — 전역 또는 특정 양식 위임', countKey: 'userRole' },
  { id: 'AuthorAuthorization', label: '개인정보 취급자 자격', cluster: 'identity', store: 'postgres', description: '역할과 별개의 심사 절차 — 신청/승인/해제', countKey: 'authorAuthorization' },
  { id: 'LdapConfig', label: 'LDAP 연동 설정', cluster: 'identity', store: 'postgres', description: '임직원 계정 동기화 출처', countKey: 'ldapConfig' },

  { id: 'FormRegistry', label: '양식지 (FormRegistry)', cluster: 'form', store: 'postgres', description: '양식 운영 메타데이터(상태·소유자·URL) — 필드 구성 자체는 Elasticsearch', countKey: 'formRegistry' },
  { id: 'Campaign', label: '회차 (Campaign)', cluster: 'form', store: 'postgres', description: '한 양식지의 반복 수집 단위(배포 회차)', countKey: 'campaign' },
  { id: 'FormApprovalRequest', label: '배포 승인 요청', cluster: 'form', store: 'postgres', description: '전사 배포 등 배포 범위 확대 승인', countKey: 'formApprovalRequest' },
  { id: 'CampaignSchedule', label: '발송 일정', cluster: 'form', store: 'postgres', description: '회차 자동 생성/발송 스케줄', countKey: 'campaignSchedule' },
  { id: 'ApiKey', label: 'API 키', cluster: 'form', store: 'postgres', description: '외부 연동(v1 API) 접근 키', countKey: 'apiKey' },
  { id: 'ShareRequest', label: '공유 신청', cluster: 'form', store: 'postgres', description: '양식지 데이터 접근 공유 요청/승인', countKey: 'shareRequest' },

  { id: 'CampaignTarget', label: '발송 대상', cluster: 'response', store: 'postgres', description: '이번 회차에 응답을 요청받은 사람', countKey: 'campaignTarget' },
  { id: 'CampaignParticipation', label: '참여 이력', cluster: 'response', store: 'postgres', description: '실제로 응답을 제출한 이력 (1인 1응답 판정 근거)', countKey: 'campaignParticipation' },
  { id: 'RespondentToken', label: '응답자 토큰', cluster: 'response', store: 'postgres', description: '식별 응답용 개인화 링크', countKey: 'respondentToken' },
  { id: 'AnonymousResponseBuffer', label: '익명 응답 버퍼', cluster: 'response', store: 'postgres', description: '익명 문항의 분리 저장·셔플 대기열 — 임계값(k)이 차면 Elasticsearch 익명 인덱스로 넘어간다', countKey: 'anonymousResponseBuffer' },

  { id: 'PointLedger', label: '포인트 원장', cluster: 'reward', store: 'postgres', description: 'append-only 적립/차감 기록', countKey: 'pointLedger' },
  { id: 'SystemConfig', label: '시스템 환경 설정', cluster: 'reward', store: 'postgres', description: '보상 노출 범위 등 전역 스위치 (싱글턴)', countKey: 'systemConfig' },

  { id: 'AuditLog', label: '감사 로그', cluster: 'audit', store: 'postgres', description: '권한·개인정보 관련 조작 이력', countKey: 'auditLog' },
  { id: 'AdminNotification', label: '관리자 알림', cluster: 'audit', store: 'postgres', description: '조치 필요 이벤트 알림함', countKey: 'adminNotification' },
  { id: 'DatabaseRegistration', label: 'DB제작자 등록', cluster: 'audit', store: 'postgres', description: '저작권법상 데이터베이스제작자 등록', countKey: 'databaseRegistration' },
  { id: 'DatabaseUpdateLog', label: 'DB 갱신 이력', cluster: 'audit', store: 'postgres', description: '데이터베이스제작자 등록의 갱신 로그', countKey: 'databaseUpdateLog' },

  // 비정형(Elasticsearch) — 폼마다 필드 구성이 다르고 계속 늘어나서 고정 스키마로 못 다루는
  // 부분. Postgres 쪽처럼 prisma.count()가 없어 카운트는 별도 ES _count API로 구한다
  // (getIndexDocCounts). FormRegistry.id를 공유 키로만 잇는다 — DB 레벨 FK가 아니다.
  { id: 'FormTemplate', label: '양식 필드 구성 (ES)', cluster: 'unstructured', store: 'elasticsearch', description: '문항 배열(23종 컴포넌트) — 폼마다 필드 개수·타입이 달라 동적 매핑' },
  { id: 'Submission', label: '제출 데이터 (ES)', cluster: 'unstructured', store: 'elasticsearch', description: '식별 응답 문서 — data.{fieldId} 키가 그 폼의 필드 구성을 그대로 따라간다' },
  { id: 'AnonSubmission', label: '익명 제출 데이터 (ES)', cluster: 'unstructured', store: 'elasticsearch', description: '셔플되어 응답자와 분리 저장된 익명 문항 값 — respondentId가 아예 없다' },
];

export const DATA_MAP_EDGES: DataMapEdge[] = [
  { from: 'UserRole', to: 'User', field: 'userId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'UserRole', to: 'FormRegistry', field: 'scopeFormId', cardinality: 'N:1', optional: true, linkType: 'fk' },
  { from: 'FormRegistry', to: 'User', field: 'ownerId', cardinality: 'N:1', optional: true, linkType: 'fk' },
  { from: 'Campaign', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'FormApprovalRequest', to: 'Campaign', field: 'campaignId', cardinality: '1:1', optional: false, linkType: 'fk' },
  { from: 'CampaignSchedule', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'CampaignTarget', to: 'Campaign', field: 'campaignId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'CampaignTarget', to: 'User', field: 'userId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'PointLedger', to: 'User', field: 'userId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'CampaignParticipation', to: 'Campaign', field: 'campaignId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'CampaignParticipation', to: 'User', field: 'userId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'RespondentToken', to: 'User', field: 'userId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'RespondentToken', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'AnonymousResponseBuffer', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'AnonymousResponseBuffer', to: 'Campaign', field: 'campaignId', cardinality: 'N:1', optional: true, linkType: 'fk' },
  { from: 'ApiKey', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'AuditLog', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: true, linkType: 'fk' },
  { from: 'AdminNotification', to: 'User', field: 'userId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'AdminNotification', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: true, linkType: 'fk' },
  { from: 'AuthorAuthorization', to: 'User', field: 'userId', cardinality: '1:1', optional: false, linkType: 'fk' },
  { from: 'ShareRequest', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'ShareRequest', to: 'User', field: 'fromUserId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'ShareRequest', to: 'User', field: 'toUserId', cardinality: 'N:1', optional: false, linkType: 'fk' },
  { from: 'DatabaseUpdateLog', to: 'DatabaseRegistration', field: 'registrationId', cardinality: 'N:1', optional: false, linkType: 'fk' },

  // 정형 ↔ 비정형 — 저장소가 달라 실제 FK가 아니라 formId 문자열이 양쪽에 같은 값으로
  // 들어 있을 뿐이다(공유 키). ES 쪽에는 참조 무결성이 없어 formId가 지워져도 문서가
  // 고아로 남을 수 있다는 게 postgres FK와의 실질적 차이다.
  { from: 'FormTemplate', to: 'FormRegistry', field: 'formId (공유 키)', cardinality: '1:1', optional: false, linkType: 'shared-key' },
  { from: 'Submission', to: 'FormRegistry', field: 'formId (공유 키)', cardinality: 'N:1', optional: false, linkType: 'shared-key' },
  { from: 'Submission', to: 'Campaign', field: 'campaignId (공유 키)', cardinality: 'N:1', optional: true, linkType: 'shared-key' },
  { from: 'AnonSubmission', to: 'FormRegistry', field: 'formId (공유 키)', cardinality: 'N:1', optional: false, linkType: 'shared-key' },
];

export interface DataMapNodeWithCount extends DataMapNode {
  count: number;
}

export async function getDataMap(): Promise<{ nodes: DataMapNodeWithCount[]; edges: DataMapEdge[] }> {
  const [postgresCounts, esCounts] = await Promise.all([
    Promise.all(
      DATA_MAP_NODES.filter((n) => n.store === 'postgres').map(async (n) => {
        const model = prisma[n.countKey!] as unknown as { count: () => Promise<number> };
        return [n.id, await model.count()] as const;
      })
    ),
    getIndexDocCounts(),
  ]);

  const countById = new Map<string, number>(postgresCounts);
  countById.set('FormTemplate', esCounts.formTemplates);
  countById.set('Submission', esCounts.submissions);
  countById.set('AnonSubmission', esCounts.anonSubmissions);

  const nodes = DATA_MAP_NODES.map((n) => ({ ...n, count: countById.get(n.id) ?? 0 }));
  return { nodes, edges: DATA_MAP_EDGES };
}

/**
 * 양식지 필드 구성이 실제로 어떻게 컬럼/키/값으로 이어지는지 정교하게 보여주기 위한 예시.
 * 실제 응답 값(개인정보일 수 있음)을 노출하지 않기 위해, 구조만 자리표시자 값으로 보여준다.
 * f-999(종합 컴포넌트 테스트 양식지)가 있으면 그것을, 없으면 첫 번째 양식지를 예시로 쓴다 —
 * 문항 타입이 다양할수록 데이터 구조를 설명하기 좋아서다.
 */
export interface SchemaExampleField {
  id: string;
  type: string;
  label: string;
  /** Elasticsearch 문서 안에서 이 필드 값이 저장되는 실제 경로. */
  esKey: string;
  /** 동적 매핑이 자동으로 붙이는 서브필드(집계·형태소 분석용) — 있는 타입만. */
  esSubfields: string[];
}

export interface SchemaExample {
  formId: string;
  formTitle: string;
  fields: SchemaExampleField[];
  /** data 객체가 실제로 어떤 모양인지 — 값은 전부 자리표시자다. */
  sampleSubmissionData: Record<string, unknown>;
}

const FREE_TEXT_ES_TYPES = new Set(['text', 'textarea', 'regex-input']);

function placeholderValue(type: string, label: string): unknown {
  if (type === 'number') return 0;
  if (type === 'checkbox') return ['옵션1', '옵션2'];
  if (type === 'date') return '2026-01-01';
  return `(${label} 값)`;
}

export async function getDataMapSchemaExample(): Promise<SchemaExample | null> {
  let template = await getFormTemplate('f-999');
  if (!template) {
    const all = await listFormTemplates();
    template = all[0] ?? null;
  }
  if (!template) return null;

  const fields: SchemaExampleField[] = template.fields.map((f) => ({
    id: f.id,
    type: f.type,
    label: f.label,
    esKey: `data.${f.id}`,
    esSubfields: FREE_TEXT_ES_TYPES.has(f.type)
      ? ['.keyword (정확히 일치 검색·집계용)', '.nori (한국어 형태소 분석용)']
      : typeof placeholderValue(f.type, f.label) === 'string'
        ? ['.keyword (정확히 일치 검색·집계용)']
        : [],
  }));

  const sampleSubmissionData: Record<string, unknown> = {};
  for (const f of template.fields) {
    sampleSubmissionData[f.id] = placeholderValue(f.type, f.label);
  }

  return { formId: template.formId, formTitle: template.title, fields, sampleSubmissionData };
}
