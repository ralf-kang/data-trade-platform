import { prisma } from '@/lib/db';
import {
  deleteFormTemplate,
  getFormTemplate,
  listFormTemplates,
  upsertFormTemplate,
} from '@/lib/elasticsearch';
import { logAudit } from '@/lib/services/auditService';
import type { FormField } from '@/components/builder/types';
import type { AdminUser } from '@/generated/prisma/client';

/**
 * 폼 하나를 두 저장소에서 합쳐서 내려주는 뷰 모델.
 *   - 정형(Postgres FormRegistry): status/소유자/배포URL/조회·제출 카운터
 *   - 비정형(Elasticsearch FormTemplateDocument): title/description/fields 구성
 */
export interface FormView {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  status: 'OPEN' | 'CLOSED';
  ownerName: string | null;
  deployUrl: string | null;
  viewCount: number;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
}

function toFormView(
  registry: {
    id: string;
    status: string;
    deployUrl: string | null;
    viewCount: number;
    submissionCount: number;
    createdAt: Date;
    updatedAt: Date;
    owner: { name: string } | null;
  },
  template: { title: string; description: string; fields: FormField[] }
): FormView {
  return {
    id: registry.id,
    title: template.title,
    description: template.description,
    fields: template.fields,
    status: registry.status as 'OPEN' | 'CLOSED',
    ownerName: registry.owner?.name ?? null,
    deployUrl: registry.deployUrl,
    viewCount: registry.viewCount,
    submissionCount: registry.submissionCount,
    createdAt: registry.createdAt.toISOString(),
    updatedAt: registry.updatedAt.toISOString(),
  };
}

export async function listForms(): Promise<FormView[]> {
  const [registries, templates] = await Promise.all([
    prisma.formRegistry.findMany({
      include: { owner: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    listFormTemplates(),
  ]);
  const templateById = new Map(templates.map((t) => [t.formId, t]));

  return registries
    .map((registry) => {
      const template = templateById.get(registry.id);
      if (!template) return null; // ES 문서가 아직 없는(정합성 깨진) registry row는 목록에서 제외
      return toFormView(registry, template);
    })
    .filter((v): v is FormView => v !== null);
}

export async function getForm(formId: string): Promise<FormView | null> {
  const [registry, template] = await Promise.all([
    prisma.formRegistry.findUnique({
      where: { id: formId },
      include: { owner: { select: { name: true } } },
    }),
    getFormTemplate(formId),
  ]);
  if (!registry || !template) return null;
  return toFormView(registry, template);
}

export interface CreateFormInput {
  id?: string;
  title: string;
  description: string;
  fields: FormField[];
}

export async function createForm(input: CreateFormInput, actor: AdminUser): Promise<FormView> {
  const id = input.id || `tpl-${Date.now()}`;
  const now = new Date().toISOString();

  await upsertFormTemplate({
    formId: id,
    title: input.title,
    description: input.description,
    fields: input.fields,
    createdAt: now,
    updatedAt: now,
  });

  const registry = await prisma.formRegistry.create({
    data: {
      id,
      status: 'OPEN',
      ownerId: actor.id,
      deployUrl: `/q/${id}`,
    },
    include: { owner: { select: { name: true } } },
  });

  await logAudit({
    userEmail: actor.email,
    action: 'FORM_CREATE',
    target: `Form [${id}]`,
    details: `신규 양식지 생성: ${input.title}`,
    formId: id,
  });

  return toFormView(registry, {
    title: input.title,
    description: input.description,
    fields: input.fields,
  });
}

export interface UpdateFormInput {
  title?: string;
  description?: string;
  fields?: FormField[];
}

export async function updateForm(
  formId: string,
  input: UpdateFormInput,
  actor: AdminUser
): Promise<FormView | null> {
  const existing = await getFormTemplate(formId);
  if (!existing) return null;

  const updated = {
    ...existing,
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    fields: input.fields ?? existing.fields,
    updatedAt: new Date().toISOString(),
  };
  await upsertFormTemplate(updated);

  const registry = await prisma.formRegistry.update({
    where: { id: formId },
    data: { updatedAt: new Date() },
    include: { owner: { select: { name: true } } },
  });

  await logAudit({
    userEmail: actor.email,
    action: 'FORM_UPDATE',
    target: `Form [${formId}]`,
    details: '필드/속성 변경',
    formId,
  });

  return toFormView(registry, updated);
}

export async function setFormStatus(
  formId: string,
  status: 'OPEN' | 'CLOSED',
  actor: AdminUser
): Promise<void> {
  await prisma.formRegistry.update({ where: { id: formId }, data: { status } });
  await logAudit({
    userEmail: actor.email,
    action: 'FORM_UPDATE',
    target: `Form [${formId}]`,
    details: status === 'OPEN' ? '배포 오픈으로 전환' : '배포 마감 처리',
    formId,
  });
}

export async function incrementFormView(formId: string): Promise<void> {
  await prisma.formRegistry
    .update({ where: { id: formId }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined); // 조회수 증가 실패는 조용히 무시 (비핵심 통계)
}

export async function deleteForm(formId: string, actor: AdminUser): Promise<void> {
  await Promise.all([
    deleteFormTemplate(formId),
    prisma.formRegistry.delete({ where: { id: formId } }).catch(() => undefined),
  ]);
  await logAudit({
    userEmail: actor.email,
    action: 'FORM_DELETE',
    target: `Form [${formId}]`,
    details: '양식지 삭제',
  });
}
