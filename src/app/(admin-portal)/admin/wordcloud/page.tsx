'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Cloud, Info, ShieldCheck, Unlock } from 'lucide-react';
import { WordCloud } from '@isoterik/react-word-cloud';
import HelpLink from '@/components/manual/HelpLink';

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

  // 범위: "내가 만든 양식지 전체" 또는 "특정 양식지 하나만" (§4-2)
  const [scopeMode, setScopeMode] = useState<'all' | 'single'>(preselectedFormId ? 'single' : 'all');
  const [selectedFormId, setSelectedFormId] = useState<string>(preselectedFormId ?? '');
  // 선택된 폼(들)에 대해 문항 단위로 더 좁힐 수 있다 — formId -> 선택된 fieldId 집합.
  const [fieldSelection, setFieldSelection] = useState<Record<string, Set<string>>>({});

  const [result, setResult] = useState<WordCloudResult | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 개인정보취급자 k=5 우회 모드 — 매 조회마다 다시 의식적으로 켜야 한다(§identityMode 설계).
  // AUTHENTICATED 모드가 아니거나 개인정보취급자 승인이 없는 폼에는 조용히 적용되지 않는다.
  const [piiBypass, setPiiBypass] = useState(false);

  useEffect(() => {
    fetch('/api/admin/wordcloud/scope')
      .then((r) => (r.ok ? r.json() : { forms: [] }))
      .then((j) => {
        setForms(j.forms ?? []);
        if (!preselectedFormId && j.forms?.[0]) setSelectedFormId(j.forms[0].formId);
      })
      .finally(() => setLoadingScope(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeForms = scopeMode === 'all' ? forms : forms.filter((f) => f.formId === selectedFormId);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loadingScope && activeForms.length > 0) handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingScope, scopeMode, selectedFormId]);

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

        {/* 범위 설정 툴바 — 항상 화면 상단에 고정 (§4-2) */}
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5 font-medium text-slate-700">
              <input type="radio" checked={scopeMode === 'all'} onChange={() => setScopeMode('all')} />
              내가 만든 양식지 전체
            </label>
            <label className="flex items-center gap-1.5 font-medium text-slate-700">
              <input type="radio" checked={scopeMode === 'single'} onChange={() => setScopeMode('single')} />
              특정 양식지만
            </label>
            {scopeMode === 'single' && (
              <select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              >
                {forms.map((f) => (
                  <option key={f.formId} value={f.formId}>
                    {f.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {scopeMode === 'single' && selectedFormId && (
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-slate-500">문항 (미선택 시 전체 자유서술 문항 사용):</span>
              {forms
                .find((f) => f.formId === selectedFormId)
                ?.fields.map((field) => (
                  <label key={field.id} className="flex items-center gap-1 text-slate-700">
                    <input
                      type="checkbox"
                      checked={fieldSelection[selectedFormId]?.has(field.id) ?? false}
                      onChange={() => toggleField(selectedFormId, field.id)}
                    />
                    {field.label}
                  </label>
                ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
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
              disabled={activeForms.length === 0 || loadingResult}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loadingResult ? '집계 중...' : '다시 집계'}
            </button>
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
