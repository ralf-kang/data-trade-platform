/**
 * 웹2 (서버실 출입통제 웹서비스 vistor-report) 입력 데이터를 웹1 (데이터 트레이드 플랫폼 data-trade-platform)로 마이그레이션하는 스크립트.
 * 
 * 실행: npx tsx scripts/migrate-vistor-data.ts
 */
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import pg from 'pg';

const web1Prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || 'postgresql://vistor_report_app:vistor_report_pass@192.168.0.20:5434/vistor_report_db' }),
});

const es = new ElasticClient({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
  },
});

const SUBMISSIONS_INDEX = 'webreport-submissions';
const FORM_TEMPLATES_INDEX = 'webreport-form-templates';

async function main() {
  console.log('=== Web2 -> Web1 데이터 마이그레이션 시작 ===');

  const web2DbUrl = process.env.VISTOR_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://vistor_report_app:vistor_report_pass@192.168.0.20:5434/vistor_report_db';
  console.log(`[migrate] Web2 DB 연결 중: ${web2DbUrl.replace(/:[^:@]+@/, ':****@')}`);

  const web2Pool = new pg.Pool({ connectionString: web2DbUrl });

  try {
    // 1. Web2 폼 정의 조회
    const formsRes = await web2Pool.query(`
      SELECT id, slug, title, version, is_active, requires_consent, created_at, updated_at
      FROM form_definitions
    `);
    console.log(`[migrate] Web2 폼 정의 ${formsRes.rows.length}개 발견`);

    for (const formRow of formsRes.rows) {
      const formId = formRow.slug;

      // 폼 필드 조회
      const fieldsRes = await web2Pool.query(`
        SELECT id, field_key, label, field_type, options, required, sort_order, fillable_by
        FROM form_fields
        WHERE form_id = $1
        ORDER BY sort_order ASC
      `, [formRow.id]);

      const fields = fieldsRes.rows.map((f: any) => ({
        id: f.field_key,
        type: f.field_type === 'regex-input' ? 'text' : f.field_type,
        label: f.label,
        required: f.required,
        fillableBy: f.fillable_by || 'guest',
        options: f.options,
      }));

      // Web1 FormRegistry 생성/업데이트
      await web1Prisma.formRegistry.upsert({
        where: { id: formId },
        update: {
          status: formRow.is_active ? 'OPEN' : 'CLOSED',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(formRow.created_at),
          schemaVersion: formRow.version || 1,
        },
        create: {
          id: formId,
          status: formRow.is_active ? 'OPEN' : 'CLOSED',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(formRow.created_at),
          schemaVersion: formRow.version || 1,
        },
      });

      // ES Form Template 업서트
      await es.index({
        index: FORM_TEMPLATES_INDEX,
        id: formId,
        document: {
          formId,
          title: formRow.title,
          description: `${formRow.title} (Web2 마이그레이션 양식지)`,
          fields,
          createdAt: formRow.created_at,
          updatedAt: formRow.updated_at,
        },
        refresh: 'wait_for',
      });

      // 2. 제출 데이터 마이그레이션
      const subsRes = await web2Pool.query(`
        SELECT id, form_version, created_at, status, reviewed_by, reviewed_at
        FROM submissions
        WHERE form_id = $1
      `, [formRow.id]);

      console.log(`[migrate] 폼 [${formId}] - 제출 기록 ${subsRes.rows.length}건 마이그레이션 진행`);

      let migratedCount = 0;
      for (const subRow of subsRes.rows) {
        const submissionId = subRow.id;

        // 제출 값 조회
        const valsRes = await web2Pool.query(`
          SELECT field_key, field_label, value_text, signature
          FROM submission_values
          WHERE submission_id = $1
        `, [submissionId]);

        const dataObj: Record<string, any> = {};
        for (const valRow of valsRes.rows) {
          if (valRow.signature) {
            dataObj[valRow.field_key] = `data:image/png;base64,${Buffer.from(valRow.signature).toString('base64')}`;
          } else {
            dataObj[valRow.field_key] = valRow.value_text;
          }
        }

        // ES 제출 데이터 적재
        await es.index({
          index: SUBMISSIONS_INDEX,
          id: `${formId}__${submissionId}`,
          document: {
            formId,
            submissionId,
            submittedAt: subRow.created_at,
            status: subRow.status || 'submitted',
            reviewedBy: subRow.reviewed_by || null,
            reviewedAt: subRow.reviewed_at || null,
            schemaVersion: subRow.form_version || 1,
            data: dataObj,
            migratedFrom: 'vistor-report',
          },
          refresh: 'wait_for',
        });

        migratedCount++;
      }

      // Web1 FormRegistry 제출 건수 업데이트
      await web1Prisma.formRegistry.update({
        where: { id: formId },
        data: { submissionCount: migratedCount },
      });

      console.log(`[migrate] 폼 [${formId}] 마이그레이션 완료: ${migratedCount}건 이관됨`);
    }

    console.log('=== Web2 -> Web1 데이터 마이그레이션 완료 ===');
  } catch (err) {
    console.error('[migrate] 오류 발생:', err);
  } finally {
    await web2Pool.end();
    await web1Prisma.$disconnect();
  }
}

main().catch(console.error);
