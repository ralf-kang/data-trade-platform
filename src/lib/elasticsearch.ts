import { Client } from '@elastic/elasticsearch';
import type { MappingTypeMapping, IndicesIndexSettings } from '@elastic/elasticsearch/lib/api/types';
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
  ANON_SUBMISSIONS: 'webreport-anon-submissions',
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
  /** 응답자(1단계). null/누락이면 익명 응답 — 기존 데이터와의 호환을 위해 선택적이다. */
  respondentId?: string;
  /** 이 응답이 어떤 신원 수준으로 수집되었는지 — 사후 신뢰도 판단의 근거. */
  identityLevel?: 'ANONYMOUS' | 'IDENTIFIED' | 'AUTHENTICATED';
  /** 소속 회차(3단계). 회차가 곧 시계열 축이 되어 추세 분석의 기준이 된다. */
  campaignId?: string;
  /** 수정 횟수 — 최초 제출이 0. CampaignParticipation.revision과 일치시킨다. */
  revision?: number;
}

/**
 * 익명 문항 응답(2단계). 식별 문서와 결합할 수 있는 어떤 키도 갖지 않는다:
 * id는 독립 난수, 시각은 절삭, 적재 순서는 버퍼에서 셔플된다.
 */
export interface AnonymousSubmissionDocument {
  anonId: string;
  formId: string;
  /** 절삭된 시각(기본 1시간 단위). 정확한 제출 시각은 존재하지 않는다. */
  bucketAt: string;
  schemaVersion: number;
  /** 익명 문항만 담긴다. respondentId·submissionId는 의도적으로 없다. */
  data: Record<string, unknown>;
  /** 임계값 미만 상태로 적재된 배치(양식 마감 시 잔여분) — 조회를 막는 근거. */
  belowThreshold: boolean;
  /** 소속 회차 — 임계값 판정이 회차 단위로 이루어져야 하므로 필수다. */
  campaignId?: string;
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

// 워드클라우드(§워드클라우드-설계 §5-2)의 한국어 형태소 분석 전용 커스텀 애널라이저.
// docker/elasticsearch/Dockerfile이 analysis-nori 플러그인을 설치한 이미지를 전제로 한다.
// 조사(J)·어미(E) 등은 nori_part_of_speech 기본 stoptags가 제거하고, 명사 위주로 더
// 좁히기 위해 nori_readingform + 길이 필터를 추가한다.
export const NORI_ANALYZER_NAME = 'nori_wordcloud';

const SUBMISSIONS_SETTINGS: IndicesIndexSettings = {
  analysis: {
    analyzer: {
      [NORI_ANALYZER_NAME]: {
        type: 'custom',
        tokenizer: 'nori_tokenizer',
        filter: ['nori_part_of_speech', 'nori_readingform', 'lowercase'],
      },
    },
  },
};

const SUBMISSION_MAPPING: MappingTypeMapping = {
  properties: {
    formId: { type: 'keyword' },
    submissionId: { type: 'keyword' },
    submittedAt: { type: 'date' },
    externalId: { type: 'keyword' },
    source: { type: 'keyword' },
    schemaVersion: { type: 'integer' },
    respondentId: { type: 'keyword' },
    identityLevel: { type: 'keyword' },
    campaignId: { type: 'keyword' },
    revision: { type: 'integer' },
    // col1, col2 ... 처럼 폼별로 늘어나는 응답 컬럼 — 동적 매핑.
    data: { type: 'object', dynamic: true },
  },
  // dynamic_templates는 object 필드 안이 아니라 매핑 최상위에만 올 수 있다(ES 제약 —
  // object 내부에 넣으면 "unsupported parameters" 매핑 에러). path_match는 문서
  // 루트 기준 절대경로라 "data.*"로 써야 한다. data.* 아래 모든 문자열 필드에 .nori
  // 서브필드(형태소 분석 + fielddata 활성화)를 자동으로 붙여, 워드클라우드 집계(terms
  // agg)가 그 서브필드를 바로 쓸 수 있게 한다.
  dynamic_templates: [
    {
      korean_text_fields: {
        path_match: 'data.*',
        match_mapping_type: 'string',
        mapping: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword', ignore_above: 256 },
            nori: { type: 'text', analyzer: NORI_ANALYZER_NAME, fielddata: true },
          },
        },
      },
    },
  ],
};

