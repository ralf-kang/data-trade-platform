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
  ownerId: string | null;
  ownerName: string | null;
  deployUrl: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  viewCount: number;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  lifecycle: 'DRAFT' | 'PUBLISHED';
  schemaVersion: number;
  publishedAt: string | null;
}

function toFormView(
  registry: {
    id: string;
    status: string;
    deployUrl: string | null;
    startsAt: Date | null;
    expiresAt: Date | null;
    lifecycle: string;
    schemaVersion: number;
    publishedAt: Date | null;
    viewCount: number;
    submissionCount: number;
    createdAt: Date;
    updatedAt: Date;
    ownerId: string | null;
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
    ownerId: registry.ownerId,
    ownerName: registry.owner?.name ?? null,
    deployUrl: registry.deployUrl,
    startsAt: registry.startsAt?.toISOString() ?? null,
    expiresAt: registry.expiresAt?.toISOString() ?? null,
    lifecycle: registry.lifecycle as 'DRAFT' | 'PUBLISHED',
    schemaVersion: registry.schemaVersion,
    publishedAt: registry.publishedAt?.toISOString() ?? null,
    viewCount: registry.viewCount,
    submissionCount: registry.submissionCount,
    createdAt: registry.createdAt.toISOString(),
    updatedAt: registry.updatedAt.toISOString(),
    active: isFormActiveNow({
      status: registry.status as 'OPEN' | 'CLOSED',
      startsAt: registry.startsAt?.toISOString() ?? null,
      expiresAt: registry.expiresAt?.toISOString() ?? null,
    }),
  };
}

/** 현재 시각 기준으로 이 폼이 (설정된 활성화 기간 안에서) 공개 응답을 받을 수 있는지. */
export function isFormActiveNow(form: {
  status: 'OPEN' | 'CLOSED';
  startsAt: string | null;
  expiresAt: string | null;
}): boolean {
  if (form.status !== 'OPEN') return false;
  const now = Date.now();
  if (form.startsAt && now < new Date(form.startsAt).getTime()) return false;
  if (form.expiresAt && now > new Date(form.expiresAt).getTime()) return false;
  return true;
}

/** 소유자 본인이거나 슈퍼관리자인지 (편집/삭제/기간설정 권한 판정용). */
export async function isOwnerOrSuperAdmin(formId: string, actor: AdminUser): Promise<boolean> {
  if (actor.role === 'SUPER_ADMIN') return true;
  const registry = await prisma.formRegistry.findUnique({ where: { id: formId }, select: { ownerId: true } });
  return registry?.ownerId === actor.id;
}

