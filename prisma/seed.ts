// 초기 데모 데이터 시드 스크립트.
//
// 과거 각 페이지 컴포넌트에 하드코딩되어 있던 mock 데이터를 실제 저장소(정형: Postgres,
// 비정형: Elasticsearch)로 옮겨 담아, `docker compose up` 직후에도 화면이 빈 상태가 아니라
// 예전과 동일한 데모 데이터를 볼 수 있도록 한다.
//
// 실행: npm run db:seed (docker-compose의 migrate 단계 이후 수동으로, 혹은 로컬 개발 시)
//
// 경로 별칭(@/) 없이 상대 경로 + 명시적 확장자를 쓰는 이유: 이 스크립트는
// `node --experimental-strip-types` 로 직접 실행되어 번들러 없이 타입만 제거되므로,
// tsconfig의 paths 별칭이 적용되지 않는다.

import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { SAMPLE_FORMS } from './sampleData.ts';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const es = new ElasticClient({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
  },
});

const FORM_TEMPLATES_INDEX = 'webreport-form-templates';
const SUBMISSIONS_INDEX = 'webreport-submissions';

const FORM_TEMPLATE_MAPPING = {
  properties: {
    formId: { type: 'keyword' },
    title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    description: { type: 'text' },
    fields: { type: 'object', dynamic: true },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
  },
} as const;

// NOTE: src/lib/elasticsearch.ts 의 SUBMISSION_MAPPING과 동일하게 유지할 것.
// (이 스크립트는 strip-types 직접 실행이라 @/ 경로 별칭을 쓸 수 없어 사본을 둔다.)
const SUBMISSION_MAPPING = {
  properties: {
    formId: { type: 'keyword' },
    submissionId: { type: 'keyword' },
    submittedAt: { type: 'date' },
    externalId: { type: 'keyword' },
    source: { type: 'keyword' },
    schemaVersion: { type: 'integer' },
    data: { type: 'object', dynamic: true },
  },
} as const;

async function ensureIndices() {
  for (const [index, mappings] of [
    [FORM_TEMPLATES_INDEX, FORM_TEMPLATE_MAPPING],
    [SUBMISSIONS_INDEX, SUBMISSION_MAPPING],
  ] as const) {
    const exists = await es.indices.exists({ index });
    if (!exists) await es.indices.create({ index, mappings });
  }
}

// -----------------------------------------------------------------------
// 1) 정형 데이터: 관리자 계정
// -----------------------------------------------------------------------
// 목업으로 만들어졌던 가짜 부서/담당자 계정(마케팅팀 김민수 등)은 모두 제거한다.
// 실제 운영 관리자 계정은 로그인 시(getCurrentAdmin) 자동으로 생성되며, 새로 만드는
// 양식지는 그 계정이 직접 소유하게 된다 — 지금 시드 시점에는 최고관리자 계정 하나만
// 필요하다.
const USERS: Array<{ email: string; name: string; roles: Array<'MEMBER' | 'AUTHOR' | 'PLATFORM_ADMIN'> }> = [
  {
    email: 'ralfkang@ktl.re.kr',
    name: '최고관리자',
    roles: ['PLATFORM_ADMIN', 'AUTHOR', 'MEMBER'],
  },
];


