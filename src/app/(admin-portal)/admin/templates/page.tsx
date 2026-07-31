'use client';

import { useEffect, useState } from 'react';
import { Copy, Edit3, Trash2, CheckCircle2, Circle, Users, Tags, FolderTree, X } from 'lucide-react';
import type { FormListItem, ShareRequestItem } from '@/lib/apiTypes';
import TreeEditor, { type TreeNode } from '@/components/taxonomy/TreeEditor';
import TaxonomyAssignModal from '@/components/taxonomy/TaxonomyAssignModal';
import HelpLink from '@/components/manual/HelpLink';

interface Taxonomy { categoryIds: string[]; folderIds: string[] }

/** 트리에서 특정 노드와 그 하위 id를 모두 모은다 — 상위를 고르면 하위도 함께 걸려야 한다. */
function subtreeIds(tree: TreeNode[], targetId: string): string[] {
  const out: string[] = [];
  const walk = (nodes: TreeNode[], inside: boolean) => {
    for (const n of nodes) {
      const now = inside || n.id === targetId;
      if (now) out.push(n.id);
      walk(n.children, now);
    }
  };
  walk(tree, false);
  return out;
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (l: TreeNode[]) => l.forEach((n) => { out.push(n); walk(n.children); });
  walk(nodes);
  return out;
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<FormListItem[]>([]);
  const [grantedShares, setGrantedShares] = useState<ShareRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 분류(전사 공통) / 폴더(개인) 두 축 — 서로 독립이므로 필터도 각각 둔다.
  const [categoryTree, setCategoryTree] = useState<TreeNode[]>([]);
  const [folderTree, setFolderTree] = useState<TreeNode[]>([]);
  const [taxonomyByForm, setTaxonomyByForm] = useState<Record<string, Taxonomy>>({});
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [filterFolderId, setFilterFolderId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<FormListItem | null>(null);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);

  const loadTaxonomy = () =>
    fetch('/api/forms/taxonomy')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setCategoryTree(j.categoryTree ?? []);
        setFolderTree(j.folderTree ?? []);
        setTaxonomyByForm(j.byForm ?? {});
      })
      .catch(() => undefined);

  const folderApi = async (init: RequestInit & { url?: string }) => {
    setTaxonomyError(null);
    const res = await fetch(init.url ?? '/api/form-folders', init);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setTaxonomyError(j.message ?? '처리에 실패했습니다.');
      return;
    }
    await loadTaxonomy();
  };

  // 목록 재조회(복사 후 새로고침 등 이벤트 핸들러 전용) — 로딩 상태를 다시 true로 보여준다.
  const reloadTemplates = () => {
    setLoading(true);
    fetch('/api/forms?mine=1')
      .then((res) => res.json())
      .then((json) => setTemplates(json.forms ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // 최초 마운트 시 loading 초기값이 이미 true이므로 다시 설정할 필요가 없다.
    Promise.all([
      fetch('/api/forms?mine=1').then((res) => res.json()),
      // "받은 요청(received)" = 내가 소유자로서 승인/대기 처리하는 요청 — 승인된 것은
      // 곧 "내가 다른 관리자에게 부여한 제출 데이터 조회 권한"이다.
      fetch('/api/share-requests').then((res) => (res.ok ? res.json() : { received: [] })),
    ])
      .then(([formsJson, shareJson]) => {
        setTemplates(formsJson.forms ?? []);
        const received: ShareRequestItem[] = shareJson.received ?? [];
        setGrantedShares(received.filter((r) => r.status === 'APPROVED'));
      })
      .finally(() => setLoading(false));
    loadTaxonomy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 필터 적용 — 상위 노드를 고르면 하위까지 포함한다.
  const visibleTemplates = templates.filter((t) => {
    const tax = taxonomyByForm[t.id];
    if (filterCategoryId) {
      const ids = new Set(subtreeIds(categoryTree, filterCategoryId));
      if (!tax?.categoryIds.some((id) => ids.has(id))) return false;
    }
    if (filterFolderId) {
      const ids = new Set(subtreeIds(folderTree, filterFolderId));
      if (!tax?.folderIds.some((id) => ids.has(id))) return false;
    }
    return true;
  });

  const categoryNameById = new Map(flattenTree(categoryTree).map((n) => [n.id, n.name]));
  const folderNameById = new Map(flattenTree(folderTree).map((n) => [n.id, n.name]));

  const [showCloneModal, setShowCloneModal] = useState(false);
  const [selectedTemplateForClone, setSelectedTemplateForClone] = useState<FormListItem | null>(null);
  const [selectedFieldsToClone, setSelectedFieldsToClone] = useState<Set<string>>(new Set());
  const [cloning, setCloning] = useState(false);

  const openCloneModal = (template: FormListItem) => {
    setSelectedTemplateForClone(template);
    setSelectedFieldsToClone(new Set(template.fields?.map((f) => f.id) || [])); // Default: select all
    setShowCloneModal(true);
  };

  const toggleFieldClone = (fieldId: string) => {
    const newSet = new Set(selectedFieldsToClone);
    if (newSet.has(fieldId)) {
      newSet.delete(fieldId);
    } else {
      newSet.add(fieldId);
    }
    setSelectedFieldsToClone(newSet);
  };

  const handleCloneSubmit = async () => {
    if (!selectedTemplateForClone) return;
    setCloning(true);
    try {
      // Partial Clone Logic — 선택된 필드만 새 id로 복사
      const fieldsToCopy =
        selectedTemplateForClone.fields
          ?.filter((f) => selectedFieldsToClone.has(f.id))
          .map((f) => ({ ...f, id: crypto.randomUUID() })) || [];

      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${selectedTemplateForClone.title} (복사본)`,
          description: selectedTemplateForClone.description,
          fields: fieldsToCopy,
        }),
      });
      if (!res.ok) {
        alert('복사에 실패했습니다.');
        return;
      }
      setShowCloneModal(false);
      reloadTemplates();
    } finally {
      setCloning(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 양식을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/forms/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('삭제에 실패했습니다.');
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">내 템플릿 관리</h1>
            <p className="text-gray-500 mt-2">내가 소유한 양식만 표시됩니다. 관리하고 복사하여 새로운 양식을 만들 수 있습니다.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <HelpLink />
            <a href="/admin/builder" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700">
              + 새 양식 만들기 (빈 양식)
            </a>
          </div>
        </div>

        {taxonomyError && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-2.5 text-sm text-rose-700 mb-4">{taxonomyError}</div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
        {/* 좌측: 두 축의 필터. 전사 공통(산업분야)과 개인(폴더)을 시각적으로 분리한다. */}
        <aside className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <FolderTree className="w-4 h-4 text-indigo-600" />
              <h2 className="font-bold text-slate-800 text-sm">산업분야</h2>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">전사 공통 · 슈퍼관리자가 관리</p>
            {filterCategoryId && (
              <button onClick={() => setFilterCategoryId(null)} className="text-[11px] text-indigo-600 hover:underline mb-2 flex items-center gap-0.5">
                <X className="w-3 h-3" /> 필터 해제
              </button>
            )}
            <TreeEditor tree={categoryTree} readOnly selectedId={filterCategoryId} onSelect={setFilterCategoryId} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Tags className="w-4 h-4 text-amber-500" />
              <h2 className="font-bold text-slate-800 text-sm">내 폴더</h2>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">나만 보임 · 자유롭게 만들 수 있음</p>
            {filterFolderId && (
              <button onClick={() => setFilterFolderId(null)} className="text-[11px] text-indigo-600 hover:underline mb-2 flex items-center gap-0.5">
                <X className="w-3 h-3" /> 필터 해제
              </button>
            )}
            <TreeEditor
              tree={folderTree}
              selectedId={filterFolderId}
              onSelect={setFilterFolderId}
              onCreate={async (name, parentId) => {
                await folderApi({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parentId }) });
              }}
              onRename={async (id, name) => {
                await folderApi({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }) });
              }}
              onDelete={async (id) => {
                if (!confirm('이 폴더를 삭제할까요? 안에 있던 양식지는 삭제되지 않고 폴더에서만 빠집니다.')) return;
                await folderApi({ method: 'DELETE', url: `/api/form-folders?id=${id}` });
              }}
            />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">양식 제목</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">분류</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">필드 수</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">생성일</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리/작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">불러오는 중...</td>
                </tr>
              )}
              {!loading && templates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">등록된 양식이 없습니다.</td>
                </tr>
              )}
              {visibleTemplates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{template.title}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 min-w-[150px] max-w-[240px]">
                      {(taxonomyByForm[template.id]?.categoryIds ?? []).map((id) => (
                        <span key={id} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                          {categoryNameById.get(id) ?? '—'}
                        </span>
                      ))}
                      {(taxonomyByForm[template.id]?.folderIds ?? []).map((id) => (
                        <span key={id} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                          {folderNameById.get(id) ?? '—'}
                        </span>
                      ))}
                      {!taxonomyByForm[template.id]?.categoryIds.length &&
                        !taxonomyByForm[template.id]?.folderIds.length && (
                          <span className="text-[11px] text-slate-300 whitespace-nowrap">미분류</span>
                        )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {template.fields?.length || 0}개
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {template.createdAt.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                    <div className="flex justify-end space-x-3">
                      <button onClick={() => setAssignTarget(template)} className="text-slate-600 hover:text-slate-900 flex items-center" title="산업분야·폴더 지정">
                        <Tags className="w-4 h-4 mr-1" /> 분류
                      </button>
                      <button onClick={() => openCloneModal(template)} className="text-indigo-600 hover:text-indigo-900 flex items-center" title="이 양식을 기반으로 복사">
                        <Copy className="w-4 h-4 mr-1" /> 복사(Clone)
                      </button>
                      <a href={`/admin/builder?id=${template.id}`} className="text-blue-600 hover:text-blue-900 flex items-center">
                        <Edit3 className="w-4 h-4 mr-1" /> 편집
                      </a>
                      <button onClick={() => handleDelete(template.id)} className="text-red-600 hover:text-red-900 flex items-center">
                        <Trash2 className="w-4 h-4 mr-1" /> 삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filterCategoryId || filterFolderId ? (
          <p className="text-xs text-slate-400 mt-2">
            필터 적용 중 — 전체 {templates.length}건 중 {visibleTemplates.length}건 표시
          </p>
        ) : null}

        {/* 내가 부여한 공유(제출 데이터 조회) 권한 — 요구사항: "다른 관리자에게 내가 준
            권한은 내 양식지 관리 화면에서 조회 할 수 있어야 한다." */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center">
            <Users className="w-5 h-5 mr-2 text-indigo-600" />
            <h2 className="font-bold text-gray-900">내가 부여한 제출 데이터 조회 권한</h2>
          </div>
          {grantedShares.length === 0 ? (
            <div className="px-6 py-6 text-center text-gray-400 text-sm">부여한 공유 권한이 없습니다.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {grantedShares.map((s) => (
                <li key={s.id} className="px-6 py-3 flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    <strong className="text-gray-900">{s.fromUser.name}</strong>({s.fromUser.email}) 님에게 양식 <span className="font-mono text-indigo-600">{s.formId}</span> 조회 권한 부여
                  </span>
                  <span className="text-gray-400">{s.createdAt.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>
        </div>

        {/* Partial Clone Modal */}
        {showCloneModal && selectedTemplateForClone && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">양식 복사 (Partial Clone)</h2>
                <p className="text-sm text-gray-500 mt-1">원본 양식 전체를 복사하거나, 필요한 특정 필드만 골라서 복사할 수 있습니다.</p>
              </div>

              <div className="p-6 flex-1 overflow-y-auto bg-gray-50">
                <div className="mb-4">
                  <span className="font-semibold text-gray-700">원본 템플릿: </span>
                  <span className="text-indigo-700">{selectedTemplateForClone.title}</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-3 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                    <span className="font-medium text-gray-700 text-sm">복사할 필드 선택</span>
                    <button
                      onClick={() => {
                        const allFieldIds = selectedTemplateForClone.fields?.map(f => f.id) || [];
                        setSelectedFieldsToClone(selectedFieldsToClone.size === allFieldIds.length ? new Set() : new Set(allFieldIds));
                      }}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      전체 선택/해제
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {selectedTemplateForClone.fields?.map((field) => {
                      const isSelected = selectedFieldsToClone.has(field.id);
                      return (
                        <div
                          key={field.id}
                          onClick={() => toggleFieldClone(field.id)}
                          className={`p-3 flex items-center space-x-3 cursor-pointer hover:bg-indigo-50 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}
                        >
                          {isSelected ? (
                            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-300" />
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{field.label}</div>
                            <div className="text-xs text-gray-500">타입: {field.type} {field.required ? '(필수)' : '(선택)'}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 bg-white">
                <button
                  onClick={() => setShowCloneModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleCloneSubmit}
                  disabled={selectedFieldsToClone.size === 0 || cloning}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cloning ? '복사 중...' : `선택한 ${selectedFieldsToClone.size}개 필드로 복사본 생성`}
                </button>
              </div>
            </div>
          </div>
        )}

        {assignTarget && (
          <TaxonomyAssignModal
            formTitle={assignTarget.title}
            categoryTree={categoryTree}
            folderTree={folderTree}
            initialCategoryIds={taxonomyByForm[assignTarget.id]?.categoryIds ?? []}
            initialFolderIds={taxonomyByForm[assignTarget.id]?.folderIds ?? []}
            canEditCategories
            onClose={() => setAssignTarget(null)}
            onSave={async (categoryIds, folderIds) => {
              const res = await fetch('/api/forms/taxonomy', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formId: assignTarget.id, categoryIds, folderIds }),
              });
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                setTaxonomyError(j.message ?? '분류 저장에 실패했습니다.');
                return;
              }
              await loadTaxonomy();
            }}
          />
        )}
      </div>
    </div>
  );
}
