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
    // col1, col2 ... 처럼 폼별로 늘어나는 응답 컬럼 — 동적 매핑.
    data: { type: 'object', dynamic: true },
  },
} as const;

let indicesReady: Promise<void> | null = null;

/**
 * 두 인덱스가 없으면 매핑과 함께 생성한다. 여러 요청이 동시에 들어와도 한 번만
 * 수행되도록 진행 중인 Promise를 캐싱한다 (서버리스/멀티 워커 환경에서도 안전하게
 * 재시도할 수 있도록 실패 시 캐시를 비운다).
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

export async function listSubmissions({
  formId,
  page = 1,
  pageSize = 20,
  search,
}: ListSubmissionsParams): Promise<ListSubmissionsResult> {
  await ensureIndices();
  const res = await elasticClient.search<SubmissionDocument>({
    index: INDEX_NAMES.SUBMISSIONS,
    from: (page - 1) * pageSize,
    size: pageSize,
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
