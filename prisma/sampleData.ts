// 샘플 양식지 20종 + 각 20~50건의 임의 생성 응답 데이터.
//
// 실무에서 실제로 쓰일 법한 다양한 업무 시나리오(동호회 모집, 경비 정산, 설비 점검,
// 채용 지원 등)를 다루며, 23종 컴포넌트 중 실사용 빈도가 높은 유형(text/textarea/
// number/select/radio/checkbox/date/regex-input/file/signature/table/image/
// image-gallery/map-address/privacy-consent)을 폭넓게 사용한다.
//
// f-301(IT 장비 반납 신청서)과 f-318(자산 실사 확인서)은 "사번" 문항을 공유하며
// 실제로 겹치는 값을 갖도록 생성한다 — 양식지 관계 캔버스(온톨로지) 기능을 실제
// 데이터로 시연·검증할 수 있게 하기 위함이다. 두 문항 모두 personalIdentifier 태그를
// 켜 두어, 캔버스에서 블러 처리·자격 게이트가 걸리는 것도 함께 확인할 수 있다.
//
// 경로 별칭(@/) 없이 상대 경로로만 import되는 이유는 seed.ts와 동일 — strip-types
// 직접 실행 스크립트라 tsconfig paths가 적용되지 않는다.

// ---------------------------------------------------------------------------
// 임의 데이터 생성 유틸
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function pickMultiple<T>(arr: readonly T[], min: number, max: number): T[] {
  const count = randomInt(min, Math.min(max, arr.length));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'] as const;
const GIVEN = ['민준', '서연', '지훈', '수빈', '예은', '도윤', '하은', '시우', '지우', '은서', '준혁', '나연'] as const;
function randomName(): string {
  return pick(SURNAMES) + pick(GIVEN);
}

const DEPARTMENTS = ['개발1팀', '개발2팀', '디자인팀', '마케팅팀', '영업팀', '총무팀', '인사팀', '기획팀', '품질보증팀', '생산관리팀'] as const;

// 지도 분포(주소 문항) 검증용 샘플 주소. 법정동코드 앞 2자리가 시·도를 결정하므로
// 시·도별 건수 차이가 나도록 가중치를 준 목록에서 뽑는다.
const SAMPLE_ADDRESSES: Array<{ postcode: string; roadAddress: string; bcode: string; sido: string; sigungu: string; bname: string }> = [
  { postcode: '06236', roadAddress: '서울특별시 강남구 테헤란로 152', bcode: '1168010100', sido: '서울특별시', sigungu: '강남구', bname: '역삼동' },
  { postcode: '04524', roadAddress: '서울특별시 중구 세종대로 110', bcode: '1114010300', sido: '서울특별시', sigungu: '중구', bname: '태평로1가' },
  { postcode: '07327', roadAddress: '서울특별시 영등포구 여의대로 108', bcode: '1156011000', sido: '서울특별시', sigungu: '영등포구', bname: '여의도동' },
  { postcode: '13529', roadAddress: '경기도 성남시 분당구 판교역로 235', bcode: '4113510900', sido: '경기도', sigungu: '성남시 분당구', bname: '삼평동' },
  { postcode: '16226', roadAddress: '경기도 수원시 영통구 광교로 145', bcode: '4111710500', sido: '경기도', sigungu: '수원시 영통구', bname: '이의동' },
  { postcode: '10390', roadAddress: '경기도 고양시 일산동구 중앙로 1275', bcode: '4128510300', sido: '경기도', sigungu: '고양시 일산동구', bname: '장항동' },
  { postcode: '21999', roadAddress: '인천광역시 연수구 송도과학로 32', bcode: '2818510500', sido: '인천광역시', sigungu: '연수구', bname: '송도동' },
  { postcode: '48058', roadAddress: '부산광역시 해운대구 센텀중앙로 97', bcode: '2635010800', sido: '부산광역시', sigungu: '해운대구', bname: '우동' },
  { postcode: '34126', roadAddress: '대전광역시 유성구 대덕대로 1227', bcode: '3020011000', sido: '대전광역시', sigungu: '유성구', bname: '도룡동' },
  { postcode: '41068', roadAddress: '대구광역시 동구 첨단로 39', bcode: '2714012300', sido: '대구광역시', sigungu: '동구', bname: '신서동' },
  { postcode: '61186', roadAddress: '광주광역시 북구 첨단과기로 123', bcode: '2917013300', sido: '광주광역시', sigungu: '북구', bname: '오룡동' },
  { postcode: '44776', roadAddress: '울산광역시 남구 중앙로 201', bcode: '3114012400', sido: '울산광역시', sigungu: '남구', bname: '신정동' },
  { postcode: '28116', roadAddress: '충청북도 청주시 청원구 대성로 298', bcode: '4311412400', sido: '충청북도', sigungu: '청주시 청원구', bname: '내덕동' },
  { postcode: '63309', roadAddress: '제주특별자치도 제주시 문연로 6', bcode: '5011012700', sido: '제주특별자치도', sigungu: '제주시', bname: '연동' },
];

function randomAddress() {
  // 수도권 비중을 높여 실제 분포에 가깝게 만든다(앞쪽 6개가 서울·경기).
  const idx = Math.random() < 0.55 ? randomInt(0, 5) : randomInt(0, SAMPLE_ADDRESSES.length - 1);
  const a = SAMPLE_ADDRESSES[idx];
  return { ...a, detail: `${randomInt(1, 20)}층 ${randomInt(1, 40)}호` };
}

function randomPhone(): string {
  return `010-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`;
}

function randomEmployeeId(): string {
  return `EMP-${randomInt(1000, 9999)}`;
}

function randomDateISO(daysAgoMax: number, daysAgoMin = 0): string {
  const daysAgo = randomInt(daysAgoMin, daysAgoMax);
  const d = new Date(BASE_TIME - daysAgo * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function randomDateOnly(daysAgoMax: number, daysAgoMin = 0): string {
  return randomDateISO(daysAgoMax, daysAgoMin).slice(0, 10);
}

// Date.now()는 시드 실행 시점마다 값이 바뀌어 재실행 시 diff가 생기므로, 고정 기준
// 시각을 하나 두고 여기서부터 상대 일수로 날짜를 흩뿌린다.
const BASE_TIME = new Date('2026-07-29T09:00:00Z').getTime();

interface SubmissionSpec {
  submissionId: string;
  submittedAt: string;
  data: Record<string, unknown>;
}

/** fieldId별 값 생성 함수 맵으로 N건의 응답을 만든다. undefined를 반환하면 그 필드는 결측(비움) 처리된다. */
function buildSubmissions(
  idPrefix: string,
  count: number,
  fieldGens: Record<string, () => unknown>,
  daysAgoMax = 180
): SubmissionSpec[] {
  const specs: SubmissionSpec[] = [];
  for (let i = 1; i <= count; i++) {
    const data: Record<string, unknown> = {};
    for (const [fieldId, gen] of Object.entries(fieldGens)) {
      const value = gen();
      if (value !== undefined) data[fieldId] = value;
    }
    specs.push({
      submissionId: `SUB-${idPrefix}-${String(i).padStart(4, '0')}`,
      submittedAt: randomDateISO(daysAgoMax),
      data,
    });
  }
  return specs;
}

// 일부 문항은 의도적으로 결측/이상치를 섞어 넣는다 — 방금 구현한 결측치·이상치
// 조회 화면(§docs/데이터품질-검증구간-설계.md §5 순위5)을 실제 데이터로 검증하기 위함.
const MAYBE_BLANK_RATE = 0.15; // 15% 확률로 선택 문항을 비운다
function maybeBlank<T>(value: T): T | undefined {
  return Math.random() < MAYBE_BLANK_RATE ? undefined : value;
}

// ---------------------------------------------------------------------------
// 사번 풀 — f-301/f-318이 공유한다(양식지 관계 캔버스 실데이터 시연용).
// ---------------------------------------------------------------------------
const SHARED_EMPLOYEE_IDS = Array.from({ length: 15 }, () => randomEmployeeId());

export interface SampleForm {
  id: string;
  title: string;
  description: string;
  ownerEmail: string;
  status: 'OPEN' | 'CLOSED';
  fields: Array<Record<string, unknown>>;
  submissions: SubmissionSpec[];
  /**
   * 제작 시점에 제작자가 개인정보 취급 자격을 갖고 있었는지(마스킹 계층의 기준값).
   * 기본은 false라 모든 샘플 양식지가 마스킹 대상이 되는데, 그러면 마스킹을 전제로
   * 하는 기능(워드클라우드·주소 분포 등)을 샘플 데이터만으로는 시연할 수 없다.
   * f-301/f-318이 온톨로지 시연을 위해 사번을 공유하는 것과 같은 취지로,
   * 일부 양식지에만 true를 주어 해당 기능을 바로 확인할 수 있게 한다.
   */
  authorHadPrivacyAuth?: boolean;
}

const OWNER = 'admin@example.com';

export const SAMPLE_FORMS: SampleForm[] = [
  // -------------------------------------------------------------------------
  {
    id: 'f-301',
    title: '사내 동호회 회원 모집 신청서',
    description: '2026년 하반기 사내 동호회 신규 회원을 모집합니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f301-1', type: 'text', label: '성명', required: true, nullable: false, width: '50%' },
      { id: 'f301-2', type: 'text', label: '부서', required: true, nullable: false, width: '50%' },
      { id: 'f301-3', type: 'select', label: '희망 동호회', required: true, nullable: false, width: '50%', options: ['등산', '풋살', '독서', '사진', '보드게임', '요가'] },
      { id: 'f301-4', type: 'regex-input', label: '연락처', required: true, nullable: false, regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$', width: '50%' },
      { id: 'f301-5', type: 'textarea', label: '가입 동기', required: false, nullable: true, width: '100%' },
    ],
    submissions: buildSubmissions('301', randomInt(22, 40), {
      'f301-1': () => randomName(),
      'f301-2': () => pick(DEPARTMENTS),
      'f301-3': () => pick(['등산', '풋살', '독서', '사진', '보드게임', '요가']),
      'f301-4': () => randomPhone(),
      'f301-5': () => maybeBlank(pick(['새로운 사람들과 친해지고 싶어서 신청합니다.', '건강 관리 차원에서 신청합니다.', '취미 생활을 넓히고 싶습니다.', '동료들과 더 가까워지고 싶어요.'])),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-302',
    title: '회의실 예약 요청서',
    description: '사내 회의실 사용을 위한 사전 예약 신청서입니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f302-1', type: 'text', label: '신청자', required: true, nullable: false, width: '50%' },
      { id: 'f302-2', type: 'select', label: '회의실', required: true, nullable: false, width: '50%', options: ['1층 대회의실', '3층 소회의실 A', '3층 소회의실 B', '5층 화상회의실'] },
      { id: 'f302-3', type: 'date', label: '사용일자', required: true, nullable: false, width: '50%' },
      { id: 'f302-4', type: 'number', label: '참석 인원', required: true, nullable: false, width: '50%' },
      { id: 'f302-5', type: 'text', label: '회의 목적', required: false, nullable: true, width: '100%' },
    ],
    submissions: buildSubmissions('302', randomInt(25, 45), {
      'f302-1': () => randomName(),
      'f302-2': () => pick(['1층 대회의실', '3층 소회의실 A', '3층 소회의실 B', '5층 화상회의실']),
      'f302-3': () => randomDateOnly(60, -30),
      // 이상치 시연: 회의실 정원(보통 4~12명) 대비 비정상적으로 큰 값을 가끔 섞는다.
      'f302-4': () => (Math.random() < 0.05 ? randomInt(80, 120) : randomInt(2, 12)),
      'f302-5': () => maybeBlank(pick(['주간 업무 보고', '프로젝트 킥오프', '고객 미팅', '분기 실적 검토', '신규 입사자 오리엔테이션'])),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-303',
    title: 'IT 장비 반납 신청서',
    description: '퇴사·부서이동·장비교체 시 지급받은 IT 장비를 반납합니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f303-1', type: 'text', label: '사번', required: true, nullable: false, width: '50%', personalIdentifier: true },
      { id: 'f303-2', type: 'text', label: '성명', required: true, nullable: false, width: '50%' },
      { id: 'f303-3', type: 'checkbox', label: '반납 품목', required: true, nullable: false, width: '100%', options: ['노트북', '모니터', '키보드', '마우스', '헤드셋', '도킹스테이션'] },
      { id: 'f303-4', type: 'select', label: '반납 사유', required: true, nullable: false, width: '50%', options: ['퇴사', '부서이동', '장비교체', '기타'] },
      { id: 'f303-5', type: 'date', label: '반납 예정일', required: true, nullable: false, width: '50%' },
      { id: 'f303-6', type: 'file', label: '장비 사진 첨부', required: false, nullable: true, width: '100%' },
    ],
    submissions: buildSubmissions('303', randomInt(20, 35), {
      'f303-1': () => pick(SHARED_EMPLOYEE_IDS),
      'f303-2': () => randomName(),
      'f303-3': () => pickMultiple(['노트북', '모니터', '키보드', '마우스', '헤드셋', '도킹스테이션'], 1, 4),
      'f303-4': () => pick(['퇴사', '부서이동', '장비교체', '기타']),
      'f303-5': () => randomDateOnly(45, -20),
      'f303-6': () => maybeBlank('device-photo.jpg'),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-304',
    title: '출장 경비 정산서',
    description: '국내외 출장 경비를 정산 요청합니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f304-1', type: 'text', label: '성명', required: true, nullable: false, width: '50%' },
      { id: 'f304-2', type: 'text', label: '부서', required: true, nullable: false, width: '50%' },
      { id: 'f304-3', type: 'text', label: '출장지', required: true, nullable: false, width: '50%' },
      { id: 'f304-4', type: 'date', label: '출장일자', required: true, nullable: false, width: '50%' },
      { id: 'f304-5', type: 'number', label: '총 경비(원)', required: true, nullable: false, width: '50%' },
      { id: 'f304-6', type: 'table', label: '경비 내역', required: false, nullable: true, width: '100%' },
    ],
    submissions: buildSubmissions('304', randomInt(20, 38), {
      'f304-1': () => randomName(),
      'f304-2': () => pick(DEPARTMENTS),
      'f304-3': () => pick(['부산', '대전', '광주', '제주', '도쿄', '싱가포르', '상하이']),
      'f304-4': () => randomDateOnly(90, -10),
      // 이상치 시연: 통상 출장비(20만~150만원대) 대비 비정상적으로 큰/작은 값을 가끔 섞는다.
      'f304-5': () => (Math.random() < 0.06 ? randomInt(8_000_000, 15_000_000) : randomInt(150_000, 1_500_000)),
      'f304-6': () => maybeBlank([{ item: '항공료', amount: randomInt(200000, 800000) }, { item: '숙박비', amount: randomInt(80000, 250000) }]),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-305',
    title: '고객 불만 접수 및 처리대장',
    description: '고객 불만 사항을 접수하고 처리 결과를 기록합니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f305-1', type: 'text', label: '접수 담당자', required: true, nullable: false, width: '50%' },
      { id: 'f305-2', type: 'regex-input', label: '고객 연락처', required: true, nullable: false, regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$', width: '50%' },
      { id: 'f305-3', type: 'select', label: '불만 유형', required: true, nullable: false, width: '50%', options: ['제품 결함', '배송 지연', '서비스 불만', '환불 요청', '기타'] },
      { id: 'f305-4', type: 'radio', label: '처리 상태', required: true, nullable: false, width: '50%', options: ['접수', '처리중', '완료'] },
      { id: 'f305-5', type: 'textarea', label: '상세 내용', required: true, nullable: false, width: '100%' },
    ],
    submissions: buildSubmissions('305', randomInt(28, 50), {
      'f305-1': () => randomName(),
      'f305-2': () => randomPhone(),
      'f305-3': () => pick(['제품 결함', '배송 지연', '서비스 불만', '환불 요청', '기타']),
      'f305-4': () => pick(['접수', '처리중', '완료']),
      'f305-5': () => pick(['제품에 스크래치가 있어 교환을 요청드립니다.', '배송이 예정일보다 3일 지연되었습니다.', '상담원 응대가 불친절했습니다.', '결제 후 환불이 되지 않고 있습니다.', '설명서와 다르게 작동합니다.']),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-306',
    title: '사내 교육 프로그램 신청서',
    description: '2026년 하반기 사내 역량강화 교육 프로그램 신청서입니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f306-1', type: 'text', label: '성명', required: true, nullable: false, width: '50%' },
      { id: 'f306-2', type: 'text', label: '부서', required: true, nullable: false, width: '50%' },
      { id: 'f306-3', type: 'checkbox', label: '신청 과정', required: true, nullable: false, width: '100%', options: ['리더십 과정', '데이터 분석 입문', 'AI 활용 실무', '커뮤니케이션 스킬', '프로젝트 관리(PM)'] },
      { id: 'f306-4', type: 'date', label: '희망 수강일', required: false, nullable: true, width: '50%' },
      { id: 'f306-5', type: 'radio', label: '근무 시간 내/외', required: true, nullable: false, width: '50%', options: ['근무시간 내', '근무시간 외'] },
    ],
    submissions: buildSubmissions('306', randomInt(24, 42), {
      'f306-1': () => randomName(),
      'f306-2': () => pick(DEPARTMENTS),
      'f306-3': () => pickMultiple(['리더십 과정', '데이터 분석 입문', 'AI 활용 실무', '커뮤니케이션 스킬', '프로젝트 관리(PM)'], 1, 3),
      'f306-4': () => maybeBlank(randomDateOnly(60, -1)),
      'f306-5': () => pick(['근무시간 내', '근무시간 외']),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-307',
    title: '협력업체 등록 신청서',
    description: '신규 협력업체 등록을 위한 정보 제출 양식입니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f307-1', type: 'text', label: '업체명', required: true, nullable: false, width: '50%' },
      { id: 'f307-2', type: 'regex-input', label: '사업자등록번호', required: true, nullable: false, regexPattern: '^\\d{3}-\\d{2}-\\d{5}$', width: '50%' },
      { id: 'f307-3', type: 'text', label: '담당자명', required: true, nullable: false, width: '50%' },
      { id: 'f307-4', type: 'regex-input', label: '담당자 연락처', required: true, nullable: false, regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$', width: '50%' },
      { id: 'f307-5', type: 'map-address', label: '사업장 주소', required: true, nullable: false, width: '100%' },
      { id: 'f307-6', type: 'file', label: '사업자등록증 사본', required: true, nullable: false, width: '100%' },
    ],
    submissions: buildSubmissions('307', randomInt(20, 30), {
      'f307-1': () => pick(['(주)한국산업', '대한물류', '스마트테크', '그린솔루션', '한빛시스템', '유니텍', '(주)미래개발']),
      'f307-2': () => `${randomInt(100, 999)}-${randomInt(10, 99)}-${randomInt(10000, 99999)}`,
      'f307-3': () => randomName(),
      'f307-4': () => randomPhone(),
      'f307-5': () => '서울특별시 강남구 테헤란로 ' + randomInt(1, 500),
      'f307-6': () => 'business-license.pdf',
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-308',
    title: '설비 점검 체크리스트',
    description: '생산 설비 정기 점검 결과를 기록합니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f308-1', type: 'text', label: '점검자', required: true, nullable: false, width: '50%' },
      { id: 'f308-2', type: 'select', label: '설비명', required: true, nullable: false, width: '50%', options: ['압축기 A', '압축기 B', '컨베이어 1호', '컨베이어 2호', '포장기'] },
      { id: 'f308-3', type: 'checkbox', label: '점검 항목', required: true, nullable: false, width: '100%', options: ['외관 상태', '소음/진동', '온도', '윤활유 상태', '전기 배선'] },
      { id: 'f308-4', type: 'radio', label: '종합 판정', required: true, nullable: false, width: '50%', options: ['정상', '주의', '수리 필요'] },
      { id: 'f308-5', type: 'textarea', label: '특이사항', required: false, nullable: true, width: '100%' },
      { id: 'f308-6', type: 'signature', label: '점검자 서명', required: true, nullable: false, width: '100%' },
    ],
    submissions: buildSubmissions('308', randomInt(22, 40), {
      'f308-1': () => randomName(),
      'f308-2': () => pick(['압축기 A', '압축기 B', '컨베이어 1호', '컨베이어 2호', '포장기']),
      'f308-3': () => pickMultiple(['외관 상태', '소음/진동', '온도', '윤활유 상태', '전기 배선'], 2, 5),
      'f308-4': () => pick(['정상', '정상', '정상', '주의', '수리 필요']),
      'f308-5': () => maybeBlank(pick(['특이사항 없음', '경미한 소음 발생, 재점검 필요', '윤활유 보충함'])),
      'f308-6': () => 'signature-data-url-placeholder',
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-309',
    title: '개인정보 수집·이용 동의서',
    description: '사내 행사 참여를 위한 개인정보 수집·이용 동의서입니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f309-1', type: 'text', label: '성명', required: true, nullable: false, width: '50%' },
      { id: 'f309-2', type: 'regex-input', label: '연락처', required: true, nullable: false, regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$', width: '50%' },
      {
        id: 'f309-3',
        type: 'privacy-consent',
        label: '개인정보 수집·이용 동의',
        required: true,
        nullable: false,
        width: '100%',
        consentMeta: {
          purpose: '사내 행사 참여자 접수 및 안내',
          items: '성명, 연락처, 서명',
          retentionPeriod: '행사 종료일로부터 1년',
        },
      },
      { id: 'f309-4', type: 'signature', label: '서명', required: true, nullable: false, width: '100%' },
    ],
    submissions: buildSubmissions('309', randomInt(25, 45), {
      'f309-1': () => randomName(),
      'f309-2': () => randomPhone(),
      'f309-3': () => '동의함(Y)',
      'f309-4': () => 'signature-data-url-placeholder',
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-310',
    title: '팀 빌딩 워크샵 참가 신청서',
    description: '부서별 팀 빌딩 워크샵 참가 신청을 받습니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f310-1', type: 'text', label: '성명', required: true, nullable: false, width: '50%' },
      { id: 'f310-2', type: 'text', label: '부서', required: true, nullable: false, width: '50%' },
      { id: 'f310-3', type: 'radio', label: '참석 여부', required: true, nullable: false, width: '50%', options: ['참석', '불참'] },
      { id: 'f310-4', type: 'checkbox', label: '희망 액티비티', required: false, nullable: true, width: '100%', options: ['방탈출', '볼링', '요리교실', '캠핑', '보드게임'] },
      { id: 'f310-5', type: 'select', label: '식사 알레르기', required: false, nullable: true, width: '50%', options: ['없음', '갑각류', '견과류', '유제품', '기타'] },
    ],
    submissions: buildSubmissions('310', randomInt(30, 50), {
      'f310-1': () => randomName(),
      'f310-2': () => pick(DEPARTMENTS),
      'f310-3': () => pick(['참석', '참석', '참석', '불참']),
      'f310-4': () => maybeBlank(pickMultiple(['방탈출', '볼링', '요리교실', '캠핑', '보드게임'], 1, 3)),
      'f310-5': () => maybeBlank(pick(['없음', '없음', '갑각류', '견과류', '유제품'])),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-311',
    title: '사내 제안 아이디어 공모전 접수',
    description: '업무 개선 아이디어를 접수합니다. 우수 아이디어는 포상합니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f311-1', type: 'text', label: '제안자', required: true, nullable: false, width: '50%' },
      { id: 'f311-2', type: 'text', label: '부서', required: true, nullable: false, width: '50%' },
      { id: 'f311-3', type: 'text', label: '아이디어 제목', required: true, nullable: false, width: '100%' },
      { id: 'f311-4', type: 'textarea', label: '아이디어 상세 설명', required: true, nullable: false, width: '100%' },
      { id: 'f311-5', type: 'select', label: '분야', required: true, nullable: false, width: '50%', options: ['업무 프로세스', '비용 절감', '고객 서비스', 'IT 시스템', '기타'] },
      { id: 'f311-6', type: 'file', label: '참고 자료 첨부', required: false, nullable: true, width: '100%' },
    ],
    submissions: buildSubmissions('311', randomInt(20, 35), {
      'f311-1': () => randomName(),
      'f311-2': () => pick(DEPARTMENTS),
      'f311-3': () => pick(['회의실 예약 자동화 제안', '문서 결재 프로세스 간소화', '재고 관리 시스템 개선', '사내 카페테리아 대기시간 단축', '재택근무 협업 도구 도입']),
      'f311-4': () => pick(['현재 프로세스의 비효율을 개선하여 업무 시간을 단축할 수 있습니다.', '반복 작업을 자동화하면 인력 리소스를 절감할 수 있습니다.', '고객 응대 시간을 줄여 만족도를 높일 수 있습니다.']),
      'f311-5': () => pick(['업무 프로세스', '비용 절감', '고객 서비스', 'IT 시스템', '기타']),
      'f311-6': () => maybeBlank('proposal-attachment.pdf'),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-312',
    title: '복지포인트 사용 신청서',
    description: '연간 복지포인트 사용 신청서입니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f312-1', type: 'text', label: '성명', required: true, nullable: false, width: '50%' },
      { id: 'f312-2', type: 'text', label: '사번', required: true, nullable: false, width: '50%' },
      { id: 'f312-3', type: 'select', label: '사용 항목', required: true, nullable: false, width: '50%', options: ['건강검진', '자기계발', '여가활동', '가족돌봄', '도서구입'] },
      { id: 'f312-4', type: 'number', label: '신청 금액(원)', required: true, nullable: false, width: '50%' },
      { id: 'f312-5', type: 'regex-input', label: '환불 계좌번호', required: false, nullable: true, regexPattern: '^\\d{2,6}-\\d{2,6}-\\d{2,8}$', width: '50%' },
    ],
    submissions: buildSubmissions('312', randomInt(25, 45), {
      'f312-1': () => randomName(),
      'f312-2': () => randomEmployeeId(),
      'f312-3': () => pick(['건강검진', '자기계발', '여가활동', '가족돌봄', '도서구입']),
      // 이상치 시연: 연간 한도(보통 30~80만원) 대비 비정상적으로 큰 값을 가끔 섞는다.
      'f312-4': () => (Math.random() < 0.05 ? randomInt(5_000_000, 9_000_000) : randomInt(50_000, 800_000)),
      'f312-5': () => maybeBlank(`${randomInt(100, 999)}-${randomInt(10, 99)}-${randomInt(100000, 999999)}`),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-313',
    title: '재택근무 신청서',
    description: '재택근무 신청 및 사유를 기록합니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f313-1', type: 'text', label: '성명', required: true, nullable: false, width: '50%' },
      { id: 'f313-2', type: 'text', label: '부서', required: true, nullable: false, width: '50%' },
      { id: 'f313-3', type: 'date', label: '재택근무 희망일', required: true, nullable: false, width: '50%' },
      { id: 'f313-4', type: 'select', label: '사유', required: true, nullable: false, width: '50%', options: ['개인 사정', '자녀 돌봄', '병원 방문', '집중 업무', '기타'] },
      { id: 'f313-5', type: 'textarea', label: '업무 계획', required: false, nullable: true, width: '100%' },
    ],
    submissions: buildSubmissions('313', randomInt(28, 48), {
      'f313-1': () => randomName(),
      'f313-2': () => pick(DEPARTMENTS),
      'f313-3': () => randomDateOnly(30, -30),
      'f313-4': () => pick(['개인 사정', '자녀 돌봄', '병원 방문', '집중 업무', '기타']),
      'f313-5': () => maybeBlank(pick(['보고서 작성 및 자료 정리 예정입니다.', '기획안 검토 및 회의 준비를 진행합니다.', '집중이 필요한 개발 업무를 진행합니다.'])),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-314',
    title: '조직문화 진단 설문',
    description: '연간 조직문화 진단을 위한 익명 설문입니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f314-1', type: 'select', label: '소속 부서(대분류)', required: true, nullable: false, width: '50%', options: ['개발', '디자인', '영업/마케팅', '경영지원'] },
      { id: 'f314-2', type: 'radio', label: '업무 만족도', required: true, nullable: false, width: '50%', options: ['매우 만족', '만족', '보통', '불만족', '매우 불만족'], anonymous: true },
      { id: 'f314-3', type: 'radio', label: '조직 소통 수준', required: true, nullable: false, width: '50%', options: ['매우 원활', '원활', '보통', '미흡', '매우 미흡'], anonymous: true },
      { id: 'f314-4', type: 'radio', label: '워라밸 만족도', required: true, nullable: false, width: '50%', options: ['매우 만족', '만족', '보통', '불만족', '매우 불만족'], anonymous: true },
      { id: 'f314-5', type: 'textarea', label: '자유 의견', required: false, nullable: true, width: '100%', anonymous: true },
    ],
    submissions: buildSubmissions('314', randomInt(35, 50), {
      'f314-1': () => pick(['개발', '디자인', '영업/마케팅', '경영지원']),
      'f314-2': () => pick(['매우 만족', '만족', '만족', '보통', '불만족']),
      'f314-3': () => pick(['매우 원활', '원활', '원활', '보통', '미흡']),
      'f314-4': () => pick(['매우 만족', '만족', '보통', '보통', '불만족']),
      'f314-5': () => maybeBlank(pick(['전반적으로 만족스러운 근무 환경입니다.', '부서 간 협업이 더 원활해지면 좋겠습니다.', '유연근무제 확대를 희망합니다.'])),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-315',
    title: '신제품 아이디어 투표',
    description: '차기 신제품 후보 디자인에 투표해주세요.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f315-1', type: 'text', label: '참여자', required: true, nullable: false, width: '50%' },
      { id: 'f315-2', type: 'image-gallery', label: '후보 디자인 이미지', required: false, nullable: true, width: '100%' },
      { id: 'f315-3', type: 'radio', label: '선호 디자인', required: true, nullable: false, width: '50%', options: ['시안 A', '시안 B', '시안 C'] },
      { id: 'f315-4', type: 'textarea', label: '선택 이유', required: false, nullable: true, width: '100%' },
    ],
    submissions: buildSubmissions('315', randomInt(30, 50), {
      'f315-1': () => randomName(),
      'f315-2': () => maybeBlank(['candidate-a.jpg', 'candidate-b.jpg', 'candidate-c.jpg']),
      'f315-3': () => pick(['시안 A', '시안 B', '시안 B', '시안 C']),
      'f315-4': () => maybeBlank(pick(['색감이 가장 세련되어 보입니다.', '실용성이 높아 보입니다.', '타겟 고객층에 가장 잘 맞는 것 같습니다.'])),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-316',
    title: '정보보안 서약서',
    description: '전 임직원 대상 정보보안 준수 서약서입니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f316-1', type: 'text', label: '성명', required: true, nullable: false, width: '50%' },
      { id: 'f316-2', type: 'text', label: '부서', required: true, nullable: false, width: '50%' },
      { id: 'f316-3', type: 'checkbox', label: '준수 서약 항목', required: true, nullable: false, width: '100%', options: ['외부 반출 금지', '비밀번호 관리', '개인정보 보호', '보안 사고 즉시 보고'] },
      {
        id: 'f316-4',
        type: 'privacy-consent',
        label: '서약 동의',
        required: true,
        nullable: false,
        width: '100%',
        consentMeta: {
          purpose: '정보보안 서약 이행 여부 관리 및 보안 사고 대응',
          items: '성명, 부서, 서약 항목 체크 내역, 서명',
          retentionPeriod: '재직 기간 및 퇴직 후 3년',
          thirdParty: {
            recipient: '정보보안팀 및 감사팀',
            purpose: '보안 사고 조사 및 내부 감사',
            items: '성명, 부서, 서약 항목 체크 내역',
            retentionPeriod: '재직 기간 및 퇴직 후 3년',
          },
        },
      },
      { id: 'f316-5', type: 'signature', label: '서명', required: true, nullable: false, width: '100%' },
    ],
    submissions: buildSubmissions('316', randomInt(30, 50), {
      'f316-1': () => randomName(),
      'f316-2': () => pick(DEPARTMENTS),
      'f316-3': () => ['외부 반출 금지', '비밀번호 관리', '개인정보 보호', '보안 사고 즉시 보고'],
      'f316-4': () => '동의함(Y)',
      'f316-5': () => 'signature-data-url-placeholder',
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-317',
    title: '구내식당 메뉴 만족도 조사',
    description: '구내식당 메뉴 개선을 위한 만족도 조사입니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f317-1', type: 'radio', label: '전반적 만족도', required: true, nullable: false, width: '50%', options: ['매우 만족', '만족', '보통', '불만족', '매우 불만족'] },
      { id: 'f317-2', type: 'checkbox', label: '개선 희망 사항', required: false, nullable: true, width: '100%', options: ['메뉴 다양성', '맛', '위생', '대기시간', '가격'] },
      { id: 'f317-3', type: 'textarea', label: '기타 의견', required: false, nullable: true, width: '100%' },
    ],
    submissions: buildSubmissions('317', randomInt(30, 50), {
      'f317-1': () => pick(['매우 만족', '만족', '만족', '보통', '불만족']),
      'f317-2': () => maybeBlank(pickMultiple(['메뉴 다양성', '맛', '위생', '대기시간', '가격'], 1, 3)),
      'f317-3': () => maybeBlank(pick(['샐러드바가 더 다양해지면 좋겠습니다.', '점심시간 대기줄이 너무 깁니다.', '전반적으로 만족합니다.'])),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-318',
    title: '자산 실사 확인서',
    description: '연간 고정자산 실사 결과를 확인·서명합니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f318-1', type: 'text', label: '담당자 사번', required: true, nullable: false, width: '50%', personalIdentifier: true },
      { id: 'f318-2', type: 'text', label: '담당자명', required: true, nullable: false, width: '50%' },
      { id: 'f318-3', type: 'table', label: '자산 목록', required: true, nullable: false, width: '100%' },
      { id: 'f318-4', type: 'radio', label: '실사 결과', required: true, nullable: false, width: '50%', options: ['일치', '불일치', '분실'] },
      { id: 'f318-5', type: 'signature', label: '확인 서명', required: true, nullable: false, width: '100%' },
    ],
    submissions: buildSubmissions('318', randomInt(20, 32), {
      'f318-1': () => pick(SHARED_EMPLOYEE_IDS),
      'f318-2': () => randomName(),
      'f318-3': () => [{ item: '노트북', assetTag: `AS-${randomInt(1000, 9999)}` }, { item: '모니터', assetTag: `AS-${randomInt(1000, 9999)}` }],
      'f318-4': () => pick(['일치', '일치', '일치', '불일치', '분실']),
      'f318-5': () => 'signature-data-url-placeholder',
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-319',
    title: '신입 채용 지원서',
    description: '2026년 하반기 공개채용 지원서입니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    // 주소 분포(지도) 기능을 샘플 데이터만으로 바로 시연하기 위해 마스킹 비대상으로 둔다.
    authorHadPrivacyAuth: true,
    fields: [
      { id: 'f319-1', type: 'text', label: '지원자명', required: true, nullable: false, width: '50%' },
      { id: 'f319-2', type: 'regex-input', label: '이메일', required: true, nullable: false, regexPattern: '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$', width: '50%' },
      { id: 'f319-3', type: 'regex-input', label: '연락처', required: true, nullable: false, regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$', width: '50%' },
      { id: 'f319-4', type: 'select', label: '지원 직무', required: true, nullable: false, width: '50%', options: ['백엔드 개발', '프론트엔드 개발', 'UX/UI 디자인', '마케팅', '영업'] },
      { id: 'f319-5', type: 'date', label: '입사 가능일', required: false, nullable: true, width: '50%' },
      { id: 'f319-6', type: 'file', label: '이력서 첨부', required: true, nullable: false, width: '100%' },
      { id: 'f319-7', type: 'map-address', label: '거주지 주소', required: true, nullable: false, width: '100%', addressOptions: { requireDetail: false, mapEnabled: true } },
    ],
    submissions: buildSubmissions('319', randomInt(25, 45), {
      'f319-1': () => randomName(),
      'f319-2': () => `applicant${randomInt(100, 999)}@example.com`,
      'f319-3': () => randomPhone(),
      'f319-4': () => pick(['백엔드 개발', '프론트엔드 개발', 'UX/UI 디자인', '마케팅', '영업']),
      'f319-5': () => maybeBlank(randomDateOnly(60, -10)),
      'f319-6': () => 'resume.pdf',
      'f319-7': () => randomAddress(),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'f-320',
    title: '사무용품 구매 요청서',
    description: '부서별 사무용품 구매를 요청합니다.',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'f320-1', type: 'text', label: '요청자', required: true, nullable: false, width: '50%' },
      { id: 'f320-2', type: 'text', label: '부서', required: true, nullable: false, width: '50%' },
      { id: 'f320-3', type: 'checkbox', label: '요청 품목', required: true, nullable: false, width: '100%', options: ['A4 용지', '토너', '필기구', '파일/바인더', '접착메모지', '기타 문구'] },
      { id: 'f320-4', type: 'number', label: '수량', required: true, nullable: false, width: '50%' },
      { id: 'f320-5', type: 'date', label: '필요일자', required: false, nullable: true, width: '50%' },
    ],
    submissions: buildSubmissions('320', randomInt(25, 48), {
      'f320-1': () => randomName(),
      'f320-2': () => pick(DEPARTMENTS),
      'f320-3': () => pickMultiple(['A4 용지', '토너', '필기구', '파일/바인더', '접착메모지', '기타 문구'], 1, 3),
      // 이상치 시연: 일반적인 요청 수량(1~20) 대비 비정상적으로 큰 값을 가끔 섞는다.
      'f320-4': () => (Math.random() < 0.05 ? randomInt(500, 1000) : randomInt(1, 20)),
      'f320-5': () => maybeBlank(randomDateOnly(21, -5)),
    }),
  },
  // -------------------------------------------------------------------------
  {
    id: 'server-room-access',
    title: '서버실 출입통제 관리대장',
    description: '서버실/전산실 출입 방문객 기록 및 관리책임자 승인 대장',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'visit_date', type: 'date', label: '년월일', required: true, fillableBy: 'guest', width: '50%' },
      { id: 'entry_time', type: 'text', label: '출입시간', required: true, fillableBy: 'guest', width: '50%' },
      { id: 'work_category', type: 'select', label: '작업구분', required: true, fillableBy: 'guest', width: '50%', options: ['시스템 정기점검', '시스템 장애 처리', '시스템 육안확인', '장비 설치 및 해제', '일시적 작업(PoC, Test 포함)', '기타'] },
      { id: 'exit_time', type: 'text', label: '퇴청시간', required: false, fillableBy: 'guest', width: '50%' },
      { id: 'location_console_room', type: 'checkbox', label: '콘솔실', required: false, fillableBy: 'guest', width: '50%' },
      { id: 'location_server_room', type: 'checkbox', label: '서버실', required: false, fillableBy: 'guest', width: '50%' },
      { id: 'visitor_phone', type: 'regex-input', label: '휴대폰 전화번호', required: true, fillableBy: 'guest', width: '50%', regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$' },
      { id: 'visitor_org', type: 'text', label: '출입자 소속', required: true, fillableBy: 'guest', width: '50%' },
      { id: 'visitor_rank', type: 'text', label: '출입자 직급', required: true, fillableBy: 'guest', width: '50%' },
      { id: 'visitor_name', type: 'text', label: '출입자 성명', required: true, fillableBy: 'guest', width: '50%' },
      { id: 'visit_purpose', type: 'textarea', label: '출입사유', required: false, fillableBy: 'guest', width: '100%' },
      { id: 'escort', type: 'select', label: '입회자', required: true, fillableBy: 'guest', width: '50%', options: ['매니저 김수영', '매니저 조형일', '매니저 백승호', '매니저 문종태', 'PL 노성규', 'PL 이덕천', '선임연구원 강정묵', '연구원 이승희', '연구원 송원섭'] },
      { id: 'escort_signature', type: 'signature', label: '입회자 서명', required: true, fillableBy: 'guest', width: '100%' },
      { id: 'admin_confirm_signature', type: 'signature', label: '관리책임자 확인(서명)', required: true, fillableBy: 'admin', width: '100%' },
    ],
    submissions: buildSubmissions('sra', randomInt(15, 25), {
      'visit_date': () => randomDateOnly(30, 0),
      'entry_time': () => '10:00',
      'work_category': () => pick(['시스템 정기점검', '시스템 장애 처리', '장비 설치 및 해제']),
      'exit_time': () => '12:00',
      'visitor_phone': () => randomPhone(),
      'visitor_org': () => pick(['한국기술', '서버텍', '네트워크솔루션', '클라우드원']),
      'visitor_rank': () => pick(['팀장', '수석엔지니어', '책임연구원']),
      'visitor_name': () => randomName(),
      'visit_purpose': () => '메인 서버 정기점검 및 디스크 상태 교체',
      'escort': () => pick(['매니저 김수영', 'PL 노성규', 'PL 이덕천']),
      'escort_signature': () => 'signature-data-url-placeholder',
      'admin_confirm_signature': () => 'admin-signature-data-url-placeholder',
    }),
  },
  {
    id: 'media-disposal',
    title: '저장매체 삭제 및 폐기 관리대장',
    description: '저장매체 삭제 및 폐기 작업 기록 및 관리책임자 승인 대장',
    ownerEmail: OWNER,
    status: 'OPEN',
    fields: [
      { id: 'disposal_date', type: 'date', label: '폐기일자', required: true, fillableBy: 'guest', width: '50%' },
      { id: 'disposer', type: 'select', label: '폐기자', required: true, fillableBy: 'guest', width: '50%', options: ['매니저 김수영', '매니저 조형일', 'PL 노성규', 'PL 이덕천'] },
      { id: 'equipment_name', type: 'text', label: '장비명', required: true, fillableBy: 'guest', width: '50%' },
      { id: 'media_form', type: 'select', label: '매체형태', required: true, fillableBy: 'guest', width: '50%', options: ['서버용', '개인단말 지급 PC', '보안 이동식 디스크', '기타'] },
      { id: 'media_type', type: 'select', label: '자료형태', required: true, fillableBy: 'guest', width: '50%', options: ['SSD', 'SATA', 'USB', 'NVMe', '기타'] },
      { id: 'data_content', type: 'select', label: '자료내용', required: true, fillableBy: 'guest', width: '50%', options: ['전산실 자료', '업무용 자료', '개인용 자료', '보안 데이터', '기타'] },
      { id: 'disposal_method', type: 'select', label: '삭제/폐기방법', required: true, fillableBy: 'guest', width: '50%', options: ['물리적 파쇄', '반복 쓰기', '그 외'] },
      { id: 'reason', type: 'select', label: '사유', required: true, fillableBy: 'guest', width: '50%', options: ['하드디스크 고장으로 인한 파쇄', '기타'] },
      { id: 'reason_detail', type: 'textarea', label: '상세 사유', required: false, fillableBy: 'guest', width: '100%' },
      { id: 'worker', type: 'select', label: '작업자', required: true, fillableBy: 'guest', width: '50%', options: ['매니저 김수영', '매니저 조형일', 'PL 노성규', 'PL 이덕천'] },
      { id: 'worker_signature', type: 'signature', label: '작업자 서명', required: true, fillableBy: 'guest', width: '100%' },
      { id: 'confirmer', type: 'select', label: '확인자', required: true, fillableBy: 'guest', width: '50%', options: ['매니저 김수영', 'PL 노성규', 'PL 이덕천'] },
      { id: 'admin_confirm_signature', type: 'signature', label: '관리책임자 확인(서명)', required: true, fillableBy: 'admin', width: '100%' },
    ],
    submissions: buildSubmissions('md', randomInt(10, 20), {
      'disposal_date': () => randomDateOnly(30, 0),
      'disposer': () => pick(['매니저 김수영', 'PL 노성규']),
      'equipment_name': () => pick(['DB 서버 #1', '웹 서버 #3', '개발용 PC #12']),
      'media_form': () => pick(['서버용', '개인단말 지급 PC']),
      'media_type': () => pick(['SSD', 'NVMe', 'SATA']),
      'data_content': () => pick(['전산실 자료', '업무용 자료']),
      'disposal_method': () => pick(['물리적 파쇄', '반복 쓰기']),
      'reason': () => '하드디스크 고장으로 인한 파쇄',
      'worker': () => pick(['매니저 김수영', 'PL 노성규']),
      'worker_signature': () => 'signature-data-url-placeholder',
      'confirmer': () => pick(['PL 이덕천']),
      'admin_confirm_signature': () => 'admin-signature-data-url-placeholder',
    }),
  },
];
