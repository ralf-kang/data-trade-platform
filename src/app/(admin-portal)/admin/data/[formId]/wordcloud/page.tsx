'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Cloud, Info, ShieldCheck } from 'lucide-react';

interface WordCloudEntry {
  text: string;
  count: number;
}

interface WordCloudResult {
  words: WordCloudEntry[];
  sampledCount: number;
  totalCount: number;
  fieldsUsed: string[];
  masked: boolean;
}

// 빈도수를 폰트 크기로 매핑한다 — 물리적 배치 충돌 계산 없이도 워드클라우드처럼
// 읽히도록 flex-wrap 태그 클라우드 방식을 쓴다.
const MIN_SIZE = 13;
const MAX_SIZE = 46;
const PALETTE = ['#4f46e5', '#0ea5e9', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

function fontSizeFor(count: number, min: number, max: number) {
  if (max === min) return (MIN_SIZE + MAX_SIZE) / 2;
  const ratio = (count - min) / (max - min);
  return Math.round(MIN_SIZE + ratio * (MAX_SIZE - MIN_SIZE));
}

export default function WordCloudPage() {
  const params = useParams();
  const formId = (params?.formId as string) || '';
  const [result, setResult] = useState<WordCloudResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!formId) return;
    fetch(`/api/forms/${formId}/wordcloud`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) {
          setError(j.message ?? '워드클라우드를 불러올 수 없습니다.');
          return;
        }
        setResult(j);
      })
      .finally(() => setLoading(false));
  }, [formId]);

  const counts = result?.words.map((w) => w.count) ?? [];
  const min = counts.length ? Math.min(...counts) : 0;
  const max = counts.length ? Math.max(...counts) : 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center sticky top-0 z-10">
        <Link href={`/admin/data/${formId}`} className="text-gray-400 hover:text-gray-600 mr-4">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Cloud className="w-5 h-5 mr-2 text-indigo-600" />
            워드클라우드 (Form: {formId})
          </h1>
          <p className="text-sm text-gray-500 mt-1">자유서술형 응답에서 자주 등장한 단어를 보여줍니다.</p>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-4">
          {loading && <div className="text-slate-400 text-sm">불러오는 중...</div>}
          {error && <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">{error}</div>}

          {result && !error && (
            <>
              {result.masked && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                  이 양식지는 마스킹 대상입니다. 마스킹 처리된(비공개) 응답은 원문 대신 자동으로 제외되어 집계됩니다.
                </div>
              )}

              {result.fieldsUsed.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
                  이 양식지에는 자유서술형(단답/장문/정규식) 문항이 없어 워드클라우드를 만들 수 없습니다.
                </div>
              ) : result.words.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
                  집계할 응답이 아직 없습니다.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-10">
                  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                    {result.words.map((w, i) => (
                      <span
                        key={w.text}
                        title={`${w.text} · ${w.count}회`}
                        style={{ fontSize: fontSizeFor(w.count, min, max), color: PALETTE[i % PALETTE.length] }}
                        className="font-bold leading-none"
                      >
                        {w.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-400 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  집계 대상 문항: {result.fieldsUsed.length ? result.fieldsUsed.join(', ') : '없음'} · 표본 {result.sampledCount.toLocaleString()}건
                  {result.totalCount > result.sampledCount && ` (전체 ${result.totalCount.toLocaleString()}건 중 표본)`} · 공백 기준 단순 분리이므로
                  조사가 붙은 단어는 다르게 집계될 수 있습니다.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
