import { prisma } from '@/lib/db';

/**
 * 양식지 분류 — 서로 독립된 두 축 (prisma/schema.prisma 주석 참고).
 *
 *   · 산업분야(category) : 전사 공통 어휘. 슈퍼관리자만 편집. 모두에게 보인다.
 *   · 개인 폴더(folder)  : 작업 편의. 각자 만들고 소유자에게만 보인다.
 *
 * 두 축 모두 다대다다 — 하나의 양식지가 여러 분야·폴더에 속할 수 있다.
 *
 * ⚠️ 다대다이므로 **분류별 건수의 합은 전체 건수를 넘을 수 있다.** 화면에서 합계를
 * "전체"로 읽으면 안 되며, 전체 수는 반드시 distinct로 따로 세야 한다.
 */

/** 트리가 너무 깊어지면 화면에서 읽을 수 없게 된다. 실무상 3단계면 충분하다. */
export const MAX_DEPTH = 4;

export interface TreeNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  depth: number;
  /** 이 노드에 직접 연결된 양식지 수(하위 노드 제외) */
  directCount: number;
  /** 이 노드와 모든 하위 노드에 연결된 양식지 수(중복 제거) */
  totalCount: number;
  children: TreeNode[];
}

interface FlatNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

/**
 * 평면 목록 + (노드id → 양식지id 집합)을 받아 트리를 만든다.
 * totalCount는 하위 노드까지 합치되 **양식지 id 집합의 합집합 크기**로 센다 —
 * 다대다라 같은 양식지가 부모·자식 양쪽에 붙어 있을 수 있어, 단순 덧셈은 중복 계산이 된다.
 */
function buildTree(flat: FlatNode[], formIdsByNode: Map<string, Set<string>>): TreeNode[] {
  const childrenOf = new Map<string | null, FlatNode[]>();
  for (const n of flat) {
    const key = n.parentId;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(n);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko'));
  }

  const build = (node: FlatNode, depth: number): { node: TreeNode; formIds: Set<string> } => {
    const own = formIdsByNode.get(node.id) ?? new Set<string>();
    const union = new Set(own);
    const children: TreeNode[] = [];
    for (const child of childrenOf.get(node.id) ?? []) {
      const built = build(child, depth + 1);
      children.push(built.node);
      for (const id of built.formIds) union.add(id);
    }
    return {
      node: {
        id: node.id,
        name: node.name,
        parentId: node.parentId,
        sortOrder: node.sortOrder,
        depth,
        directCount: own.size,
        totalCount: union.size,
        children,
      },
      formIds: union,
    };
  };

  return (childrenOf.get(null) ?? []).map((root) => build(root, 0).node);
}

/** 조상 id 목록(자기 자신 제외). 깊이 계산과 순환 방지에 쓴다. */
function ancestorsOf(id: string, byId: Map<string, FlatNode>): string[] {
  const out: string[] = [];
  let cur = byId.get(id)?.parentId ?? null;
  // 데이터가 이미 깨져 순환이 있어도 무한 루프에 빠지지 않도록 방문 집합을 둔다.
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    cur = byId.get(cur)?.parentId ?? null;
  }
  return out;
}

/**
 * 부모 변경이 안전한지 검사한다.
 * 자기 자신이나 자기 후손을 부모로 삼으면 트리에서 그 가지가 통째로 분리되어
 * 화면에서 영영 사라진다(순환은 렌더링에서 무한 재귀도 일으킨다).
 */
function assertMoveIsSafe(nodeId: string, newParentId: string | null, byId: Map<string, FlatNode>) {
  if (!newParentId) return;
  if (newParentId === nodeId) throw new Error('SELF_PARENT');
  if (ancestorsOf(newParentId, byId).includes(nodeId)) throw new Error('CYCLE');
  if (ancestorsOf(newParentId, byId).length + 2 > MAX_DEPTH) throw new Error('TOO_DEEP');
}

/**
 * 같은 부모 아래 같은 이름을 막는다.
 * DB의 복합 unique로 걸지 않는 이유: parentId가 nullable이고 Postgres는 NULL을 서로
 * 다른 값으로 취급해, 최상위 노드끼리는 unique 제약이 아예 작동하지 않는다.
 * (UserRole.scopeFormId에서 이미 같은 이유로 서비스 계층 검사를 쓰고 있다.)
 */
