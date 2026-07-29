'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, TrendingUp, AlertTriangle } from 'lucide-react';

interface Trend {
  formId: string;
  formTitle: string;
  campaigns: Array<{ id: string; name: string; sequence: number; schemaVersion: number }>;
  rows: Array<{
    fieldId: string;
    label: string;
    anonymous: boolean;
    values: Array<unknown | null>;
    changed: boolean;
  }>;
  schemaChanged: boolean;
}

export default function MyTrendPage() {
  const params = useParams();
  const formId = params?.formId as string;
  const [trend, setTrend] = useState<Trend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!formId) return;
    fetch(`/api/me/trends/${formId}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) { setError(j.message ?? '추세를 불러올 수 없습니다.'); return; }
        setTrend(j.trend);
      })
      .finally(() => setLoading(false));
  }, [formId]);

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;
  if (error) return (
    <div className="space-y-4">
      <Link href="/me/responses" className="text-sm text-slate-400 hover:text-slate-600 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> 내 응답으로
      </Link>
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">{error}</div>
    </div>
  );
  if (!trend) return null;

  const render = (v: unknown) =>
    v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : String(v);

  return (
    <div className="space-y-5">
      <Link href="/me/responses" className="text-sm text-slate-400 hover:text-slate-600 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> 내 응답으로
      </Link>

      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          {trend.formTitle} — 나의 변화
        </h1>
        <p className="text-sm text-slate-500 mt-1">회차마다 내 응답이 어떻게 바뀌었는지 보여줍니다.</p>
      </div>

      {/* 스키마 버전이 다르면 곧이곧대로 비교하면 안 된다 — 5점 척도와 7점 척도를
          한 줄로 이으면 없는 추세가 만들어진다. */}
      {trend.schemaChanged && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 flex items-start">
          <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-amber-600" />
          <span>
            회차마다 <strong>양식 구성이 달라졌습니다</strong>. 항목의 의미나 선택지가 바뀌었을 수 있으니
            값을 그대로 비교할 때 주의해 주세요.
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-bold text-slate-500">항목</th>
              {trend.campaigns.map((c) => (
                <th key={c.id} className="px-4 py-2 text-left text-xs font-bold text-slate-500 whitespace-nowrap">
                  #{c.sequence} {c.name}
                  <span className="block font-normal text-slate-400">v{c.schemaVersion}</span>
                </th>
              ))}
              <th className="px-4 py-2 text-left text-xs font-bold text-slate-500">변화</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trend.rows.map((row) => (
              <tr key={row.fieldId} className={row.anonymous ? 'bg-slate-50/60' : ''}>
                <td className="px-4 py-2 font-medium text-slate-700 flex items-center gap-1.5">
                  {row.label}
                  {row.anonymous && <Lock className="w-3 h-3 text-slate-400" />}
                </td>
                {row.anonymous ? (
                  <td colSpan={trend.campaigns.length + 1} className="px-4 py-2 text-slate-400 italic text-xs">
                    익명 문항은 회차 간 연결 자체가 재식별 경로이므로 추세를 제공하지 않습니다
                  </td>
                ) : (
                  <>
                    {row.values.map((v, i) => (
                      <td key={i} className="px-4 py-2 text-slate-800">{render(v)}</td>
                    ))}
                    <td className="px-4 py-2 text-xs">
                      {row.changed ? (
                        <span className="text-indigo-600 font-bold">✏ 변경됨</span>
                      ) : (
                        <span className="text-slate-400">— 동일</span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
