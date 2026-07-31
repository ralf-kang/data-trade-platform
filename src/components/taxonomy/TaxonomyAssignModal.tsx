'use client';

import { useState } from 'react';
import { X, FolderTree, Folder, Loader2 } from 'lucide-react';
import type { TreeNode } from './TreeEditor';

/** 트리를 평면 목록으로 펼친다 — 체크박스 목록은 계층을 들여쓰기로만 표현하면 충분하다. */
function flatten(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/**
 * 양식지 하나의 분류·폴더 배정 모달.
 * 두 축을 한 화면에서 다루되 **시각적으로 확실히 나눈다** — 하나는 전사 공통 어휘고
 * 다른 하나는 내 작업공간이라, 섞이면 "내가 만든 폴더가 전사에 보이나?" 하는 오해가 생긴다.
 */
export default function TaxonomyAssignModal({
  formTitle,
  categoryTree,
  folderTree,
  initialCategoryIds,
  initialFolderIds,
  canEditCategories,
  onClose,
  onSave,
}: {
  formTitle: string;
  categoryTree: TreeNode[];
  folderTree: TreeNode[];
  initialCategoryIds: string[];
  initialFolderIds: string[];
  canEditCategories: boolean;
  onClose: () => void;
  onSave: (categoryIds: string[], folderIds: string[]) => Promise<void>;
}) {
  const [categoryIds, setCategoryIds] = useState<Set<string>>(new Set(initialCategoryIds));
  const [folderIds, setFolderIds] = useState<Set<string>>(new Set(initialFolderIds));
  const [saving, setSaving] = useState(false);

  const toggle = (set: Set<string>, apply: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  };

  const flatCategories = flatten(categoryTree);
  const flatFolders = flatten(folderTree);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900">분류 지정</h3>
            <p className="text-xs text-slate-500 truncate">{formTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* 산업분야 — 전사 공통 */}
          <div className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <FolderTree className="w-4 h-4 text-indigo-600" />
              <h4 className="font-semibold text-slate-800 text-sm">산업분야 (전사 공통)</h4>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              {canEditCategories
                ? '모든 관리자에게 같은 이름으로 보입니다. 여러 개 선택할 수 있습니다.'
                : '이 양식지의 소유자 또는 슈퍼관리자만 변경할 수 있습니다.'}
            </p>
            {flatCategories.length === 0 ? (
              <p className="text-xs text-slate-400">등록된 산업분야가 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {flatCategories.map((c) => (
                  <li key={c.id} style={{ paddingLeft: c.depth * 14 }}>
                    <label
                      className={`flex items-center gap-2 text-sm py-0.5 ${
                        canEditCategories ? 'cursor-pointer text-slate-700' : 'text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!canEditCategories}
                        checked={categoryIds.has(c.id)}
                        onChange={() => toggle(categoryIds, setCategoryIds, c.id)}
                      />
                      {c.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 개인 폴더 — 나만 보임 */}
          <div className="p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <Folder className="w-4 h-4 text-amber-500" />
              <h4 className="font-semibold text-slate-800 text-sm">내 폴더 (나만 보임)</h4>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              내 목록을 정리하기 위한 폴더입니다. 다른 관리자에게는 보이지 않습니다.
            </p>
            {flatFolders.length === 0 ? (
              <p className="text-xs text-slate-400">
                아직 폴더가 없습니다. 목록 화면 왼쪽에서 폴더를 먼저 만들어주세요.
              </p>
            ) : (
              <ul className="space-y-1">
                {flatFolders.map((f) => (
                  <li key={f.id} style={{ paddingLeft: f.depth * 14 }}>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer py-0.5">
                      <input
                        type="checkbox"
                        checked={folderIds.has(f.id)}
                        onChange={() => toggle(folderIds, setFolderIds, f.id)}
                      />
                      {f.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            취소
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              try {
                await onSave([...categoryIds], [...folderIds]);
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