async function assertNameIsFree(
  kind: 'category' | 'folder',
  name: string,
  parentId: string | null,
  ownerId: string | null,
  excludeId?: string
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('EMPTY_NAME');

  const existing =
    kind === 'category'
      ? await prisma.formCategory.findFirst({ where: { name: trimmed, parentId } })
      : await prisma.formFolder.findFirst({ where: { name: trimmed, parentId, ownerId: ownerId! } });

  if (existing && existing.id !== excludeId) throw new Error('DUPLICATE_NAME');
}

// ---------------------------------------------------------------------------
// 산업분야 (슈퍼관리자 전용)
// ---------------------------------------------------------------------------

export async function listCategoryTree(): Promise<TreeNode[]> {
  const [nodes, assignments] = await Promise.all([
    prisma.formCategory.findMany({ select: { id: true, name: true, parentId: true, sortOrder: true } }),
    prisma.formCategoryAssignment.findMany({ select: { categoryId: true, formId: true } }),
  ]);
  const byNode = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (!byNode.has(a.categoryId)) byNode.set(a.categoryId, new Set());
    byNode.get(a.categoryId)!.add(a.formId);
  }
  return buildTree(nodes, byNode);
}

export async function createCategory(name: string, parentId: string | null) {
  const nodes = await prisma.formCategory.findMany({ select: { id: true, name: true, parentId: true, sortOrder: true } });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (parentId && ancestorsOf(parentId, byId).length + 2 > MAX_DEPTH) throw new Error('TOO_DEEP');
  await assertNameIsFree('category', name, parentId, null);

  const siblings = nodes.filter((n) => n.parentId === parentId);
  return prisma.formCategory.create({
    data: { name: name.trim(), parentId, sortOrder: siblings.length },
  });
}

