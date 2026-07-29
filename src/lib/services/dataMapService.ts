import { prisma } from '@/lib/db';

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

export type DataMapCluster = 'identity' | 'form' | 'response' | 'reward' | 'audit';

export interface DataMapNode {
  id: string;
  label: string;
  cluster: DataMapCluster;
  /** 이 모델을 설명하는 한 줄 — 비개발자 관리자도 이해할 수 있도록 실무 용어로 쓴다. */
  description: string;
  /** prisma 클라이언트 접근자 — 실시간 카운트 조회에 쓴다. */
  countKey: keyof typeof prisma;
}

export interface DataMapEdge {
  /** FK를 들고 있는 쪽(N) → 참조당하는 쪽(1) */
  from: string;
  to: string;
  /** FK 컬럼명 — 관계의 실제 근거. */
  field: string;
  cardinality: 'N:1' | '1:1';
  optional: boolean;
}

export const DATA_MAP_NODES: DataMapNode[] = [
  { id: 'User', label: '임직원 (User)', cluster: 'identity', description: 'LDAP/로컬 계정 — 모든 관계의 출발점', countKey: 'user' },
  { id: 'UserRole', label: '역할 (UserRole)', cluster: 'identity', description: 'MEMBER/AUTHOR/PLATFORM_ADMIN — 전역 또는 특정 양식 위임', countKey: 'userRole' },
  { id: 'AuthorAuthorization', label: '개인정보 취급자 자격', cluster: 'identity', description: '역할과 별개의 심사 절차 — 신청/승인/해제', countKey: 'authorAuthorization' },
  { id: 'LdapConfig', label: 'LDAP 연동 설정', cluster: 'identity', description: '임직원 계정 동기화 출처', countKey: 'ldapConfig' },

  { id: 'FormRegistry', label: '양식지 (FormRegistry)', cluster: 'form', description: '양식 메타데이터 — 필드 구성 자체는 Elasticsearch', countKey: 'formRegistry' },
  { id: 'Campaign', label: '회차 (Campaign)', cluster: 'form', description: '한 양식지의 반복 수집 단위(배포 회차)', countKey: 'campaign' },
  { id: 'FormApprovalRequest', label: '배포 승인 요청', cluster: 'form', description: '전사 배포 등 배포 범위 확대 승인', countKey: 'formApprovalRequest' },
  { id: 'CampaignSchedule', label: '발송 일정', cluster: 'form', description: '회차 자동 생성/발송 스케줄', countKey: 'campaignSchedule' },
  { id: 'ApiKey', label: 'API 키', cluster: 'form', description: '외부 연동(v1 API) 접근 키', countKey: 'apiKey' },
  { id: 'ShareRequest', label: '공유 신청', cluster: 'form', description: '양식지 데이터 접근 공유 요청/승인', countKey: 'shareRequest' },

  { id: 'CampaignTarget', label: '발송 대상', cluster: 'response', description: '이번 회차에 응답을 요청받은 사람', countKey: 'campaignTarget' },
  { id: 'CampaignParticipation', label: '참여 이력', cluster: 'response', description: '실제로 응답을 제출한 이력 (1인 1응답 판정 근거)', countKey: 'campaignParticipation' },
  { id: 'RespondentToken', label: '응답자 토큰', cluster: 'response', description: '식별 응답용 개인화 링크', countKey: 'respondentToken' },
  { id: 'AnonymousResponseBuffer', label: '익명 응답 버퍼', cluster: 'response', description: '익명 문항의 분리 저장·셔플 대기열', countKey: 'anonymousResponseBuffer' },

  { id: 'PointLedger', label: '포인트 원장', cluster: 'reward', description: 'append-only 적립/차감 기록', countKey: 'pointLedger' },
  { id: 'SystemConfig', label: '시스템 환경 설정', cluster: 'reward', description: '보상 노출 범위 등 전역 스위치 (싱글턴)', countKey: 'systemConfig' },

  { id: 'AuditLog', label: '감사 로그', cluster: 'audit', description: '권한·개인정보 관련 조작 이력', countKey: 'auditLog' },
  { id: 'AdminNotification', label: '관리자 알림', cluster: 'audit', description: '조치 필요 이벤트 알림함', countKey: 'adminNotification' },
  { id: 'DatabaseRegistration', label: 'DB제작자 등록', cluster: 'audit', description: '저작권법상 데이터베이스제작자 등록', countKey: 'databaseRegistration' },
  { id: 'DatabaseUpdateLog', label: 'DB 갱신 이력', cluster: 'audit', description: '데이터베이스제작자 등록의 갱신 로그', countKey: 'databaseUpdateLog' },
];

export const DATA_MAP_EDGES: DataMapEdge[] = [
  { from: 'UserRole', to: 'User', field: 'userId', cardinality: 'N:1', optional: false },
  { from: 'UserRole', to: 'FormRegistry', field: 'scopeFormId', cardinality: 'N:1', optional: true },
  { from: 'FormRegistry', to: 'User', field: 'ownerId', cardinality: 'N:1', optional: true },
  { from: 'Campaign', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: false },
  { from: 'FormApprovalRequest', to: 'Campaign', field: 'campaignId', cardinality: '1:1', optional: false },
  { from: 'CampaignSchedule', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: false },
  { from: 'CampaignTarget', to: 'Campaign', field: 'campaignId', cardinality: 'N:1', optional: false },
  { from: 'CampaignTarget', to: 'User', field: 'userId', cardinality: 'N:1', optional: false },
  { from: 'PointLedger', to: 'User', field: 'userId', cardinality: 'N:1', optional: false },
  { from: 'CampaignParticipation', to: 'Campaign', field: 'campaignId', cardinality: 'N:1', optional: false },
  { from: 'CampaignParticipation', to: 'User', field: 'userId', cardinality: 'N:1', optional: false },
  { from: 'RespondentToken', to: 'User', field: 'userId', cardinality: 'N:1', optional: false },
  { from: 'RespondentToken', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: false },
  { from: 'AnonymousResponseBuffer', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: false },
  { from: 'AnonymousResponseBuffer', to: 'Campaign', field: 'campaignId', cardinality: 'N:1', optional: true },
  { from: 'ApiKey', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: false },
  { from: 'AuditLog', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: true },
  { from: 'AdminNotification', to: 'User', field: 'userId', cardinality: 'N:1', optional: false },
  { from: 'AdminNotification', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: true },
  { from: 'AuthorAuthorization', to: 'User', field: 'userId', cardinality: '1:1', optional: false },
  { from: 'ShareRequest', to: 'FormRegistry', field: 'formId', cardinality: 'N:1', optional: false },
  { from: 'ShareRequest', to: 'User', field: 'fromUserId', cardinality: 'N:1', optional: false },
  { from: 'ShareRequest', to: 'User', field: 'toUserId', cardinality: 'N:1', optional: false },
  { from: 'DatabaseUpdateLog', to: 'DatabaseRegistration', field: 'registrationId', cardinality: 'N:1', optional: false },
];

export interface DataMapNodeWithCount extends DataMapNode {
  count: number;
}

export async function getDataMap(): Promise<{ nodes: DataMapNodeWithCount[]; edges: DataMapEdge[] }> {
  const counts = await Promise.all(
    DATA_MAP_NODES.map((n) => {
      const model = prisma[n.countKey] as unknown as { count: () => Promise<number> };
      return model.count();
    })
  );

  const nodes = DATA_MAP_NODES.map((n, i) => ({ ...n, count: counts[i] }));
  return { nodes, edges: DATA_MAP_EDGES };
}
