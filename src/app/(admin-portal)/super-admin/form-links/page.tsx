'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Network, Search, ShieldAlert, X , ChevronDown, ChevronRight} from 'lucide-react';

interface FieldOption {
  id: string;
  label: string;
  type: string;
  personalIdentifier: boolean;
}

interface FormOption {
  formId: string;
  title: string;
  fields: FieldOption[];
  categoryIds?: string[];
}

interface CategoryNode {
  id: string;
  name: string;
  depth: number;
  children: CategoryNode[];
}

interface CardState {
  formId: string;
  title: string;
  fields: FieldOption[];
  x: number;
  y: number;
}

interface ConnectionTestResult {
  blocked: boolean;
  blockedReason?: 'BELOW_K' | 'ANONYMOUS_FIELD';
  leftUniqueCount?: number;
  rightUniqueCount?: number;
  intersectionCount?: number;
  leftOnlyCount?: number;
  rightOnlyCount?: number;
  leftContainmentPct?: number;
  rightContainmentPct?: number;
  suggestedCardinality?: string;
  isPersonalKey: boolean;
}

interface EdgeState {
  id: string;
  leftFormId: string;
  leftFieldId: string;
  rightFormId: string;
  rightFieldId: string;
  normalization: Record<string, boolean>;
  result: ConnectionTestResult | null;
  testing: boolean;
}

const CARD_WIDTH = 220;
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 32;

const NORMALIZATION_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'trim', label: '앞뒤/중복 공백 제거' },
  { key: 'stripSeparators', label: '하이픈·구분자 제거' },
  { key: 'lowercase', label: '대소문자 통일' },
  { key: 'stripLeadingZero', label: '선행 0 무시' },
  { key: 'nfc', label: '한글 자모 정규화(NFC)' },
];

function fieldAnchor(card: CardState, fieldIndex: number): { x: number; y: number } {
  return { x: card.x + CARD_WIDTH / 2, y: card.y + HEADER_HEIGHT + fieldIndex * ROW_HEIGHT + ROW_HEIGHT / 2 };
}

