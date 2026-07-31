'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Pencil, Check, X, Folder, FolderOpen } from 'lucide-react';

export interface TreeNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  depth: number;
  directCount: number;
  totalCount: number;
  children: TreeNode[];
}

/**
 * 분류/폴더 트리 편집기 — 산업분야(슈퍼관리자)와 개인 폴더(관리자) 양쪽이 같이 쓴다.
 * 두 축은 소유·권한만 다르고 조작 방식은 같으므로 화면을 따로 만들 이유가 없다.
 *
 * 건수 표시는 `directCount`(이 노드에 직접 붙은 수)와 `totalCount`(하위 포함, 중복 제거)를
 * 구분해 보여준다 — 다대다라 단순 합산이 전체 수를 넘기 때문이다.
 */
export default function TreeEditor({
  tree,
  maxDepth = 4,
  readOnly = false,
  onCreate,
  onRename,
  onDelete,
  onSelect,
  selectedId,
}: {
  tree: TreeNode[];
  maxDepth?: number;
  readOnly?: boolean;
  onCreate?: (name: string, parentId: string | null) => Promise<void>;
  onRename?: (id: string, name: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onSelect?: (id: string | null) => void;
  selectedId?: string | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingUnder, setAddingUnder] = useState<string | null | undefined>(undefined);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submitCreate = async (parentId: string | null) => {
    if (!draft.trim() || !onCreate) return;
    setBusy(true);
    try {
      await onCreate(draft, parentId);
      setDraft('');
      setAddingUnder(undefined);
      if (parentId) setExpanded((p) => new Set(p).add(parentId));
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async (id: string) => {
    if (!draft.trim() || !onRename) return;
    setBusy(true);
    try {
      await onRename(id, draft);
      setRenamingId(null);
      setDraft('');
    } finally {
      setBusy(false);
    }
  };

  const renderNode = (node: TreeNode) => {
    const isOpen = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedId === node.id;
    const canAddChild = !readOnly && node.depth + 2 <= maxDepth;

    return (
      <li key={node.id}>
        <div
          className={`group flex items-center gap-1 rounded-lg pr-2 ${
            isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
          }`}
          style={{ paddingLeft: node.depth * 16 }}
        >
          <button
            onClick={() => toggle(node.id)}
            className={`p-1 text-slate-400 shrink-0 ${hasChildren ? 'hover:text-slate-600' : 'invisible'}`}
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {renamingId === node.id ? (
            <div className="flex items-center gap-1 flex-1 py-1">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename(node.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="flex-1 px-2 py-1 border border-indigo-300 rounded text-sm"
              />
              <button onClick={() => submitRename(node.id)} disabled={busy} className="p-1 text-emerald-600">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setRenamingId(null)} className="p-1 text-slate-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => onSelect?.(isSelected ? null : node.id)}
                className="flex items-center gap-1.5 flex-1 text-left py-1.5 min-w-0"
              >
                {isOpen && hasChildren ? (
                  <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span className={`text-sm truncate ${isSelected ? 'text-indigo-700 font-medium' : 'text-slate-700'}`}>
                  {node.name}
                </span>
                <span className="text-[11px] text-slate-400 shrink-0" title="이 분류에 직접 배정된 수 / 하위 포함(중복 제거)">
                  {node.directCount}
                  {node.totalCount !== node.directCount && ` (하위포함 ${node.totalCount})`}
                </span>
              </button>

              {!readOnly && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {canAddChild && (
                    <button
                      onClick={() => {
                        setAddingUnder(node.id);
                        setDraft('');
                        setExpanded((p) => new Set(p).add(node.id));
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-600"
                      title="하위 추가"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setRenamingId(node.id);
                      setDraft(node.name);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-600"
                    title="이름 변경"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete?.(node.id)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {addingUnder === node.id && (
          <div className="flex items-center gap-1 py-1" style={{ paddingLeft: (node.depth + 1) * 16 + 24 }}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreate(node.id);
                if (e.key === 'Escape') setAddingUnder(undefined);
              }}
              placeholder="새 하위 이름"
              className="flex-1 px-2 py-1 border border-indigo-300 rounded text-sm"
            />
            <button onClick={() => submitCreate(node.id)} disabled={busy} className="p-1 text-emerald-600">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setAddingUnder(undefined)} className="p-1 text-slate-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isOpen && hasChildren && <ul>{node.children.map(renderNode)}</ul>}
      </li>
    );
  };

  return (
    <div>
      <ul className="space-y-0.5">{tree.map(renderNode)}</ul>

      {!readOnly && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          {addingUnder === null ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreate(null);
                  if (e.key === 'Escape') setAddingUnder(undefined);
                }}
                placeholder="새 최상위 이름"
                className="flex-1 px-2 py-1 border border-indigo-300 rounded text-sm"
              />
              <button onClick={() => submitCreate(null)} disabled={busy} className="p-1 text-emerald-600">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setAddingUnder(undefined)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setAddingUnder(null);
                setDraft('');
              }}
              className="w-full flex items-center justify-center gap-1 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
            >
              <Plus className="w-3.5 h-3.5" /> 최상위 추가
            </button>
          )}
        </div>
      )}

      {tree.length === 0 && readOnly && <p className="text-sm text-slate-400 py-4 text-center">아직 없습니다.</p>}
    </div>
  );
}