// -----------------------------------------------------------------------
// 2) 비정형 데이터: 폼 필드 구성 + 샘플 제출 데이터
// -----------------------------------------------------------------------
const FORMS: Array<{
  id: string;
  title: string;
  description: string;
  ownerEmail: string;
  status: 'OPEN' | 'CLOSED';
  fields: Array<Record<string, unknown>>;
  submissions: Array<{ submissionId: string; submittedAt: string; data: Record<string, unknown> }>;
}> = [
  {
    id: 'f-101',
    title: '2024 하반기 고객 만족도 조사',
    description: '고객 피드백 수집용 양식',
    ownerEmail: 'ralfkang@ktl.re.kr',
    status: 'OPEN',
    fields: [
      { id: 'f101-1', type: 'text', label: '고객명', required: true, nullable: false, width: '50%' },
      { id: 'f101-2', type: 'regex-input', label: '연락처', required: true, nullable: false, regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$', width: '50%' },
      { id: 'f101-3', type: 'text', label: '이용 중인 서비스', required: true, nullable: false, width: '100%' },
      { id: 'f101-4', type: 'text', label: '개선 사항 (선택)', required: false, nullable: true, width: '100%' },
    ],
    submissions: [
      { submissionId: 'SUB-001', submittedAt: '2026-07-27T10:30:00', data: { 'f101-1': '홍길동', 'f101-2': '010-1234-5678', 'f101-3': '프리미엄 요금제', 'f101-4': '속도가 조금 더 빨랐으면 좋겠습니다.' } },
      { submissionId: 'SUB-002', submittedAt: '2026-07-27T11:15:00', data: { 'f101-1': '김철수', 'f101-2': '010-9999-8888', 'f101-3': '베이직 요금제', 'f101-4': '만족합니다.' } },
      { submissionId: 'SUB-003', submittedAt: '2026-07-27T14:05:00', data: { 'f101-1': '이영희', 'f101-2': '010-5555-5555', 'f101-3': '스탠다드 요금제', 'f101-4': '결제 수단이 다양했으면 좋겠어요.' } },
      { submissionId: 'SUB-004', submittedAt: '2026-07-27T15:20:00', data: { 'f101-1': '이상치', 'f101-2': '010-111-222', 'f101-3': '미확인', 'f101-4': '연락처 오류 (수정 요망)' } },
    ],
  },
  {
    id: 'f-102',
    title: '신규 입사자 온보딩 피드백',
    description: '사내 온보딩 세션 피드백',
    ownerEmail: 'ralfkang@ktl.re.kr',
    status: 'OPEN',
    fields: [
      { id: 'f102-1', type: 'text', label: '부서명', required: true, nullable: false, width: '50%' },
      { id: 'f102-2', type: 'text', label: '입사자 성함', required: true, nullable: false, width: '50%' },
      { id: 'f102-3', type: 'text', label: '가장 유용했던 세션', required: true, nullable: false, width: '100%' },
      { id: 'f102-4', type: 'map-address', label: '근무 희망지 (옵션)', required: false, nullable: true, width: '100%' },
    ],
    submissions: [
      { submissionId: 'SUB-101', submittedAt: '2026-07-20T09:00:00', data: { 'f102-1': '개발1팀', 'f102-2': '정개발', 'f102-3': '사내 보안 정책 교육', 'f102-4': '판교 오피스' } },
      { submissionId: 'SUB-102', submittedAt: '2026-07-20T09:30:00', data: { 'f102-1': '디자인팀', 'f102-2': '박디자인', 'f102-3': '사내 문화 워크샵', 'f102-4': '강남 오피스' } },
    ],
  },
  {
    id: 'f-103',
    title: '2026년 하반기 워크샵 참가 신청서',
    description: '전사 워크샵 참석 여부 및 희망 활동 조사',
    ownerEmail: 'ralfkang@ktl.re.kr',
    status: 'OPEN',
    fields: [
      { id: 'f103-1', type: 'text', label: '부서명', required: true, nullable: false, width: '50%' },
      { id: 'f103-2', type: 'text', label: '성명', required: true, nullable: false, width: '50%' },
      { id: 'f103-3', type: 'radio', label: '참석 여부', required: true, nullable: false, width: '100%', options: ['참석', '불참'] },
      { id: 'f103-4', type: 'checkbox', label: '희망 액티비티 (선택)', required: false, nullable: true, width: '100%', options: ['등산', '볼링', '방탈출', '보드게임'] },
    ],
    submissions: [
      { submissionId: 'SUB-301', submittedAt: '2026-07-22T13:00:00', data: { 'f103-1': '총무팀', 'f103-2': '박지영', 'f103-3': '참석', 'f103-4': ['등산', '보드게임'] } },
      { submissionId: 'SUB-302', submittedAt: '2026-07-23T09:45:00', data: { 'f103-1': '개발2팀', 'f103-2': '최준호', 'f103-3': '참석', 'f103-4': ['볼링'] } },
    ],
  },
  {
    id: 'f-104',
    title: 'IT 장비 지급 요청서 (보안동의서 포함)',
    description: '노트북 및 모니터 신청',
    ownerEmail: 'ralfkang@ktl.re.kr',
    status: 'CLOSED',
    fields: [
      { id: 'f104-1', type: 'text', label: '신청자 사번', required: true, nullable: false, width: '100%' },
      { id: 'f104-2', type: 'text', label: '요청 장비 (노트북/모니터 등)', required: true, nullable: false, width: '100%' },
    ],
    submissions: [
      { submissionId: 'SUB-201', submittedAt: '2026-07-10T14:00:00', data: { 'f104-1': 'EMP-9901', 'f104-2': '맥북 프로 16인치, 4K 모니터 1대' } },
      { submissionId: 'SUB-202', submittedAt: '2026-07-11T10:15:00', data: { 'f104-1': 'EMP-9902', 'f104-2': 'LG 그램 15인치, 무선 마우스' } },
    ],
  },
  {
    id: 'f-999',
    title: '종합 컴포넌트 테스트 양식지 (f-999)',
    description: '모든 23종 컴포넌트가 포함된 대규모 테스트 폼입니다.',
    ownerEmail: 'ralfkang@ktl.re.kr',
    status: 'OPEN',
    fields: [
      { id: 'f999-1', type: 'text', label: '단답형 (이름)', required: true, nullable: false, width: '50%' },
      { id: 'f999-2', type: 'number', label: '숫자 (나이)', required: true, nullable: false, width: '50%' },
      { id: 'f999-3', type: 'regex-input', label: '연락처 (정규식)', required: true, nullable: false, regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$', width: '50%' },
      { id: 'f999-4', type: 'date', label: '방문 일자', required: false, nullable: true, width: '50%' },
      { id: 'f999-5', type: 'textarea', label: '장문형 (요청사항)', required: false, nullable: true, width: '100%' },
      { id: 'f999-6', type: 'select', label: '드롭다운 (부서)', required: true, nullable: false, width: '50%', options: ['개발팀', '디자인팀', '기획팀', '마케팅팀'] },
      { id: 'f999-7', type: 'radio', label: '단일 선택 (성별)', required: true, nullable: false, width: '50%', options: ['남성', '여성', '선택 안함'] },
      { id: 'f999-8', type: 'checkbox', label: '다중 선택 (관심사)', required: false, nullable: true, width: '100%', options: ['IT', '스포츠', '음악', '독서', '여행'] },
      { id: 'f999-9', type: 'map-address', label: '지도 및 주소', required: false, nullable: true, width: '100%' },
      { id: 'f999-10', type: 'file', label: '파일 첨부 (이력서 등)', required: false, nullable: true, width: '50%' },
      { id: 'f999-11', type: 'image', label: '단일 이미지 (프로필)', required: false, nullable: true, width: '50%' },
      { id: 'f999-12', type: 'image-gallery', label: '이미지 갤러리', required: false, nullable: true, width: '100%' },
      { id: 'f999-13', type: 'video-link', label: '동영상 링크', required: false, nullable: true, width: '100%' },
      { id: 'f999-14', type: 'table', label: '경력 테이블 (Table)', required: false, nullable: true, width: '100%' },
      { id: 'f999-15', type: 'nested-report', label: '하위 레포트 (프로젝트 상세)', required: false, nullable: true, width: '100%' },
      { id: 'f999-16', type: 'report-link', label: '관련 레포트 링크', required: false, nullable: true, width: '100%' },
      { id: 'f999-17', type: 'comment-thread', label: '댓글 코멘트 쓰레드', required: false, nullable: true, width: '100%' },
      { id: 'f999-18', type: 'slide-card', label: '슬라이드 카드 프리젠테이션', required: false, nullable: true, width: '100%' },
      { id: 'f999-19', type: 'popup-toggle', label: '안내 팝업 텍스트', required: false, nullable: true, width: '100%' },
      { id: 'f999-20', type: 'api-select', label: 'API 연동 리스트 (동적 사원검색)', required: false, nullable: true, width: '100%' },
      { id: 'f999-21', type: 'csv-select', label: 'CSV 대량 붙여넣기 데이터', required: false, nullable: true, width: '100%' },
      { id: 'f999-22', type: 'privacy-consent', label: '개인정보 활용 동의서', required: true, nullable: false, width: '100%' },
      { id: 'f999-23', type: 'signature', label: '자필 서명란', required: true, nullable: false, width: '100%' },
    ],
    submissions: Array.from({ length: 10 }).map((_, i) => ({
      submissionId: `SUB-999-${String(i + 1).padStart(4, '0')}`,
      submittedAt: `2026-07-${String((i % 27) + 1).padStart(2, '0')}T10:00:00`,
      data: {
        'f999-1': `테스터${i + 1}`,
        'f999-2': 20 + i,
        'f999-3': `010-0000-${String(1000 + i)}`,
        'f999-6': ['개발팀', '기획팀', '디자인팀'][i % 3],
        'f999-7': i % 2 === 0 ? '남성' : '여성',
        'f999-22': '동의함(Y)',
      },
    })),
  },
];

// -----------------------------------------------------------------------
// 3) 정형 데이터: 감사 로그 샘플
// -----------------------------------------------------------------------
const AUDIT_LOGS = [
  { userEmail: 'ralfkang@ktl.re.kr', action: 'DATA_UPDATE', target: 'Form [f-101] Data [SUB-004]', details: '수동 재가공 (이상치 연락처 수정)', severity: 'warning' as const, formId: 'f-101' },
  { userEmail: 'ralfkang@ktl.re.kr', action: 'FORM_UPDATE', target: 'Form [f-101]', details: '필드 속성 변경 (필수값 추가)', severity: 'info' as const, formId: 'f-101' },
  { userEmail: 'ralfkang@ktl.re.kr', action: 'FORM_CREATE', target: 'Form [f-104]', details: '신규 양식지 생성', severity: 'info' as const, formId: 'f-104' },
  { userEmail: 'ralfkang@ktl.re.kr', action: 'LOGIN_MFA', target: 'System', details: '최고 관리자 권한 에스컬레이션 로그인', severity: 'critical' as const },
];

// -----------------------------------------------------------------------
// 4) 정형 데이터: 포인트 원장(append-only) 데모
// -----------------------------------------------------------------------
// 보상 화면 가시성(rewardVisibility=ADMIN_ONLY)의 관리자 미리보기가 하드코딩 숫자
// 대신 실제 원장 데이터를 보여주도록, 최고관리자 계정에 데모 적립 내역을 채운다.
// 자동 적립은 아직 켜지 않았으므로(품질 게이트 부재) 이 데이터는 시드 전용이다.
const POINT_LEDGER_SEED: Array<{
  userEmail: string;
  delta: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED' | 'CANCELED';
  statusReason?: string;
  daysAgo: number;
}> = [
  { userEmail: 'ralfkang@ktl.re.kr', delta: 500, reason: '2024 하반기 고객 만족도 조사 응답', status: 'PAID', daysAgo: 20 },
  { userEmail: 'ralfkang@ktl.re.kr', delta: 300, reason: '신규 입사자 온보딩 피드백 응답', status: 'PAID', daysAgo: 15 },
  { userEmail: 'ralfkang@ktl.re.kr', delta: 200, reason: '2026년 하반기 워크샵 참가 신청', status: 'APPROVED', daysAgo: 5 },
  { userEmail: 'ralfkang@ktl.re.kr', delta: 100, reason: 'IT 장비 지급 요청서 응답', status: 'REJECTED', statusReason: '중복 제출', daysAgo: 10 },
];

async function main() {
  console.log('[seed] Elasticsearch 인덱스 확인/생성...');
  await ensureIndices();

  console.log('[seed] 슈퍼관리자 계정 생성...');
  // DB를 새 스키마로 재생성하는 전제이므로, 과거 목업 계정 정리 로직은 두지 않는다.
  // 실제 임직원 계정은 LDAP 동기화(슈퍼관리자 > 시스템 환경 설정)로 들어온다.
  const userByEmail = new Map<string, { id: string }>();
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, source: 'LOCAL' },
      create: { email: u.email, name: u.name, source: 'LOCAL' },
    });
    userByEmail.set(u.email, user);

    // 슈퍼관리자는 세 역할을 모두 갖는다 — 플랫폼을 운영하면서 양식도 만들고,
    // 다른 부서 설문에는 응답자로 참여하기 때문이다.
    for (const role of u.roles) {
      // scopeFormId가 null인 복합 유니크는 Prisma where 절에서 다루기 번거로워
      // 존재 확인 후 생성하는 방식으로 처리한다(시드는 동시성 이슈가 없다).
      const existingRole = await prisma.userRole.findFirst({
        where: { userId: user.id, role, scopeFormId: null },
      });
      if (!existingRole) {
        await prisma.userRole.create({
          data: { userId: user.id, role, grantedBy: 'db-seed-script' },
        });
      }
    }
  }

  console.log('[seed] 폼 레지스트리(정형) + 폼 템플릿/제출데이터(비정형) 생성...');
  console.log(`[seed]   기본 데모 ${FORMS.length}건 + 샘플 양식지 ${SAMPLE_FORMS.length}건`);
  for (const form of [...FORMS, ...SAMPLE_FORMS]) {
    const owner = userByEmail.get(form.ownerEmail);
    // 데모 양식지는 확정(PUBLISHED) 상태로 넣어 외부 연동 API를 바로 시험해 볼 수 있게 한다.
    // (신규로 만드는 양식지는 DRAFT에서 시작해, 설계가 끝난 뒤 사용자가 직접 확정한다.)
    await prisma.formRegistry.upsert({
      where: { id: form.id },
      update: {
        status: form.status,
        ownerId: owner?.id,
        deployUrl: `/q/${form.id}`,
        lifecycle: 'PUBLISHED',
        publishedAt: new Date(),
      },
      create: {
        id: form.id,
        status: form.status,
        ownerId: owner?.id,
        deployUrl: `/q/${form.id}`,
        lifecycle: 'PUBLISHED',
        publishedAt: new Date(),
        submissionCount: form.submissions.length,
      },
    });

    const now = new Date().toISOString();
    await es.index({
      index: FORM_TEMPLATES_INDEX,
      id: form.id,
      document: {
        formId: form.id,
        title: form.title,
        description: form.description,
        fields: form.fields,
        createdAt: now,
        updatedAt: now,
      },
      refresh: 'wait_for',
    });

    for (const sub of form.submissions) {
      await es.index({
        index: SUBMISSIONS_INDEX,
        id: `${form.id}__${sub.submissionId}`,
        document: { formId: form.id, submissionId: sub.submissionId, submittedAt: sub.submittedAt, data: sub.data },
        refresh: 'wait_for',
      });
    }
  }

  console.log('[seed] 감사 로그 생성...');
  for (const log of AUDIT_LOGS) {
    await prisma.auditLog.create({ data: log });
  }

  console.log('[seed] 포인트 원장(보상 화면 관리자 미리보기용) 생성...');
  const existingLedgerCount = await prisma.pointLedger.count();
  if (existingLedgerCount === 0) {
    for (const entry of POINT_LEDGER_SEED) {
      const user = userByEmail.get(entry.userEmail);
      if (!user) continue;
      const createdAt = new Date(Date.now() - entry.daysAgo * 24 * 60 * 60 * 1000);
      await prisma.pointLedger.create({
        data: {
          userId: user.id,
          delta: entry.delta,
          reason: entry.reason,
          status: entry.status,
          statusReason: entry.statusReason ?? null,
          createdAt,
          settledAt: entry.status === 'PAID' || entry.status === 'REJECTED' ? createdAt : null,
        },
      });
    }
  }

  console.log('[seed] 데이터베이스제작자 등록(저작권법 제91조~제95조) 생성...');
  const existingRegistration = await prisma.databaseRegistration.findFirst();
  if (!existingRegistration) {
    await prisma.databaseRegistration.create({
      data: {
        producerName: '웹 리포트 에디터 운영사',
        completedAt: new Date(),
        lastSubstantialUpdate: new Date(),
        investmentDescription:
          '양식 빌더 플랫폼 구축 및 초기 데모 데이터(관리자 계정, 폼 5종, 제출 데이터) 이관에 인적·물적 투자.',
        updateLogs: {
          create: {
            scope: '초기 데이터 이관',
            description: 'Mock 데이터를 PostgreSQL(정형) + Elasticsearch(비정형)로 이관',
            performedBy: 'db-seed-script',
          },
        },
      },
    });
  }

  console.log('[seed] 완료.');
}

main()
  .catch((err) => {
    console.error('[seed] 실패:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