export async function listForms(opts: { ownerId?: string } = {}): Promise<FormView[]> {
  const [registries, templates] = await Promise.all([
    prisma.formRegistry.findMany({
      where: opts.ownerId ? { ownerId: opts.ownerId } : undefined,
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

export type DataAccessLevel = 'owner' | 'shared' | 'super-admin' | 'none';

/**
 * 데이터 허브(통합 조회) 화면 전용 — 각 양식지에 대해 현재 로그인한 관리자가
 * 제출 데이터를 조회할 권한이 있는지("owner"/"shared"/"super-admin"/"none")를 함께
 * 내려준다. 요구사항: "공유받은 양식지의 제출 데이터 조회 권한이 있는지 없는지에
 * 대한 조회는 제출데이터 통합 조회 화면에서 확인 할 수 있다."
 */
export async function listFormsWithAccess(
  actor: AdminUser
): Promise<Array<FormView & { dataAccess: DataAccessLevel }>> {
  const forms = await listForms();
  if (actor.role === 'SUPER_ADMIN') {
    return forms.map((f) => ({ ...f, dataAccess: 'super-admin' as const }));
  }
  // ShareRequest에서 fromUser = 권한을 요청/부여받는 쪽, toUser = 승인하는 소유자다.
  // 따라서 "내가 공유받은 양식"은 fromUserId로 찾아야 한다.
  const approvedShares = await prisma.shareRequest.findMany({
    where: { fromUserId: actor.id, status: 'APPROVED' },
    select: { formId: true },
  });
  const sharedFormIds = new Set(approvedShares.map((s) => s.formId));

  return forms.map((f) => ({
    ...f,
    dataAccess: f.ownerId === actor.id ? 'owner' : sharedFormIds.has(f.id) ? 'shared' : 'none',
  }));
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

  // 확정(PUBLISHED)된 양식지의 필드 구성이 바뀌면 외부 연동의 계약이 바뀐 것이므로
  // schemaVersion을 올린다 — 연동 측이 X-Form-Schema-Version으로 변경을 감지할 수 있다.
  // (제목/설명만 바뀐 경우는 계약에 영향이 없으므로 버전을 올리지 않는다.)
  const before = await prisma.formRegistry.findUniqueOrThrow({ where: { id: formId } });
  const fieldsChanged =
    input.fields !== undefined &&
    JSON.stringify(existing.fields) !== JSON.stringify(input.fields);
  const bumpVersion = before.lifecycle === 'PUBLISHED' && fieldsChanged;

  const registry = await prisma.formRegistry.update({
    where: { id: formId },
    data: {
      updatedAt: new Date(),
      ...(bumpVersion ? { schemaVersion: { increment: 1 } } : {}),
    },
    include: { owner: { select: { name: true } } },
  });

  if (bumpVersion) {
    await logAudit({
      userEmail: actor.email,
      action: 'FORM_SCHEMA_VERSION_BUMP',
      target: `Form [${formId}]`,
      details: `확정된 양식지의 필드 구성 변경 — 스키마 버전 v${before.schemaVersion} → v${registry.schemaVersion} (외부 연동 계약 변경)`,
      severity: 'warning',
      formId,
    });
  }

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

/**
 * 양식지 확정 상태 전환.
 *   DRAFT → PUBLISHED : 현재 필드 구성이 외부 연동 계약으로 확정되고 API 쓰기가 열린다.
 *   PUBLISHED → DRAFT : 설계 재작업 — 외부 입력이 즉시 차단된다(오적재 방지).
 */
export async function setFormLifecycle(
  formId: string,
  lifecycle: 'DRAFT' | 'PUBLISHED',
  actor: AdminUser
): Promise<FormView | null> {
  const registry = await prisma.formRegistry.update({
    where: { id: formId },
    data: {
      lifecycle,
      ...(lifecycle === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
    },
    include: { owner: { select: { name: true } } },
  });

  await logAudit({
    userEmail: actor.email,
    action: lifecycle === 'PUBLISHED' ? 'FORM_PUBLISH' : 'FORM_UNPUBLISH',
    target: `Form [${formId}]`,
    details:
      lifecycle === 'PUBLISHED'
        ? `양식지 확정 — 스키마 v${registry.schemaVersion}이 외부 연동 계약으로 고정되고 API 입력이 열림`
        : '양식지를 초안으로 되돌림 — 외부 API 입력 차단',
    severity: 'warning',
    formId,
  });

  const template = await getFormTemplate(formId);
  if (!template) return null;
  return toFormView(registry, template);
}

/** 슈퍼관리자 전용 — 양식지 소유권을 다른 관리자(또는 슈퍼관리자 자신)에게 이전한다. */
export async function changeFormOwner(
  formId: string,
  newOwnerId: string,
  actor: AdminUser
): Promise<void> {
  const [oldRegistry, newOwner] = await Promise.all([
    prisma.formRegistry.findUniqueOrThrow({ where: { id: formId }, include: { owner: true } }),
    prisma.adminUser.findUniqueOrThrow({ where: { id: newOwnerId } }),
  ]);
  await prisma.formRegistry.update({ where: { id: formId }, data: { ownerId: newOwnerId } });
  await logAudit({
    userEmail: actor.email,
    action: 'FORM_OWNERSHIP_TRANSFER',
    target: `Form [${formId}]`,
    details: `소유권 이전: ${oldRegistry.owner?.email ?? '(없음)'} → ${newOwner.email}`,
    severity: 'warning',
    formId,
  });
}

/** 양식지 활성화 기간 설정(선택) — /q/[id] 접근 가능 시간대를 제한한다. */
export async function setFormActivePeriod(
  formId: string,
  startsAt: Date | null,
  expiresAt: Date | null,
  actor: AdminUser
): Promise<void> {
  await prisma.formRegistry.update({ where: { id: formId }, data: { startsAt, expiresAt } });
  await logAudit({
    userEmail: actor.email,
    action: 'FORM_UPDATE',
    target: `Form [${formId}]`,
    details: `활성화 기간 설정: ${startsAt?.toISOString() ?? '제한없음'} ~ ${expiresAt?.toISOString() ?? '제한없음'}`,
    formId,
  });
}

/**
 * 제출 데이터(비정형)에 접근 가능한지 판정 — 요구사항: "관리자는 본인이 생성한 양식지에
 * 한하여 제출 데이터 조회가 가능하며, 다른 관리자에게 권한을 받지 않는 이상 불가능".
 * 슈퍼관리자는 항상 접근 가능, 소유자 본인, 또는 소유자로부터 승인(APPROVED)된 공유 요청이
 * 있는 경우에만 허용한다.
 */
export async function canAccessFormData(formId: string, actor: AdminUser): Promise<boolean> {
  if (actor.role === 'SUPER_ADMIN') return true;

  const registry = await prisma.formRegistry.findUnique({ where: { id: formId } });
  if (!registry) return false;
  if (registry.ownerId === actor.id) return true;

  // fromUser가 권한을 받는 쪽(요청자), toUser가 승인하는 소유자다 — 공유받은 사람은 fromUserId로 찾는다.
  const approvedShare = await prisma.shareRequest.findFirst({
    where: { formId, fromUserId: actor.id, status: 'APPROVED' },
  });
  return !!approvedShare;
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