const ANON_SUBMISSION_MAPPING = {
  properties: {
    anonId: { type: 'keyword' },
    formId: { type: 'keyword' },
    bucketAt: { type: 'date' },
    schemaVersion: { type: 'integer' },
    belowThreshold: { type: 'boolean' },
    campaignId: { type: 'keyword' },
    // 익명 문항 응답 — 폼별로 키가 달라지는 비정형 영역.
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
        [INDEX_NAMES.ANON_SUBMISSIONS, ANON_SUBMISSION_MAPPING],
      ] as const) {
        const exists = await elasticClient.indices.exists({ index });
        if (!exists) {
          const settings = index === INDEX_NAMES.SUBMISSIONS ? SUBMISSIONS_SETTINGS : undefined;
          await elasticClient.indices.create({ index, mappings, settings });
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

/**
 * 비슷한 양식지 템플릿 추천(데이터 정확성 §5 순위7, §3-4 표의 "적절" 두 항목 중 하나) —
 * 새 양식을 만들 때 제목·문항 라벨이 비슷한 기존 양식지를 찾아, 중복 제작을 줄인다.
 * 응답자 개인정보가 아니라 "양식지 구조"의 유사성이므로 개인정보 보호 제약이 없다 —
 * ES `more_like_this`로 즉석 계산하고(별도 저장소 불필요, 값 사전과 같은 원칙),
 * 제목이 짧은 경우가 많아 min_term_freq/min_doc_freq를 1로 낮춰야 결과가 나온다.
 */
export async function findSimilarFormTemplates(
  title: string,
  fieldLabels: string[],
  excludeFormId?: string,
  limit = 3
): Promise<Array<{ formId: string; title: string; description: string; fieldCount: number }>> {
  await ensureIndices();
  if (!title.trim() && fieldLabels.length === 0) return [];

  const should: object[] = [];
  if (title.trim()) {
    should.push({
      more_like_this: {
        fields: ['title', 'description'],
        like: [title],
        min_term_freq: 1,
        min_doc_freq: 1,
      },
    });
  }
  if (fieldLabels.length > 0) {
    should.push({
      more_like_this: {
        fields: ['fields.label'],
        like: [fieldLabels.join(' ')],
        min_term_freq: 1,
        min_doc_freq: 1,
      },
    });
  }

  const res = await elasticClient.search<FormTemplateDocument>({
    index: INDEX_NAMES.FORM_TEMPLATES,
    size: limit,
    query: {
      bool: {
        ...(excludeFormId ? { must_not: [{ term: { formId: excludeFormId } }] } : {}),
        should,
        minimum_should_match: 1,
      },
    },
  });

  return res.hits.hits
    .filter((h): h is typeof h & { _source: FormTemplateDocument } => !!h._source)
    .map((h) => ({
      formId: h._source.formId,
      title: h._source.title,
      description: h._source.description,
      fieldCount: Array.isArray(h._source.fields) ? h._source.fields.length : 0,
    }));
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

/**
 * 데이터 구조 관계도(정형 DB 옆에 비정형 DB도 함께 보여주기 위함)가 쓰는 실시간 문서 수.
 * Postgres 쪽 노드는 prisma의 `count()`로 재는 것과 대응되는, ES 쪽 카운트다.
 */
export async function getIndexDocCounts(): Promise<{ formTemplates: number; submissions: number; anonSubmissions: number }> {
  await ensureIndices();
  const [ft, sub, anon] = await Promise.all([
    elasticClient.count({ index: INDEX_NAMES.FORM_TEMPLATES }),
    elasticClient.count({ index: INDEX_NAMES.SUBMISSIONS }),
    elasticClient.count({ index: INDEX_NAMES.ANON_SUBMISSIONS }),
  ]);
  return { formTemplates: ft.count, submissions: sub.count, anonSubmissions: anon.count };
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

// ---------------------------------------------------------------------------
// 익명 제출(2단계) — 쓰기는 flush 배치에서만, 읽기는 집계 전용
// ---------------------------------------------------------------------------

/** flush 배치 전용 — 셔플된 익명 문서 묶음을 한 번에 적재한다. */
export async function bulkCreateAnonSubmissions(docs: AnonymousSubmissionDocument[]): Promise<void> {
  if (docs.length === 0) return;
  await ensureIndices();
  const operations = docs.flatMap((doc) => [
    { index: { _index: INDEX_NAMES.ANON_SUBMISSIONS, _id: doc.anonId } },
    doc,
  ]);
  const res = await elasticClient.bulk({ operations, refresh: 'wait_for' });
  if (res.errors) {
    const firstError = res.items.find((i) => i.index?.error)?.index?.error;
    throw new Error(`anon bulk index failed: ${firstError?.reason ?? 'unknown'}`);
  }
}

/**
 * 익명 응답 건수 — k-익명성 게이트의 판정 근거.
 * belowThreshold로 적재된 배치(마감 시 잔여분)는 애초에 공개 대상이 아니므로 제외한다.
 */
export async function countAnonSubmissions(formId: string, campaignId?: string): Promise<number> {
  await ensureIndices();
  const res = await elasticClient.count({
    index: INDEX_NAMES.ANON_SUBMISSIONS,
    query: {
      bool: {
        filter: [
          { term: { formId } },
          { term: { belowThreshold: false } },
          ...(campaignId ? [{ term: { campaignId } }] : []),
        ],
      },
    },
  });
  return res.count;
}

/**
 * 익명 문항 집계 — 개별 문서를 반환하는 함수는 의도적으로 만들지 않는다.
 * (선택지 문항: terms 집계 / 자유응답: 셔플된 값 목록)
 *
 * 자유응답 값 목록도 여기서 셔플해 반환한다 — 색인 순서조차 노출하지 않기 위함.
 */
export async function aggregateAnonField(
  formId: string,
  fieldId: string,
  campaignId?: string
): Promise<{ buckets: Array<{ key: string; count: number }> }> {
  await ensureIndices();
  const res = await elasticClient.search({
    index: INDEX_NAMES.ANON_SUBMISSIONS,
    size: 0,
    query: {
      bool: {
        filter: [
          { term: { formId } },
          { term: { belowThreshold: false } },
          ...(campaignId ? [{ term: { campaignId } }] : []),
        ],
      },
    },
    aggs: {
      values: {
        terms: { field: `data.${fieldId}.keyword`, size: 50, missing: '(무응답)' },
      },
    },
  });
  type Bucket = { key: string; doc_count: number };
  const agg = res.aggregations?.values as { buckets: Bucket[] } | undefined;
  return {
    buckets: (agg?.buckets ?? []).map((b) => ({ key: String(b.key), count: b.doc_count })),
  };
}

/** 자유응답 익명 문항 — 셔플된 값 배열만 반환(메타데이터 일절 없음). */
export async function listAnonFreeText(
  formId: string,
  fieldId: string,
  campaignId?: string,
  max = 500
): Promise<string[]> {
  await ensureIndices();
  const res = await elasticClient.search<AnonymousSubmissionDocument>({
    index: INDEX_NAMES.ANON_SUBMISSIONS,
    size: max,
    _source: [`data.${fieldId}`],
    query: {
      bool: {
        filter: [
          { term: { formId } },
          { term: { belowThreshold: false } },
          ...(campaignId ? [{ term: { campaignId } }] : []),
        ],
      },
    },
  });
  const values = res.hits.hits
    .map((h) => h._source?.data?.[fieldId])
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  // Fisher–Yates 셔플 — 반환 순서가 색인 순서를 암시하지 않게 한다.
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

/** 단건 제출 조회 — 사전 채움(prefill)이 직전 회차 응답을 읽을 때 사용한다. */
export async function getSubmission(
  formId: string,
  submissionId: string
): Promise<SubmissionDocument | null> {
  await ensureIndices();
  const res = await elasticClient
    .get<SubmissionDocument>({
      index: INDEX_NAMES.SUBMISSIONS,
      id: `${formId}__${submissionId}`,
    })
    .catch((err) => {
      if ((err as { meta?: { statusCode?: number } })?.meta?.statusCode === 404) return null;
      throw err;
    });
  return res?._source ?? null;
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

/**
 * 준식별자 조합별 건수 — 마스킹 계층의 k=1 레코드 판정에 쓰인다.
 *
 * 개별로는 무해한 항목(부서+직급+입사년도 등)도 조합하면 특정 인물로 좁혀질 수 있다.
 * 조합이 이 스코프(회차 또는 양식 전체) 안에서 한 건뿐이면 그 레코드는 사실상 실명과
 * 같으므로, 호출부(maskingService)가 해당 레코드 전체를 마스킹한다.
 *
 * fieldIds가 비어 있으면 판정할 것이 없으므로 빈 배열을 반환한다.
 */
export async function countQuasiIdentifierCombinations(
  formId: string,
  campaignId: string | undefined,
  fields: Array<{ id: string; type: string }>
): Promise<Array<{ key: Record<string, unknown>; count: number }>> {
  if (fields.length === 0) return [];
  await ensureIndices();

  // 필드 경로는 실제 ES 동적 매핑을 따라야 한다. 문자열 필드(select/radio/checkbox 등)는
  // dynamic text 매핑이라 .keyword 하위필드가 생기지만, number는 long으로, date는
  // (date_detection에 의해) date로 매핑되어 .keyword가 아예 존재하지 않는다.
  // 없는 경로를 참조하면 ES가 에러 없이 전부 null로 묶어버려 — 실제로 이렇게 나이(숫자)
  // 필드를 포함한 조합이 전원 같은 버킷(size=10)으로 합쳐져 k=1 판정이 통째로
  // 무력화되는 사고가 있었다. 타입별로 올바른 경로를 골라야 한다.
  const rawTypes = new Set(['number', 'date']);
  const sources = fields.map(({ id, type }) => ({
    [id]: {
      terms: { field: rawTypes.has(type) ? `data.${id}` : `data.${id}.keyword`, missing_bucket: true },
    },
  }));

  const res = await elasticClient.search({
    index: INDEX_NAMES.SUBMISSIONS,
    size: 0,
    query: {
      bool: {
        filter: [{ term: { formId } }, ...(campaignId ? [{ term: { campaignId } }] : [])],
      },
    },
    aggs: {
      combos: {
        // composite 집계 — 여러 필드의 조합별 건수를 한 번에 센다.
        composite: { size: 1000, sources },
      },
    },
  });

  type Bucket = { key: Record<string, unknown>; doc_count: number };
  const agg = res.aggregations?.combos as { buckets: Bucket[] } | undefined;
  return (agg?.buckets ?? []).map((b) => ({ key: b.key, count: b.doc_count }));
}

/**
 * 양식지 관계(온톨로지) 캔버스의 "연결 테스트"가 쓰는 원자료 — 한 문항의 값별 등장
 * 문서 수. 정규화(공백 제거·대소문자 등)는 이 함수가 아니라 호출부(formLinkService)에서
 * 적용한다 — 값 자체는 원본 그대로 가져와야 정규화 규칙을 토글할 때마다 재계산할 수 있다.
 */
export async function getFieldValueCounts(
  formId: string,
  fieldId: string,
  rawType: boolean
): Promise<Array<{ value: string; docCount: number }>> {
  await ensureIndices();
  const res = await elasticClient.search({
    index: INDEX_NAMES.SUBMISSIONS,
    size: 0,
    query: { bool: { filter: [{ term: { formId } }] } },
    aggs: {
      values: {
        terms: { field: rawType ? `data.${fieldId}` : `data.${fieldId}.keyword`, size: 5000 },
      },
    },
  });

  type Bucket = { key: string | number; doc_count: number };
  const agg = res.aggregations?.values as { buckets: Bucket[] } | undefined;
  return (agg?.buckets ?? []).map((b) => ({ value: String(b.key), docCount: b.doc_count }));
}

/** 전체 응답 수 — 연결 테스트의 k-게이트("응답이 너무 적어 계산할 수 없음") 판정용. */
export async function countFormSubmissions(formId: string): Promise<number> {
  await ensureIndices();
  const res = await elasticClient.count({ index: INDEX_NAMES.SUBMISSIONS, query: { term: { formId } } });
  return res.count;
}

/** 관계 캔버스 미리보기(최근 5건) — 특정 문항 값을 가진 제출 1건을 찾는다. */
export async function findSubmissionByFieldValue(
  formId: string,
  fieldId: string,
  rawType: boolean,
  value: string
): Promise<{ submissionId: string; submittedAt: string } | null> {
  await ensureIndices();
  const res = await elasticClient.search<SubmissionDocument>({
    index: INDEX_NAMES.SUBMISSIONS,
    size: 1,
    sort: [{ submittedAt: 'desc' }],
    query: {
      bool: {
        filter: [
          { term: { formId } },
          { term: { [rawType ? `data.${fieldId}` : `data.${fieldId}.keyword`]: value } },
        ],
      },
    },
  });
  const hit = res.hits.hits[0];
  if (!hit?._source) return null;
  return { submissionId: hit._source.submissionId, submittedAt: hit._source.submittedAt };
}

// ---------------------------------------------------------------------------
// 워드클라우드 — 한국어 형태소 분석(Nori) 집계
// ---------------------------------------------------------------------------

/**
 * 마스킹 대상이 아닌 폼의 자유서술 필드에 한해 쓰는 빠른 경로 — ES가 이미 색인 시점에
 * `.nori` 서브필드로 형태소 분석까지 마쳐 두었으므로, terms 집계 하나로 "이 단어가 등장한
 * 서로 다른 응답 수"(document frequency)를 그대로 얻는다. terms 집계의 버킷 doc_count는
 * 정확히 이 문서 수를 의미하므로 별도 계산이 필요 없다.
 *
 * ⚠️ 마스킹 대상 폼에는 이 함수를 쓰면 안 된다 — 원문이 색인된 그대로 집계되어 마스킹을
 * 우회하게 된다. 그 경우는 analyzeWithNori()로 마스킹 이후 텍스트만 토큰화해야 한다.
 */
export async function aggregateNoriWordFrequency(
  formIds: string[],
  fieldId: string,
  minDocCount: number,
  maxTerms: number
): Promise<Array<{ term: string; docCount: number }>> {
  if (formIds.length === 0) return [];
  await ensureIndices();

  const res = await elasticClient.search({
    index: INDEX_NAMES.SUBMISSIONS,
    size: 0,
    query: { bool: { filter: [{ terms: { formId: formIds } }] } },
    aggs: {
      words: {
        terms: {
          field: `data.${fieldId}.nori`,
          size: maxTerms,
          min_doc_count: minDocCount,
        },
      },
    },
  });

  type Bucket = { key: string; doc_count: number };
  const agg = res.aggregations?.words as { buckets: Bucket[] } | undefined;
  return (agg?.buckets ?? []).map((b) => ({ term: b.key, docCount: b.doc_count }));
}

/**
 * 색인된 문서가 아니라 **임의의 문자열**(마스킹 적용 후의 텍스트)을 같은 Nori 애널라이저로
 * 토큰화한다. `_analyze` API는 색인을 거치지 않으므로, 마스킹된 텍스트를 절대 ES에
 * 다시 쓰지 않고도(=마스킹 우회 없이) 같은 형태소 분석 품질을 얻을 수 있다.
 */
export async function analyzeWithNori(text: string): Promise<string[]> {
  if (!text.trim()) return [];
  const res = await elasticClient.indices.analyze({
    index: INDEX_NAMES.SUBMISSIONS,
    analyzer: NORI_ANALYZER_NAME,
    text,
  });
  return (res.tokens ?? []).map((t) => t.token);
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

/**
 * 값 사전 제안(데이터 정확성 §5 순위4) — 같은 문항에 과거 들어온 값들 중, 지금 입력 중인
 * 텍스트와 비슷한 값을 빈도순으로 찾는다. 별도 저장소 없이 이미 색인된 제출 데이터에
 * ES `fuzzy` 쿼리(편집거리 기반) + `terms` 집계로 즉석에서 계산한다
 * (docs/데이터품질-검증구간-설계.md §3-3 — "별도 저장소 불필요").
 */
export async function suggestFieldValues(
  formId: string,
  fieldId: string,
  query: string,
  limit = 6
): Promise<Array<{ value: string; count: number }>> {
  await ensureIndices();
  const res = await elasticClient.search({
    index: INDEX_NAMES.SUBMISSIONS,
    size: 0,
    query: {
      bool: {
        filter: [{ term: { formId } }],
        // prefix: 입력을 이어가는 중(예: "한국산" → "한국산업(주)")을 잡는다.
        // fuzzy: 오탈자가 섞인 거의 완성된 입력(예: "한국산업(주)"의 한 글자 오타)을 잡는다.
        // 둘은 서로 다른 상황을 겨냥하므로 OR로 묶는다 — 편집거리 하나만으로는 prefix
        // 케이스처럼 길이 차이가 큰 매칭을 잡지 못한다.
        should: [
          { prefix: { [`data.${fieldId}.keyword`]: { value: query } } },
          { fuzzy: { [`data.${fieldId}.keyword`]: { value: query, fuzziness: 'AUTO', prefix_length: 1 } } },
        ],
        minimum_should_match: 1,
      },
    },
    aggs: {
      values: { terms: { field: `data.${fieldId}.keyword`, size: limit + 1 } }, // +1은 자기 자신과 동일한 값을 거르고도 limit개가 남게 하기 위함
    },
  });
  type Bucket = { key: string; doc_count: number };
  const agg = res.aggregations?.values as { buckets: Bucket[] } | undefined;
  return (agg?.buckets ?? [])
    .map((b) => ({ value: String(b.key), count: b.doc_count }))
    .filter((b) => b.value && b.value.toLowerCase() !== query.trim().toLowerCase())
    .slice(0, limit);
}

/**
 * 군집 기반 제안(§3-4, "⚠️ 조건부 — 반드시 선택 UI") — 같은 부서 동료들이 이 문항에
 * 어떻게 답했는지 빈도순으로 찾는다. suggestFieldValues와 달리 전체가 아니라 특정
 * respondentId 집합(동료 코호트)으로 범위를 좁힌다. 호출부(valueSuggestionService)가
 * 코호트 크기에 최소 인원 기준을 적용해, 소수 인원의 답이 그대로 드러나지 않게 한다.
 */
export async function suggestFieldValuesForRespondents(
  formId: string,
  fieldId: string,
  respondentIds: string[],
  limit = 3
): Promise<Array<{ value: string; count: number }>> {
  if (respondentIds.length === 0) return [];
  await ensureIndices();
  const res = await elasticClient.search({
    index: INDEX_NAMES.SUBMISSIONS,
    size: 0,
    query: {
      bool: {
        filter: [{ term: { formId } }, { terms: { respondentId: respondentIds } }],
      },
    },
    aggs: {
      values: { terms: { field: `data.${fieldId}.keyword`, size: limit } },
    },
  });
  type Bucket = { key: string; doc_count: number };
  const agg = res.aggregations?.values as { buckets: Bucket[] } | undefined;
  return (agg?.buckets ?? []).filter((b) => b.key).map((b) => ({ value: String(b.key), count: b.doc_count }));
}


/**
 * 대시보드용 실제 집계 — 폼별 제출 문서 수와 최근 일자별 제출 수.
 *
 * `FormRegistry.submissionCount`는 비정규화 카운터라 재시드·수동 삭제 등으로 실제와
 * 어긋날 수 있다. 대시보드처럼 "지금 몇 건인가"를 보여주는 화면은 저장된 카운터가 아니라
 * 실제 문서 수를 세야 한다(집계 한 번이면 되므로 비용도 크지 않다).
 */
export async function aggregateSubmissionStats(days = 14): Promise<{
  total: number;
  byForm: Record<string, number>;
  daily: Array<{ date: string; count: number }>;
}> {
  await ensureIndices();
  const res = await elasticClient.search({
    index: INDEX_NAMES.SUBMISSIONS,
    size: 0,
    aggs: {
      byForm: { terms: { field: 'formId', size: 500 } },
      daily: {
        date_histogram: {
          field: 'submittedAt',
          calendar_interval: 'day',
          min_doc_count: 0,
          extended_bounds: { min: `now-${days}d/d`, max: 'now/d' },
        },
      },
    },
    query: { match_all: {} },
  });

  const total = typeof res.hits.total === 'number' ? res.hits.total : res.hits.total?.value ?? 0;
  type Bucket = { key: string | number; key_as_string?: string; doc_count: number };
  const byFormAgg = res.aggregations?.byForm as { buckets: Bucket[] } | undefined;
  const dailyAgg = res.aggregations?.daily as { buckets: Bucket[] } | undefined;

  const byForm: Record<string, number> = {};
  for (const b of byFormAgg?.buckets ?? []) byForm[String(b.key)] = b.doc_count;

  // 요청한 기간만 남긴다 — extended_bounds가 과거 데이터 범위까지 채울 수 있다.
  const daily = (dailyAgg?.buckets ?? [])
    .map((b) => ({ date: (b.key_as_string ?? '').slice(0, 10), count: b.doc_count }))
    .filter((d) => d.date)
    .slice(-days);

  return { total, byForm, daily };
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
