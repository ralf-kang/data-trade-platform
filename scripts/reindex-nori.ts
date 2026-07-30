/**
 * 워드클라우드 한국어 형태소 분석(Nori) 도입 재색인 스크립트.
 *
 * webreport-submissions 인덱스는 이미 데이터가 있는 상태로 운영 중일 수 있어, 커스텀
 * 애널라이저(analysis.analyzer)는 기존 인덱스에 바로 추가할 수 없다 — analyzer 설정은
 * 인덱스 생성 시점에만 정할 수 있다. 그래서 이 스크립트는:
 *   1) 올바른 설정(mecab-ko-wasm 폐기 후 채택한 analysis-nori, docs/워드클라우드-설계.md §5-2)을
 *      가진 새 물리 인덱스(webreport-submissions-nori)를 만들고
 *   2) 기존 인덱스의 문서를 그대로 재색인하고
 *   3) 기존 인덱스를 지운 뒤, 원래 이름(webreport-submissions)을 새 인덱스를 가리키는
 *      **별칭(alias)**으로 만든다.
 * 별칭으로 바꾸는 이유: 코드 전체가 INDEX_NAMES.SUBMISSIONS = 'webreport-submissions'라는
 * 이름을 그대로 참조하므로(src/lib/elasticsearch.ts 등 다수), 별칭을 쓰면 호출부를 단 한
 * 줄도 바꾸지 않고 물리 인덱스만 교체할 수 있다.
 *
 * 원본을 지우기 전에 재색인이 끝났는지 문서 수로 확인하고, 실패하면 중단한다 —
 * 재색인은 되돌리기 어려우므로 신중하게 진행한다.
 *
 * 실행: node --experimental-strip-types scripts/reindex-nori.ts
 */
import { Client as ElasticClient } from '@elastic/elasticsearch';
import type { MappingTypeMapping, IndicesIndexSettings } from '@elastic/elasticsearch/lib/api/types';

const es = new ElasticClient({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
  },
});

const OLD_INDEX = 'webreport-submissions';
const NEW_INDEX = 'webreport-submissions-nori';
const NORI_ANALYZER_NAME = 'nori_wordcloud';

// src/lib/elasticsearch.ts의 SUBMISSIONS_SETTINGS/SUBMISSION_MAPPING과 동일하게 유지할 것
// (이 스크립트는 strip-types 직접 실행이라 @/ 경로 별칭을 쓸 수 없어 사본을 둔다).
const SETTINGS: IndicesIndexSettings = {
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

const MAPPINGS: MappingTypeMapping = {
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
    data: { type: 'object', dynamic: true },
  },
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

async function main() {
  const existsAsAlias = await es.indices.existsAlias({ name: OLD_INDEX });
  if (existsAsAlias) {
    console.log(`[reindex-nori] ${OLD_INDEX}는 이미 별칭입니다 — 재색인이 이미 완료된 것으로 보고 종료합니다.`);
    return;
  }

  const oldExists = await es.indices.exists({ index: OLD_INDEX });
  if (!oldExists) {
    console.log(`[reindex-nori] ${OLD_INDEX} 인덱스가 없습니다 — ensureIndices()가 다음 부팅 시 Nori 설정으로 새로 만들 것입니다.`);
    return;
  }

  const newExists = await es.indices.exists({ index: NEW_INDEX });
  if (!newExists) {
    console.log(`[reindex-nori] ${NEW_INDEX} 생성 중...`);
    await es.indices.create({ index: NEW_INDEX, settings: SETTINGS, mappings: MAPPINGS });
  }

  console.log('[reindex-nori] 재색인 시작...');
  const reindexResult = await es.reindex({
    source: { index: OLD_INDEX },
    dest: { index: NEW_INDEX },
    refresh: true,
  });

  const oldCount = (await es.count({ index: OLD_INDEX })).count;
  const newCount = (await es.count({ index: NEW_INDEX })).count;
  console.log(`[reindex-nori] 원본 ${oldCount}건 / 재색인 ${newCount}건 (reindex API 보고 ${reindexResult.total}건)`);

  if (newCount < oldCount) {
    console.error('[reindex-nori] 재색인된 문서 수가 원본보다 적습니다 — 안전을 위해 원본 인덱스를 지우지 않고 중단합니다.');
    process.exitCode = 1;
    return;
  }

  console.log(`[reindex-nori] ${OLD_INDEX} 삭제 후 별칭으로 재생성...`);
  await es.indices.delete({ index: OLD_INDEX });
  await es.indices.putAlias({ index: NEW_INDEX, name: OLD_INDEX });

  console.log('[reindex-nori] 완료.');
}

main()
  .catch((err) => {
    console.error('[reindex-nori] 실패:', err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