export default function FormLinksCanvasPage() {
  const [consentChecked, setConsentChecked] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const [allForms, setAllForms] = useState<FormOption[]>([]);
  // 산업분야 필터 — 양식지가 많아지면 제목 검색만으로는 툴박스에서 찾기 어렵다.
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [cards, setCards] = useState<CardState[]>([]);
  const [edges, setEdges] = useState<EdgeState[]>([]);
  const [pendingField, setPendingField] = useState<{ formId: string; fieldId: string } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ rows: Array<{ leftValue: string; rightValue: string }>; blocked: boolean; reason?: string } | null>(null);

  const dragCard = useRef<{ formId: string; offsetX: number; offsetY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/super-admin/ontology-consent')
      .then((r) => (r.ok ? r.json() : { consentedAt: null }))
      .then((j) => {
        setShowConsentModal(!j.consentedAt);
        setConsentChecked(true);
      });
    fetch('/api/super-admin/form-links/forms')
      .then((r) => (r.ok ? r.json() : { forms: [] }))
      .then((j) => {
        setAllForms(j.forms ?? []);
        setCategoryTree(j.categoryTree ?? []);
      });
  }, []);

  const handleAckConsent = async () => {
    await fetch('/api/super-admin/ontology-consent', { method: 'POST' });
    setShowConsentModal(false);
  };

  // 상위 분류를 고르면 하위까지 포함해야 한다.
  const subtreeIds = (nodes: CategoryNode[], target: string): string[] => {
    const out: string[] = [];
    const walk = (list: CategoryNode[], inside: boolean) => {
      for (const n of list) {
        const now = inside || n.id === target;
        if (now) out.push(n.id);
        walk(n.children, now);
      }
    };
    walk(nodes, false);
    return out;
  };
  const flatCategories = (() => {
    const out: CategoryNode[] = [];
    const walk = (l: CategoryNode[]) => l.forEach((n) => { out.push(n); walk(n.children); });
    walk(categoryTree);
    return out;
  })();

  const filteredForms = allForms.filter((f) => {
    if (!f.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter) {
      const ids = new Set(subtreeIds(categoryTree, categoryFilter));
      if (!(f.categoryIds ?? []).some((id) => ids.has(id))) return false;
    }
    return true;
  });

  // 최상위 산업분야로 묶는다 — 하위까지 각각 그룹으로 만들면 그룹이 너무 잘게 쪼개져
  // 오히려 훑어보기 어려워진다. 어디에도 속하지 않은 것은 "미분류"로 모은다.
  const groupedForms = (() => {
    const topLevel = categoryTree;
    const idToTop = new Map<string, { id: string; name: string }>();
    const mark = (nodes: CategoryNode[], top: { id: string; name: string }) => {
      for (const n of nodes) {
        idToTop.set(n.id, top);
        mark(n.children, top);
      }
    };
    for (const t of topLevel) mark([t], { id: t.id, name: t.name });

    const buckets = new Map<string, { key: string; name: string; forms: FormOption[] }>();
    const ensure = (key: string, name: string) => {
      if (!buckets.has(key)) buckets.set(key, { key, name, forms: [] });
      return buckets.get(key)!;
    };
    for (const t of topLevel) ensure(t.id, t.name);

    for (const f of filteredForms) {
      const tops = new Set((f.categoryIds ?? []).map((id) => idToTop.get(id)).filter(Boolean).map((t) => t!.id));
      if (tops.size === 0) {
        ensure('__none__', '미분류').forms.push(f);
      } else {
        // 여러 분야에 걸친 양식지는 각 그룹에 모두 나타난다(다대다이므로).
        for (const topId of tops) {
          const top = topLevel.find((t) => t.id === topId);
          if (top) ensure(top.id, top.name).forms.push(f);
        }
      }
    }
    return [...buckets.values()].filter((b) => b.forms.length > 0);
  })();

  const addCard = (form: FormOption) => {
    if (cards.some((c) => c.formId === form.formId)) return;
    setCards((prev) => [
      ...prev,
      { formId: form.formId, title: form.title, fields: form.fields, x: 40 + prev.length * 40, y: 40 + prev.length * 30 },
    ]);
  };

  const handleFieldClick = (formId: string, fieldId: string) => {
    if (!pendingField) {
      setPendingField({ formId, fieldId });
      return;
    }
    if (pendingField.formId === formId && pendingField.fieldId === fieldId) {
      setPendingField(null);
      return;
    }
    if (pendingField.formId === formId) {
      setPendingField({ formId, fieldId });
      return;
    }
    const edgeId = `${pendingField.formId}:${pendingField.fieldId}__${formId}:${fieldId}`;
    const newEdge: EdgeState = {
      id: edgeId,
      leftFormId: pendingField.formId,
      leftFieldId: pendingField.fieldId,
      rightFormId: formId,
      rightFieldId: fieldId,
      normalization: { trim: true },
      result: null,
      testing: true,
    };
    setEdges((prev) => [...prev.filter((e) => e.id !== edgeId), newEdge]);
    setPendingField(null);
    setSelectedEdgeId(edgeId);
    runTest(newEdge);
  };

  const runTest = async (edge: EdgeState) => {
    setEdges((prev) => prev.map((e) => (e.id === edge.id ? { ...e, testing: true } : e)));
    const res = await fetch('/api/super-admin/form-links/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leftFormId: edge.leftFormId,
        leftFieldId: edge.leftFieldId,
        rightFormId: edge.rightFormId,
        rightFieldId: edge.rightFieldId,
        normalization: edge.normalization,
      }),
    });
    const json = await res.json();
    setEdges((prev) => prev.map((e) => (e.id === edge.id ? { ...e, result: json, testing: false } : e)));
  };

  const toggleNormalization = (edgeId: string, key: string) => {
    setEdges((prev) =>
      prev.map((e) => {
        if (e.id !== edgeId) return e;
        const next = { ...e, normalization: { ...e.normalization, [key]: !e.normalization[key] } };
        runTest(next);
        return next;
      })
    );
  };

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;
  const [saveName, setSaveName] = useState('');
  const [saveReverseName, setSaveReverseName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaveName('');
    setSaveReverseName('');
    setSaved(false);
    setPreview(null);
  }, [selectedEdgeId]);

  const handleSaveLink = async () => {
    if (!selectedEdge?.result || selectedEdge.result.blocked) return;
    const res = await fetch('/api/super-admin/form-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leftFormId: selectedEdge.leftFormId,
        leftFieldId: selectedEdge.leftFieldId,
        rightFormId: selectedEdge.rightFormId,
        rightFieldId: selectedEdge.rightFieldId,
        name: saveName,
        reverseName: saveReverseName,
        cardinality: selectedEdge.result.suggestedCardinality ?? 'MANY_TO_MANY',
        normalization: selectedEdge.normalization,
      }),
    });
    if (res.ok) setSaved(true);
  };

  const handleLoadPreview = async () => {
    if (!selectedEdge) return;
    const res = await fetch('/api/super-admin/form-links/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leftFormId: selectedEdge.leftFormId,
        leftFieldId: selectedEdge.leftFieldId,
        rightFormId: selectedEdge.rightFormId,
        rightFieldId: selectedEdge.rightFieldId,
        normalization: selectedEdge.normalization,
      }),
    });
    const json = await res.json();
    setPreview({ rows: json.rows ?? [], blocked: json.blocked, reason: json.blockedReason });
  };

  const onCardMouseDown = (e: React.MouseEvent, card: CardState) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragCard.current = { formId: card.formId, offsetX: e.clientX - rect.left - card.x, offsetY: e.clientY - rect.top - card.y };
  };
  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (!dragCard.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { formId, offsetX, offsetY } = dragCard.current;
    setCards((prev) =>
      prev.map((c) => (c.formId === formId ? { ...c, x: e.clientX - rect.left - offsetX, y: e.clientY - rect.top - offsetY } : c))
    );
  };
  const onCanvasMouseUp = () => {
    dragCard.current = null;
  };

  if (!consentChecked) return <div className="p-8 text-slate-400 text-sm">불러오는 중...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" /> 재식별 위험 안내
            </h2>
            <p className="text-sm text-slate-600">
              이 화면은 서로 다른 양식지가 같은 값(사번·전화번호 등)을 공유하는지 연결해보는
              기능입니다. 각각은 안전해 보이는 데이터라도, 연결하는 순간 결합된 하나의
              프로파일이 될 수 있습니다. 연결 테스트의 매치 건수·비율만으로도 특정 개인이
              드러날 수 있어, 최소 응답 수(5건) 미만인 결과는 표시되지 않습니다.
            </p>
            <p className="text-sm text-slate-600">
              모든 연결 테스트 시도는 감사 로그에 기록됩니다. 이 안내는 최초 1회만 표시되며,
              나중에 시스템 환경 설정에서 다시 볼 수 있습니다.
            </p>
            <button
              onClick={handleAckConsent}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
            >
              확인했습니다
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Network className="w-5 h-5 mr-2 text-indigo-600" /> 양식지 관계 캔버스
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            왼쪽에서 양식지를 검색해 캔버스에 올리고, 문항 두 개를 순서대로 클릭하면 연결
            테스트가 자동 실행됩니다.
          </p>
        </div>
        <Link href="/super-admin" className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 shrink-0 whitespace-nowrap">
          슈퍼 어드민 대시보드
        </Link>
      </div>

      <div className="flex-1 flex">
        {/* 툴박스 — 양식지가 많아지면 평면 목록으로는 찾기 어려우므로 산업분야로 묶어
            접었다 펼 수 있게 한다. 검색·필터는 스크롤과 무관하게 항상 보이도록 고정한다. */}
        <div className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-100 space-y-2 shrink-0">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="">전체 산업분야</option>
              {flatCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {'\u00A0'.repeat(c.depth * 2)}
                  {c.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="양식지 검색"
                className="w-full pl-8 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              전체 {allForms.length}건 중 <strong className="text-slate-600">{filteredForms.length}건</strong> 표시
              {cards.length > 0 && ` · 캔버스에 ${cards.length}건`}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {groupedForms.map((group) => {
              const open = !collapsedGroups.has(group.key);
              return (
                <div key={group.key}>
                  <button
                    onClick={() =>
                      setCollapsedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.key)) next.delete(group.key);
                        else next.add(group.key);
                        return next;
                      })
                    }
                    className="w-full flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide hover:bg-slate-50 rounded"
                  >
                    {open ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{group.name}</span>
                    <span className="ml-auto text-slate-400 shrink-0">{group.forms.length}</span>
                  </button>

                  {open && (
                    <div className="space-y-1 pl-1">
                      {group.forms.map((f) => {
                        const onCanvas = cards.some((c) => c.formId === f.formId);
                        return (
                          <button
                            key={f.formId}
                            onClick={() => addCard(f)}
                            disabled={onCanvas}
                            title={f.title}
                            className="w-full text-left px-2.5 py-2 rounded-lg border border-slate-200 text-sm hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <span className="block truncate">{f.title}</span>
                            <span className="block text-[10px] text-slate-400">
                              문항 {f.fields.length}개{onCanvas ? ' · 캔버스에 있음' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredForms.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">조건에 맞는 양식지가 없습니다.</p>
            )}
          </div>
        </div>

        <div
          ref={canvasRef}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseUp}
          className="flex-1 relative overflow-auto bg-slate-100"
          style={{ minHeight: 600 }}
        >
          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
            {edges.map((edge) => {
              const leftCard = cards.find((c) => c.formId === edge.leftFormId);
              const rightCard = cards.find((c) => c.formId === edge.rightFormId);
              if (!leftCard || !rightCard) return null;
              const leftIdx = leftCard.fields.findIndex((f) => f.id === edge.leftFieldId);
              const rightIdx = rightCard.fields.findIndex((f) => f.id === edge.rightFieldId);
              const a = fieldAnchor(leftCard, leftIdx);
              const b = fieldAnchor(rightCard, rightIdx);
              const midX = (a.x + b.x) / 2;
              const midY = (a.y + b.y) / 2;
              const badge = edge.testing
                ? '테스트 중...'
                : edge.result?.blocked
                  ? edge.result.blockedReason === 'BELOW_K'
                    ? 'k 미만'
                    : '익명 문항'
                  : edge.result
                    ? `${Math.round((edge.result.leftContainmentPct ?? 0) * 100)}% / ${Math.round((edge.result.rightContainmentPct ?? 0) * 100)}%`
                    : '';
              return (
                <g key={edge.id}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={selectedEdgeId === edge.id ? '#4f46e5' : '#94a3b8'}
                    strokeWidth={selectedEdgeId === edge.id ? 2.5 : 1.5}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => setSelectedEdgeId(edge.id)}
                  />
                  <rect x={midX - 34} y={midY - 10} width={68} height={20} rx={10} fill="white" stroke="#cbd5e1" />
                  <text x={midX} y={midY + 4} textAnchor="middle" fontSize={10} fill="#334155">
                    {badge}
                  </text>
                </g>
              );
            })}
          </svg>

          {cards.map((card) => (
            <div
              key={card.formId}
              onMouseDown={(e) => onCardMouseDown(e, card)}
              className="absolute bg-white rounded-lg border border-slate-300 shadow-sm select-none"
              style={{ left: card.x, top: card.y, width: CARD_WIDTH }}
            >
              <div className="px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-t-lg cursor-move flex items-center justify-between">
                <span className="truncate">{card.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCards((prev) => prev.filter((c) => c.formId !== card.formId));
                    setEdges((prev) => prev.filter((ed) => ed.leftFormId !== card.formId && ed.rightFormId !== card.formId));
                  }}
                  className="text-slate-300 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {card.fields.map((f) => {
                const isPending = pendingField?.formId === card.formId && pendingField.fieldId === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => handleFieldClick(card.formId, f.id)}
                    className={`w-full text-left px-3 text-xs border-t border-slate-100 flex items-center gap-1 ${
                      isPending ? 'bg-indigo-100 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    {f.personalIdentifier && <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />}
                    <span className="truncate">{f.label}</span>
                  </button>
                );
              })}
              <div style={{ height: 8 }} />
            </div>
          ))}
        </div>

        <div className="w-96 bg-white border-l border-slate-200 p-5 overflow-y-auto">
          {!selectedEdge ? (
            <p className="text-sm text-slate-400">엣지를 클릭하면 연결 테스트 결과가 여기 표시됩니다.</p>
          ) : (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900">
                {selectedEdge.leftFieldId} ↔ {selectedEdge.rightFieldId}
              </h2>

              {selectedEdge.testing && <p className="text-sm text-slate-400">테스트 중...</p>}

              {selectedEdge.result?.blocked && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  {selectedEdge.result.blockedReason === 'BELOW_K'
                    ? '응답 수 또는 교집합이 5건 미만이라 결과를 표시할 수 없습니다.'
                    : '익명 문항은 관계로 연결할 수 없습니다.'}
                </div>
              )}

              {selectedEdge.result && !selectedEdge.result.blocked && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">좌측 기준 매치율</div>
                      <div className="text-lg font-bold text-slate-900">
                        {Math.round((selectedEdge.result.leftContainmentPct ?? 0) * 100)}%
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">우측 기준 매치율</div>
                      <div className="text-lg font-bold text-slate-900">
                        {Math.round((selectedEdge.result.rightContainmentPct ?? 0) * 100)}%
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>좌측 고유값 {selectedEdge.result.leftUniqueCount} · 우측 고유값 {selectedEdge.result.rightUniqueCount} · 교집합 {selectedEdge.result.intersectionCount}</div>
                    <div>좌측에만 {selectedEdge.result.leftOnlyCount}건 · 우측에만 {selectedEdge.result.rightOnlyCount}건</div>
                    <div>제안 카디널리티: <span className="font-bold text-slate-700">{selectedEdge.result.suggestedCardinality}</span></div>
                  </div>
                  {selectedEdge.result.isPersonalKey && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> 개인식별자 태그된 문항 포함 — 미리보기 값은 블러 처리됩니다.
                    </div>
                  )}
                </>
              )}

              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">정규화 규칙</h3>
                <div className="space-y-1">
                  {NORMALIZATION_OPTIONS.map((opt) => (
                    <label key={opt.key} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={!!selectedEdge.normalization[opt.key]}
                        onChange={() => toggleNormalization(selectedEdge.id, opt.key)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <button onClick={handleLoadPreview} className="text-sm text-indigo-600 hover:underline">
                  최근 레코드 5건 미리보기
                </button>
                {preview && (
                  <div className="mt-2 bg-slate-50 rounded-lg p-3 text-xs">
                    {preview.blocked ? (
                      <p className="text-slate-500">
                        {preview.reason === 'MASKED'
                          ? '마스킹 대상 양식지가 포함되어 미리보기를 제공할 수 없습니다.'
                          : preview.reason === 'BELOW_K'
                            ? '매치 건수가 5건 미만이라 미리보기를 제공할 수 없습니다.'
                            : '미리보기를 제공할 수 없습니다.'}
                      </p>
                    ) : preview.rows.length === 0 ? (
                      <p className="text-slate-400">표시할 레코드가 없습니다.</p>
                    ) : (
                      <ul className="space-y-1">
                        {preview.rows.map((r, i) => (
                          <li key={i} className="flex justify-between">
                            <span>{r.leftValue}</span>
                            <span className="text-slate-400">↔</span>
                            <span>{r.rightValue}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {selectedEdge.result && !selectedEdge.result.blocked && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="관계 이름 (예: 이 직원이 제출한 만족도조사)"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                  <input
                    value={saveReverseName}
                    onChange={(e) => setSaveReverseName(e.target.value)}
                    placeholder="역방향 이름 (예: 이 응답을 제출한 직원)"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                  <button
                    onClick={handleSaveLink}
                    disabled={!saveName || !saveReverseName || saved}
                    className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saved ? '저장됨' : '관계로 저장'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
