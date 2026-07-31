'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderTree, Info } from 'lucide-react';
import TreeEditor, { type TreeNode } from '@/components/taxonomy/TreeEditor';

/**
 * 산업분야 분류 관리 (슈퍼관리자 전용).
 * 이 트리는 전사 공통 어휘라 여기서만 편집된다 — 관리자는 배정만 할 수 있다.
 */
export default function FormCategoriesPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetch('/api/super-admin/form-categories')
      .then((r) => (r.ok ? r.json() : { tree: [] }))
      .then((j) => setTree(j.tree ?? []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const call = async (init: RequestInit & { url?: string }) => {
    setError(null);
    const res = await fetch(init.url ?? '/api/super-admin/form-categories', init);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.message ?? '처리에 실패했습니다.');
      return false;
    }
    await load();
    return true;
  };

  const totalAssigned = tree.reduce((max, n) => Math.max(max, n.totalCount), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <FolderTree className="w-7 h-7 text-indigo-600" />
              산업분야 분류 관리
            </h1>
            <p className="text-slate-500 mt-2">
              전사가 공통으로 쓰는 양식지 분류체계입니다. 여기서 정한 이름을 모두가 함께 쓰기 때문에
              부서를 넘어 비교·집계가 가능해집니다.
            </p>
          </div>
          <Link
            href="/super-admin"
            className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shrink-0"
          >
            대시보드
          </Link>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-xs text-indigo-800 flex items-start gap-2 mb-4">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            하나의 양식지가 <strong>여러 분야에 동시에</strong> 속할 수 있습니다. 그래서 분류별 건수를
            모두 더하면 전체 양식지 수보다 커질 수 있으며, 옆의 숫자는 합계가 아니라 각 분류에 배정된
            수로 읽어야 합니다. 하위 분류가 있는 항목은 삭제되지 않습니다 — 하위에 배정돼 있던
            양식지가 흔적 없이 미분류로 돌아가는 것을 막기 위함입니다.
          </span>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-2.5 text-sm text-rose-700 mb-4">{error}</div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {loading ? (
            <p className="text-sm text-slate-400">불러오는 중...</p>
          ) : (
            <TreeEditor
              tree={tree}
              onCreate={async (name, parentId) => {
                await call({
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, parentId }),
                });
              }}
              onRename={async (id, name) => {
                await call({
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id, name }),
                });
              }}
              onDelete={async (id) => {
                if (!confirm('이 분류를 삭제할까요? 배정돼 있던 양식지는 미분류가 됩니다.')) return;
                await call({ method: 'DELETE', url: `/api/super-admin/form-categories?id=${id}` });
              }}
            />
          )}
        </div>

        {!loading && tree.length > 0 && (
          <p className="text-xs text-slate-400 mt-3">
            최상위 {tree.length}개 · 가장 많이 쓰인 대분류 기준 {totalAssigned}건 배정됨
          </p>
        )}
      </div>
    </div>
  );
}
