import { Client } from '@elastic/elasticsearch';
import type { FormField } from '@/components/builder/types';

// Elasticsearch Client Initialization
// Ensure ELASTICSEARCH_URL is set in .env.local
const elasticClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
  },
});

export default elasticClient;

// 비정형 데이터(폼 필드 구성 / 제출 데이터) 전용 인덱스.
// 계정, 배포상태, 통계, 감사로그 등 "정형" 데이터는 Postgres(src/lib/db.ts)가 담당한다.
export const INDEX_NAMES = {
  FORM_TEMPLATES: 'webreport-form-templates',
  SUBMISSIONS: 'webreport-submissions',
};

// ---------------------------------------------------------------------------
// 문서 타입
// ---------------------------------------------------------------------------

export interface FormTemplateDocument {
  formId: string;
  title: string;
  description: string;
  // 폼 빌더에서 계속 추가/삭제/변경되는 필드 구성 — 23종 컴포넌트마다 보유 속성이 달라
  // 고정 매핑 대신 dynamic object로 저장한다.
  fields: FormField[];
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionDocument {
  formId: string;
  submissionId: string;
  submittedAt: string;
  // 폼의 필드 구성에 따라 col1..colN 등 키가 계속 늘어나는 비정형 응답 데이터.
  data: Record<string, unknown>;
  /**
   * 외부 시스템이 부여한 고유 키(선택). 대량 입력 시 같은 externalId가 이미 있으면
   * 중복으로 판정해 재삽입하지 않는다 — 네트워크 재시도로 데이터가 중복 적재되는 것을 막는
   * 멱등성(idempotency) 장치.
   */
  externalId?: string;
  /** 입력 경로 — 'web'(공개 응답 화면) 또는 'api'(외부 연동). */
  source?: 'web' | 'api';
  /** 입력 시점의 폼 스키마 버전 — 나중에 계약 변경 전/후 데이터를 구분할 수 있다. */
  schemaVersion?: number;
}

// ---------------------------------------------------------------------------
// 인덱스 매핑 (최초 부팅 시 1회 생성 — ensureIndices 참고)
// ---------------------------------------------------------------------------

const FORM_TEMPLATE_MAPPING = {
  properties: {
    formId: { type: 'keyword' },
    title: {
      type: 'text',
      fields: { keyword: { type: 'keyword' } },
    },
    description: { type: 'text' },
    // 필드 배열 자체는 폼마다 구조가 달라 동적 매핑에 맡긴다 (비정형 영역).
    fields: { type: 'object', dynamic: true },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
  },
} as const;

const SUBMISSION_MAPPING = {
  properties: {
    formId: { type: 'keyword' },
    submissionId: { type: 'keyword' },
    submittedAt: { type: 'date' },
    externalId: { type: 'keyword' },
    source: { type: 'keyword' },
    schemaVersion: { type: 'integer' },
    // col1, col2 ... 처럼 폼별로 늘어나는 응답 컬럼 — 동적 매핑.
    data: { type: 'object', dynamic: true },
  },
} as const;

let indicesReady: Promise<void> | null = null;

/**
 * 두 인덱스가 없으면 매핑과 함께 생성하고, **이미 존재하면 putMapping으로 매핑을 갱신**한다.
 * 코드가 새 필드(예: externalId)를 도입해도 기존 인덱스에는 자동 반영되지 않기 때문이다 —
 * 갱신 없이 새 필드가 문서로 먼저 들어가면 dynamic mapping이 `text`로 잡아버려
 * exact-term 조회(멱등성 판정 등)가 조용히 빗나가는 사고가 난다.
 *
 * putMapping은 "신규 필드 추가"만 허용하고, 이미 다른 타입으로 굳은 필드가 있으면
 * 요청 전체가 실패한다. 그 경우는 기동을 막는 대신 경고만 남긴다 — 구버전 인덱스는
 * 재색인(reindex)으로 정리해야 함을 로그로 알린다.
 *
 * 여러 요청이 동시에 들어와도 한 번만 수행되도록 진행 중인 Promise를 캐싱한다
 * (실패 시 캐시를 비워 재시도 가능).
 */
export async function ensureIndices(): Promise<void> {
  if (!indicesReady) {
    indicesReady = (async () => {
      for (const [index, mappings] of [
        [INDEX_NAMES.FORM_TEMPLATES, FORM_TEMPLATE_MAPPING],
        [INDEX_NAMES.SUBMISSIONS, SUBMISSION_MAPPING],
      ] as const) {
        const exists = await elasticClient.indices.exists({ index });
        if (!exists) {
          await elasticClient.indices.create({ index, mappings });
        } else {
          await elasticClient.indices
            .putMapping({ index, ...mappings })
            .catch((err) => {
              console.warn(
                `[elasticsearch] ${index} 매핑 갱신 실패 — 기존 필드 타입 충돌. ` +
                  `구버전 인덱스라면 reindex가 필요합니다: ${(err as Error).message}`
              );
            });
        }
      }
    })().catch((err) => {
      indicesReady = null;
      throw err;
    });
  }
  return indicesReady;
}

// ---------------------------------------------------------------------------
// 폼 템플릿 (필드 구성) CRUD
// ---------------------------------------------------------------------------

export async function getFormTemplate(formId: string): Promise<FormTemplateDocument | null> {
  await ensureIndices();
  try {
    const res = await elasticClient.get<FormTemplateDocument>({
      index: INDEX_NAMES.FORM_TEMPLATES,
      id: formId,
    });
    return res._source ?? null;
  } catch (err: unknown) {
    if ((err as { meta?: { statusCode?: number } })?.meta?.statusCode === 404) return null;
    throw err;
  }
}

export async function listFormTemplates(): Promise<FormTemplateDocument[]> {
  await ensureIndices();
  const res = await elasticClient.search<FormTemplateDocument>({
    index: INDEX_NAMES.FORM_TEMPLATES,
    size: 1000,
    sort: [{ updatedAt: 'desc' }],
  });
  return res.hits.hits.map((hit) => hit._source).filter((doc): doc is FormTemplateDocument => !!doc);
}

export async function upsertFormTemplate(doc: FormTemplateDocument): Promise<void> {
  await ensureIndices();
  await elasticClient.index({
    index: INDEX_NAMES.FORM_TEMPLATES,
    id: doc.formId,
    document: doc,
    refresh: 'wait_for',
  });
}

export async function deleteFormTemplate(formId: string): Promise<void> {
  await ensureIndices();
  await elasticClient.delete({ index: INDEX_NAMES.FORM_TEMPLATES, id: formId }).catch((err) => {
    if ((err as { meta?: { statusCode?: number } })?.meta?.statusCode !== 404) throw err;
  });
}

// ---------------------------------------------------------------------------
// 제출 데이터 CRUD
// ---------------------------------------------------------------------------

export async function createSubmission(doc: SubmissionDocument): Promise<void> {
  await ensureIndices();
  await elasticClient.index({
    index: INDEX_NAMES.SUBMISSIONS,
    id: `${doc.formId}__${doc.submissionId}`,
    document: doc,
    refresh: 'wait_for',
  });
}

export async function updateSubmission(
  formId: string,
  submissionId: string,
  data: Record<string, unknown>
): Promise<void> {
  await ensureIndices();
  await elasticClient.update({
    index: INDEX_NAMES.SUBMISSIONS,
    id: `${formId}__${submissionId}`,
    doc: { data },
    refresh: 'wait_for',
  });
}

/**
 * externalId로 이미 적재된 제출이 있는지 확인한다 (대량 입력 멱등성 판정용).
 * 여러 건을 한 번에 조회해 N+1 쿼리를 피한다.
 */
export async function findExistingExternalIds(
  formId: string,
  externalIds: string[]
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  await ensureIndices();
  const res = await elasticClient.search<SubmissionDocument>({
    index: INDEX_NAMES.SUBMISSIONS,
    size: externalIds.length,
    _source: ['externalId'],
    query: {
      bool: {
        filter: [{ term: { formId } }, { terms: { externalId: externalIds } }],
      },
    },
  });
  return new Set(
    res.hits.hits.map((h) => h._source?.externalId).filter((v): v is string => !!v)
  );
}

/** 여러 제출을 한 번의 bulk 요청으로 적재한다 (대량 입력 성능). */
export async function bulkCreateSubmissions(docs: SubmissionDocument[]): Promise<void> {
  if (docs.length === 0) return;
  await ensureIndices();
  const operations = docs.flatMap((doc) => [
    { index: { _index: INDEX_NAMES.SUBMISSIONS, _id: `${doc.formId}__${doc.submissionId}` } },
    doc,
  ]);
  const res = await elasticClient.bulk({ operations, refresh: 'wait_for' });
  if (res.errors) {
    const firstError = res.items.find((i) => i.index?.error)?.index?.error;
    throw new Error(`bulk index failed: ${firstError?.reason ?? 'unknown'}`);
  }
}

export interface CursorListParams {
  formId: string;
  /** 이 시각 이후에 제출된 것만 (증분 동기화용) */
  since?: string;
  /** 이전 응답의 nextCursor */
  cursor?: string;
  pageSize?: number;
}

export interface CursorListResult {
  items: SubmissionDocument[];
  nextCursor: string | null;
  total: number;
}

/**
 * 외부 연동용 대량 조회 — search_after 기반 커서 페이지네이션.
 *
 * 화면용 `listSubmissions`의 from/size 방식은 깊은 페이지에서 급격히 느려지고 ES의
 * max_result_window(기본 10,000)에 걸린다. 전체 데이터를 순회해야 하는 API 연동에서는
 * search_after 커서가 적합하다.
 */
export async function listSubmissionsByCursor({
  formId,
  since,
  cursor,
  pageSize = 100,
}: CursorListParams): Promise<CursorListResult> {
  await ensureIndices();
  const size = Math.min(pageSize, 1000);
  const res = await elasticClient.search<SubmissionDocument>({
    index: INDEX_NAMES.SUBMISSIONS,
    size,
    // 동일 시각 제출이 있어도 순서가 흔들리지 않도록 submissionId를 tie-breaker로 둔다.
    sort: [{ submittedAt: 'asc' }, { submissionId: 'asc' }],
    ...(cursor ? { search_after: JSON.parse(Buffer.from(cursor, 'base64url').toString()) } : {}),
    query: {
      bool: {
        filter: [
          { term: { formId } },
          ...(since ? [{ range: { submittedAt: { gt: since } } }] : []),
        ],
      },
    },
    track_total_hits: true,
  });

  const hits = res.hits.hits;
  const total = typeof res.hits.total === 'number' ? res.hits.total : res.hits.total?.value ?? 0;
  const lastSort = hits.length === size ? hits[hits.length - 1].sort : undefined;

  return {
    items: hits.map((h) => h._source).filter((d): d is SubmissionDocument => !!d),
    nextCursor: lastSort ? Buffer.from(JSON.stringify(lastSort)).toString('base64url') : null,
    total,
  };
}

export interface ListSubmissionsParams {
  formId: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface ListSubmissionsResult {
  total: number;
  items: SubmissionDocument[];
}

// 단일 요청으로 데이터베이스 전체(또는 상당한 부분)를 한 번에 긁어가지 못하도록
// 서버 계층에서 강제하는 상한선 (저작권법 제93조 대응 기술적 조치). 클라이언트가
// 쿼리 파라미터로 더 큰 값을 요청해도 이 값을 넘지 못한다.
const MAX_PAGE_SIZE = 200;

export async function listSubmissions({
  formId,
  page = 1,
  pageSize = 20,
  search,
}: ListSubmissionsParams): Promise<ListSubmissionsResult> {
  await ensureIndices();
  const cappedPageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  const res = await elasticClient.search<SubmissionDocument>({
    index: INDEX_NAMES.SUBMISSIONS,
    from: (page - 1) * cappedPageSize,
    size: cappedPageSize,
    sort: [{ submittedAt: 'desc' }],
    query: {
      bool: {
        filter: [{ term: { formId } }],
        ...(search
          ? { must: [{ query_string: { query: `*${search}*`, fields: ['data.*'] } }] }
          : {}),
      },
    },
  });
  const total =
    typeof res.hits.total === 'number' ? res.hits.total : res.hits.total?.value ?? 0;
  return {
    total,
    items: res.hits.hits.map((hit) => hit._source).filter((doc): doc is SubmissionDocument => !!doc),
  };
}

export async function getRecentSubmissions(limit = 10): Promise<SubmissionDocument[]> {
  await ensureIndices();
  const res = await elasticClient.search<SubmissionDocument>({
    index: INDEX_NAMES.SUBMISSIONS,
    size: limit,
    sort: [{ submittedAt: 'desc' }],
  });
  return res.hits.hits.map((hit) => hit._source).filter((doc): doc is SubmissionDocument => !!doc);
}

export async function countSubmissions(formId: string): Promise<number> {
  await ensureIndices();
  const res = await elasticClient.count({
    index: INDEX_NAMES.SUBMISSIONS,
    query: { term: { formId } },
  });
  return res.count;
}