export async function updateCategory(id: string, input: { name?: string; parentId?: string | null; sortOrder?: number }) {
  const nodes = await prisma.formCategory.findMany({ select: { id: true, name: true, parentId: true, sortOrder: true } });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const current = byId.get(id);
  if (!current) throw new Error('NOT_FOUND');

  const nextParent = input.parentId === undefined ? current.parentId : input.parentId;
  if (input.parentId !== undefined) assertMoveIsSafe(id, nextParent, byId);
  if (input.name !== undefined || input.parentId !== undefined) {
    await assertNameIsFree('category', input.name ?? current.name, nextParent, null, id);
  }

  return prisma.formCategory.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

/**
 * 하위 노드가 있으면 삭제를 거부한다. 하위를 함께 지우면 거기 분류돼 있던 양식지들이
 * 조용히 미분류로 돌아가, 지운 사람은 무엇을 잃었는지 알 수 없다.
 */
export async function deleteCategory(id: string) {
  const childCount = await prisma.formCategory.count({ where: { parentId: id } });
  if (childCount > 0) throw new Error('HAS_CHILDREN');
  await prisma.formCategory.delete({ where: { id } });
}

export async function setFormCategories(formId: string, categoryIds: string[], actorEmail: string) {
  await prisma.$transaction([
    prisma.formCategoryAssignment.deleteMany({ where: { formId } }),
    prisma.formCategoryAssignment.createMany({
      data: categoryIds.map((categoryId) => ({ formId, categoryId, assignedBy: actorEmail })),
      skipDuplicates: true,
    }),
  ]);
}

// ---------------------------------------------------------------------------
// 개인 폴더 (소유자 전용)
// ---------------------------------------------------------------------------

export async function listFolderTree(ownerId: string): Promise<TreeNode[]> {
  const nodes = await prisma.formFolder.findMany({
    where: { ownerId },
    select: { id: true, name: true, parentId: true, sortOrder: true },
  });
  const items = await prisma.formFolderItem.findMany({
    where: { folderId: { in: nodes.map((n) => n.id) } },
    select: { folderId: true, formId: true },
  });
  const byNode = new Map<string, Set<string>>();
  for (const i of items) {
    if (!byNode.has(i.folderId)) byNode.set(i.folderId, new Set());
    byNode.get(i.folderId)!.add(i.formId);
  }
  return buildTree(nodes, byNode);
}

export async function createFolder(ownerId: string, name: string, parentId: string | null) {
  const nodes = await prisma.formFolder.findMany({
    where: { ownerId },
    select: { id: true, name: true, parentId: true, sortOrder: true },
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // 남의 폴더를 부모로 지정해 트리를 가로지르지 못하게 한다.
  if (parentId && !byId.has(parentId)) throw new Error('NOT_FOUND');
  if (parentId && ancestorsOf(parentId, byId).length + 2 > MAX_DEPTH) throw new Error('TOO_DEEP');
  await assertNameIsFree('folder', name, parentId, ownerId);

  const siblings = nodes.filter((n) => n.parentId === parentId);
  return prisma.formFolder.create({
    data: { ownerId, name: name.trim(), parentId, sortOrder: siblings.length },
  });
}

export async function updateFolder(
  ownerId: string,
  id: string,
  input: { name?: string; parentId?: string | null; sortOrder?: number }
) {
  const nodes = await prisma.formFolder.findMany({
    where: { ownerId },
    select: { id: true, name: true, parentId: true, sortOrder: true },
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const current = byId.get(id);
  if (!current) throw new Error('NOT_FOUND');

  const nextParent = input.parentId === undefined ? current.parentId : input.parentId;
  if (input.parentId !== undefined) {
    if (nextParent && !byId.has(nextParent)) throw new Error('NOT_FOUND');
    assertMoveIsSafe(id, nextParent, byId);
  }
  if (input.name !== undefined || input.parentId !== undefined) {
    await assertNameIsFree('folder', input.name ?? current.name, nextParent, ownerId, id);
  }

  return prisma.formFolder.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

export async function deleteFolder(ownerId: string, id: string) {
  const folder = await prisma.formFolder.findFirst({ where: { id, ownerId } });
  if (!folder) throw new Error('NOT_FOUND');
  const childCount = await prisma.formFolder.count({ where: { parentId: id } });
  if (childCount > 0) throw new Error('HAS_CHILDREN');
  await prisma.formFolder.delete({ where: { id } });
}

export async function setFormFolders(ownerId: string, formId: string, folderIds: string[]) {
  // 소유자의 폴더만 허용 — 요청 본문을 그대로 믿으면 남의 폴더에 남의 양식을 꽂을 수 있다.
  const owned = await prisma.formFolder.findMany({
    where: { ownerId, id: { in: folderIds } },
    select: { id: true },
  });
  const allowed = new Set(owned.map((f) => f.id));

  await prisma.$transaction([
    prisma.formFolderItem.deleteMany({
      where: { formId, folder: { ownerId } },
    }),
    prisma.formFolderItem.createMany({
      data: folderIds.filter((id) => allowed.has(id)).map((folderId) => ({ folderId, formId })),
      skipDuplicates: true,
    }),
  ]);
}

// ---------------------------------------------------------------------------
// 조회 — 목록 화면이 쓰는 매핑
// ---------------------------------------------------------------------------

export interface FormTaxonomy {
  categoryIds: string[];
  folderIds: string[];
}

/** formId → 분류/폴더 매핑. 목록 화면에서 배지·필터에 쓴다. */
export async function getTaxonomyByForm(ownerId: string | null): Promise<Map<string, FormTaxonomy>> {
  const [assignments, items] = await Promise.all([
    prisma.formCategoryAssignment.findMany({ select: { formId: true, categoryId: true } }),
    ownerId
      ? prisma.formFolderItem.findMany({
          where: { folder: { ownerId } },
          select: { formId: true, folderId: true },
        })
      : Promise.resolve([] as Array<{ formId: string; folderId: string }>),
  ]);

  const map = new Map<string, FormTaxonomy>();
  const ensure = (formId: string) => {
    if (!map.has(formId)) map.set(formId, { categoryIds: [], folderIds: [] });
    return map.get(formId)!;
  };
  for (const a of assignments) ensure(a.formId).categoryIds.push(a.categoryId);
  for (const i of items) ensure(i.formId).folderIds.push(i.folderId);
  return map;
}

/** 하위 노드를 포함한 id 집합 — "제조업"을 고르면 그 아래 전부가 걸려야 한다. */
export function collectSubtreeIds(tree: TreeNode[], targetId: string): string[] {
  const found: string[] = [];
  const walk = (nodes: TreeNode[], inside: boolean) => {
    for (const n of nodes) {
      const nowInside = inside || n.id === targetId;
      if (nowInside) found.push(n.id);
      walk(n.children, nowInside);
    }
  };
  walk(tree, false);
  return found;
}
