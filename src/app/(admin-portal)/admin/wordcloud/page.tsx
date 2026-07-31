'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Cloud, Info, ShieldCheck, Unlock, Play, X } from 'lucide-react';
import { WordCloud } from '@isoterik/react-word-cloud';
import HelpLink from '@/components/manual/HelpLink';
import TreeEditor, { type TreeNode } from '@/components/taxonomy/TreeEditor';

interface FormScopeOption {
  formId: string;
  title: string;
  fields: Array<{ id: string; label: string }>;
}

interface WordCloudResult {
  words: Array<{ text: string; count: number }>;
  fieldsUsed: string[];
  formsUsed: string[];
  maskedForms: string[];
  piiBypassForms: string[];
}

const PALETTE = ['#4f46e5', '#0ea5e9', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export default function WordCloudPage() {
  const searchParams = useSearchParams();
  const preselectedFormId = searchParams?.get('formId') ?? null;

  const [forms, setForms] = useState<FormScopeOption[]>([]);
  const [loadingScope, setLoadingScope] = useState(true);

  // 양식지를 체크박스로 여러 개 고른다. 기본값은 "아무것도 선택 안 함"이다 —
  // 화면에 들어오자마자 전체를 집계하면 의도하지 않은 대량 조회가 매번 발생한다.
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(
    new Set(preselectedFormId ? [preselectedFormId] : [])
  );
  // formId -> 선택된 fieldId 집합. 비어 있으면 그 폼의 자유서술 문항 전체를 쓴다.
  const [fieldSelection, setFieldSelection] = useState<Record<string, Set<string>>>({});

  // 분류 트리로 양식지 목록을 좁힌다(내 양식지 관리 화면과 같은 방식).
  const [categoryTree, setCategoryTree] = useState<TreeNode[]>([]);
  const [folderTree, setFolderTree] = useState<TreeNode[]>([]);
  const [taxonomyByForm, setTaxonomyByForm] = useState<Record<string, { categoryIds: string[]; folderIds: string[] }>>({});
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [filterFolderId, setFilterFolderId] = useState<string | null>(null);

  const [result, setResult] = useState<WordCloudResult | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 개인정보취급자 k=5 우회 모드 — 매 조회마다 다시 의식적으로 켜야 한다(§identityMode 설계).
  // AUTHENTICATED 모드가 아니거나 개인정보취급자 승인이 없는 폼에는 조용히 적용되지 않는다.
  const [piiBypass, setPiiBypass] = useState(false);

  useEffect(() => {
    fetch('/api/admin/wordcloud/scope')
      .then((r) => (r.ok ? r.json() : { forms: [] }))
      .then((j) => setForms(j.forms ?? []))
      .finally(() => setLoadingScope(false));

    fetch('/api/forms/taxonomy')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setCategoryTree(j.categoryTree ?? []);
        setFolderTree(j.folderTree ?? []);
        setTaxonomyByForm(j.byForm ?? {});
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 상위 분류를 고르면 하위까지 포함한다.
  const subtreeIds = (nodes: TreeNode[], target: string): string[] => {
    const out: string[] = [];
    const walk = (list: TreeNode[], inside: boolean) => {
      for (const n of list) {
        const now = inside || n.id === target;
        if (now) out.push(n.id);
        walk(n.children, now);
      }
    };
    walk(nodes, false);
    return out;
  };

  const visibleForms = forms.filter((f) => {
    const tax = taxonomyByForm[f.formId];
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

  const activeForms = forms.filter((f) => selectedFormIds.has(f.formId));

  const toggleForm = (formId: string) =>
    setSelectedFormIds((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId);
      else next.add(formId);
      return next;
    });

  const toggleField = (formId: string, fieldId: string) => {
    setFieldSelection((prev) => {
      const next = { ...prev };
      const set = new Set(next[formId] ?? []);
      if (set.has(fieldId)) set.delete(fieldId);
      else set.add(fieldId);
      next[formId] = set;
      return next;
    });
  };

  const handleRun = async () => {
    if (activeForms.length === 0) return;
    setLoadingResult(true);
    setError(null);
    try {
      const fieldIdsByForm: Record<string, string[]> = {};
      for (const f of activeForms) {
        const selected = fieldSelection[f.formId];
        if (selected && selected.size > 0) fieldIdsByForm[f.formId] = [...selected];
      }
      const res = await fetch('/api/admin/wordcloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formIds: activeForms.map((f) => f.formId), fieldIdsByForm, piiBypassAck: piiBypass }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? '워드클라우드를 불러올 수 없습니다.');
        return;
      }
      setResult(json);
    } finally {
      setLoadingResult(false);
    }
  };

  const words = useMemo(() => (result?.words ?? []).map((w) => ({ text: w.text, value: w.count })), [result]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Cloud className="w-5 h-5 mr-2 text-indigo-600" />
            워드클라우드
          </h1>
          <HelpLink />
        </div>
        <p className="text-sm text-gray-500 mt-1">
          내가 제작한 양식지의 자유서술형 응답에서 자주 등장한 단어를 보여줍니다.
        </p>

        {/* 범위 설정 — 분류 트리로 좁히고, 양식지·문항을 체크박스로 고른다.
            화면에 들어오는 것만으로는 집계하지 않는다(아래 "집계 실행"을 눌러야 한다). */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <h3 className="text-xs font-bold text-slate-700 mb-1">산업분야</h3>
              {filterCategoryId && (
                <button onClick={() => setFilterCategoryId(null)} className="text-[11px] text-indigo-600 hover:underline mb-1 flex items-center gap-0.5">
                  <X className="w-3 h-3" /> 해제
                </button>
              )}
              <TreeEditor tree={categoryTree} readOnly selectedId={filterCategoryId} onSelect={setFilterCategoryId} />
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <h3 className="text-xs font-bold text-slate-700 mb-1">내 폴더</h3>
              {filterFolderId && (
                <button onClick={() => setFilterFolderId(null)} className="text-[11px] text-indigo-600 hover:underline mb-1 flex items-center gap-0.5">
                  <X className="w-3 h-3" /> 해제
                </button>
              )}
              <TreeEditor tree={folderTree} readOnly selectedId={filterFolderId} onSelect={setFilterFolderId} />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-700">
                양식지 선택 <span className="text-slate-400 font-normal">({selectedFormIds.size}건 선택됨)</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedFormIds(new Set(visibleForms.map((f) => f.formId)))}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  보이는 것 전체 선택
                </button>
                <button onClick={() => setSelectedFormIds(new Set())} className="text-xs text-slate-500 hover:underline">
                  선택 해제
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {visibleForms.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">조건에 맞는 양식지가 없습니다.</p>
              )}
              {visibleForms.map((f) => {
                const checked = selectedFormIds.has(f.formId);
                const picked = fieldSelection[f.formId];
                return (
                  <div key={f.formId} className={`rounded-lg border ${checked ? 'border-indigo-300 bg-white' : 'border-slate-200 bg-white'}`}>
                    <label className="flex items-start gap-2 px-3 py-2 cursor-pointer">
                      <input type="checkbox" className="mt-0.5" checked={checked} onChange={() => toggleForm(f.formId)} />
                      <span className="min-w-0">
                        <span className="block text-sm text-slate-800 truncate">{f.title}</span>
                        <span className="block text-[11px] text-slate-400">
                          자유서술 문항 {f.fields.length}개
                          {checked && picked && picked.size > 0 ? ` · ${picked.size}개 선택` : ''}
                        </span>
                      </span>
                    </label>

                    {/* 선택된 양식지에 한해 문항 체크박스를 편다 — 고르지 않으면 전체를 쓴다. */}
                    {checked && (
                      <div className="px-3 pb-2 pt-1 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1">
                        <span className="text-[11px] text-slate-400 w-full">문항 (미선택 시 전체)</span>
                        {f.fields.map((field) => (
                          <label key={field.id} className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={picked?.has(field.id) ?? false}
                              onChange={() => toggleField(f.formId, field.id)}
                            />
                            {field.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-slate-200">
              <label className="flex items-center gap-1.5 text-sm text-indigo-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={piiBypass}
                  onChange={(e) => {
                    const next = e.target.checked;
                    if (next) {
                      const ok = window.confirm(
                        '개인정보취급자 k=5 우회 모드를 켭니다.\n\n' +
                          '인증(AUTHENTICATED) 양식지 중 본인이 개인정보취급자 승인을 받은 폼에 한해, ' +
                          '응답 5건 미만이라 평소엔 가려지는 희소 단어까지 노출됩니다 — 개별 응답자를 ' +
                          '특정할 수 있는 재식별 위험이 커집니다. 이 조회는 감사 로그에 기록됩니다.\n\n' +
                          '계속하시겠습니까?'
                      );
                      if (!ok) return;
                    }
                    setPiiBypass(next);
                  }}
                />
                <Unlock className="w-3.5 h-3.5" /> 개인정보취급자 k=5 우회 모드
              </label>
              <button
                onClick={handleRun}
                disabled={selectedFormIds.size === 0 || loadingResult}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                {loadingResult ? '집계 중...' : '집계 실행'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-4">
          {loadingScope && <div className="text-slate-400 text-sm">불러오는 중...</div>}

          {!loadingScope && forms.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
              자유서술형(단답/장문/정규식) 문항이 있는, 본인이 제작한 양식지가 없습니다.
            </div>
          )}

          {error && <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">{error}</div>}

          {/* 아직 실행하지 않은 상태 — 빈 화면을 두면 고장으로 읽히므로 다음 할 일을 알려준다. */}
          {!result && !error && !loadingResult && (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
              <Cloud className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {selectedFormIds.size === 0
                  ? '위에서 분석할 양식지를 선택한 뒤 「집계 실행」을 누르세요.'
                  : `${selectedFormIds.size}건이 선택되었습니다. 「집계 실행」을 누르면 분석을 시작합니다.`}
              </p>
              <p className="text-xs text-slate-400 mt-1">화면을 열었다는 이유만으로 자동 집계하지 않습니다.</p>
            </div>
          )}

          {result && !error && (
            <>
              {result.maskedForms.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                  마스킹 대상 양식지({result.maskedForms.length}건)가 포함되어 있습니다. 마스킹 처리된 응답은
                  원문 대신 자동으로 제외되어 집계됩니다.
                </div>
              )}

              {result.piiBypassForms.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
                  <Unlock className="w-4 h-4 mt-0.5 shrink-0" />
                  개인정보취급자 우회 모드가 {result.piiBypassForms.length}건의 양식지에 적용되어, 응답 5건
                  미만인 희소 단어까지 포함되었습니다. 이 조회는 감사 로그에 기록되었습니다.
                </div>
              )}

              {result.words.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
                  집계할 응답이 아직 없습니다 (또는 최소 응답 수 기준에 못 미치는 단어만 있습니다).
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-6 flex justify-center">
                  <WordCloud
                    words={words}
                    width={900}
                    height={420}
                    font="inherit"
                    fontSize={(w) => Math.max(14, Math.sqrt(w.value) * 12)}
                    fill={(_w, i) => PALETTE[i % PALETTE.length]}
                    enableTooltip
                    padding={2}
                  />
                </div>
              )}

              <div className="text-xs text-slate-400 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  대상 양식지 {result.formsUsed.length}건 · 집계 문항: {result.fieldsUsed.length ? result.fieldsUsed.join(', ') : '없음'} ·
                  한국어 형태소 분석(Nori) 적용, {result.piiBypassForms.length > 0
                    ? '우회 적용된 폼을 제외하면 응답 5건 미만인 단어는 제외됩니다.'
                    : '응답 5건 미만인 단어는 제외됩니다.'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
