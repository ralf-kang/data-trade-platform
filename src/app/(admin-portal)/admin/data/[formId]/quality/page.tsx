'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, TrendingDown, TrendingUp, Send, CheckCircle2, BarChart3, Info, Tags } from 'lucide-react';
import HelpLink from '@/components/manual/HelpLink';

interface MissingFieldStat {
  fieldId: string;
  label: string;
  type: string;
  missingCount: number;
  totalCount: number;
  missingRate: number;
  sampleSubmissionIds: string[];
}

interface OutlierEntry {
  submissionId: string;
  fieldId: string;
  label: string;
  value: number;
  reason: string;
}

interface FieldDistributionStat {
  fieldId: string;
  label: string;
  type: string;
  numeric?: { count: number; avg: number; min: number; max: number; stddev: number };
  options?: Array<{ value: string; count: number; rate: number }>;
}

interface TrendPoint {
  weekStart: string;
  count: number;
  numericAverages: Record<string, number>;
}

interface RepresentativenessWarning {
  scope: 'form' | 'field';
  fieldId?: string;
  label?: string;
  message: string;
}

interface TopicGroup {
  fieldId: string;
  label: string;
  topics: Array<{ keyword: string; count: number }>;
}

interface QualityReport {
  totalSubmissions: number;
  missing: MissingFieldStat[];
  outliers: OutlierEntry[];
  fieldStats: FieldDistributionStat[];
  trend: TrendPoint[];
  representativeness: RepresentativenessWarning[];
  topicGroups: TopicGroup[];
}

interface CorrectionRequest {
  id: string;
  submissionId: string;
  fieldId: string | null;
  issueType: string;
  reason: string;
  status: string;
  requestedAt: string;
}

export default function DataQualityPage() {
  const params = useParams();
  const formId = (params?.formId as string) || '';

  const [report, setReport] = useState<QualityReport | null>(null);
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  const load = () => {
    if (!formId) return;
    Promise.all([
      fetch(`/api/forms/${formId}/quality`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/forms/${formId}/correction-requests`).then((r) => (r.ok ? r.json() : { requests: [] })),
    ]).then(([q, r]) => {
      setReport(q);
      setRequests(r.requests ?? []);
      setLoading(false);
    });
  };

  useEffect(load, [formId]);

  const requestedKey = (submissionId: string, fieldId: string | null) =>
    requests.find((r) => r.submissionId === submissionId && r.fieldId === fieldId && r.status === 'PENDING');

  const handleRequestCorrection = async (submissionId: string, fieldId: string | null, issueType: 'MISSING' | 'OUTLIER', defaultReason: string) => {
    const reason = window.prompt('수정 요청 사유를 입력하세요', defaultReason);
    if (!reason) return;
    const key = `${submissionId}:${fieldId}`;
    setSending(key);
    const res = await fetch(`/api/forms/${formId}/correction-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, fieldId, issueType, reason }),
    });
    setSending(null);
    if (!res.ok) {
      const json = await res.json();
      alert(json.message ?? '수정 요청을 보낼 수 없습니다.');
      return;
    }
    load();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center sticky top-0 z-10">
        <Link href={`/admin/data/${formId}`} className="text-gray-400 hover:text-gray-600 mr-4">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-amber-600" />
            결측치 · 이상치 조회 (Form: {formId})
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            응답자를 특정할 수 있는(식별) 제출 건에 한해 수정 요청을 보낼 수 있습니다. 익명
            문항·응답은 대상에서 제외됩니다.
          </p>
        </div>
        <div className="ml-auto"><HelpLink /></div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {loading && <div className="text-slate-400 text-sm">불러오는 중...</div>}

          {report && !loading && (
            <>
              <div className="text-sm text-slate-500">전체 응답 {report.totalSubmissions.toLocaleString()}건 분석</div>

              {report.representativeness.length > 0 && (
                <section className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
                  <div className="font-bold text-amber-800 text-sm flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4" /> 대표성 경고
                  </div>
                  <ul className="space-y-1">
                    {report.representativeness.map((w, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        {w.label ? <span className="font-medium">{w.label}: </span> : null}
                        {w.message}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {report.trend.length > 0 && (
                <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" /> 추세선 (주간 응답량)
                  </div>
                  <div className="p-5">
                    <TrendChart trend={report.trend} />
                  </div>
                </section>
              )}

              {report.fieldStats.length > 0 && (
                <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-600" /> 기능 분석 (문항별 응답 분포)
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {report.fieldStats.map((f) => (
                      <li key={f.fieldId} className="px-5 py-3">
                        <div className="font-medium text-slate-900 text-sm mb-2">{f.label}</div>
                        {f.numeric && (
                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                            <span>응답 {f.numeric.count}건</span>
                            <span>평균 {f.numeric.avg.toFixed(1)}</span>
                            <span>최소 {f.numeric.min}</span>
                            <span>최대 {f.numeric.max}</span>
                            <span>표준편차 {f.numeric.stddev.toFixed(1)}</span>
                          </div>
                        )}
                        {f.options && (
                          <div className="space-y-1.5">
                            {f.options.map((o) => (
                              <div key={o.value} className="flex items-center gap-2 text-xs">
                                <span className="w-24 truncate text-slate-600 shrink-0">{o.value}</span>
                                <div className="flex-1 h-3 bg-slate-100 rounded overflow-hidden">
                                  <div className="h-full bg-emerald-400" style={{ width: `${Math.round(o.rate * 100)}%` }} />
                                </div>
                                <span className="w-16 text-right text-slate-400 shrink-0">
                                  {o.count}건 ({Math.round(o.rate * 100)}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {report.topicGroups.length > 0 && (
                <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Tags className="w-4 h-4 text-violet-600" /> 주제별 응답 그룹 (자유서술 문항)
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {report.topicGroups.map((g) => (
                      <li key={g.fieldId} className="px-5 py-3">
                        <div className="font-medium text-slate-900 text-sm mb-2">{g.label}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {g.topics.map((t) => (
                            <span
                              key={t.keyword}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200"
                            >
                              {t.keyword}
                              <span className="text-violet-400">{t.count}</span>
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="px-5 py-2 text-[11px] text-slate-400 border-t border-slate-100">
                    응답 5건 미만인 주제어는 표시되지 않습니다 (워드클라우드와 동일한 재식별 방지 기준).
                  </div>
                </section>
              )}

              <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 text-sm flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-amber-600" /> 결측치 ({report.missing.length}개 문항)
                </div>
                {report.missing.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 결측 항목이 없습니다.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {report.missing.map((m) => (
                      <li key={m.fieldId} className="px-5 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-slate-900">{m.label}</span>
                            <span className="text-xs text-slate-400 ml-2">
                              {m.missingCount}/{m.totalCount}건 ({Math.round(m.missingRate * 100)}%)
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {m.sampleSubmissionIds.map((sid) => {
                            const existing = requestedKey(sid, m.fieldId);
                            return (
                              <button
                                key={sid}
                                disabled={!!existing || sending === `${sid}:${m.fieldId}`}
                                onClick={() => handleRequestCorrection(sid, m.fieldId, 'MISSING', `${m.label} 항목이 비어 있습니다. 확인 후 입력을 부탁드립니다.`)}
                                className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-amber-50 hover:border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                              >
                                {existing ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Send className="w-3 h-3" />}
                                {sid} {existing ? '요청됨' : '수정 요청'}
                              </button>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" /> 이상치 ({report.outliers.length}건)
                </div>
                {report.outliers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 이상치가 없습니다.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {report.outliers.map((o, i) => {
                      const existing = requestedKey(o.submissionId, o.fieldId);
                      return (
                        <li key={i} className="px-5 py-3 flex items-center justify-between">
                          <div>
                            <span className="font-medium text-slate-900">{o.label}</span>
                            <span className="text-xs text-slate-500 ml-2">{o.submissionId} = {o.value}</span>
                            <div className="text-xs text-rose-500 mt-0.5">{o.reason}</div>
                          </div>
                          <button
                            disabled={!!existing || sending === `${o.submissionId}:${o.fieldId}`}
                            onClick={() => handleRequestCorrection(o.submissionId, o.fieldId, 'OUTLIER', `${o.label} 값(${o.value})이 정상 범위를 벗어났습니다. 확인 부탁드립니다.`)}
                            className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-amber-50 hover:border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shrink-0"
                          >
                            {existing ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Send className="w-3 h-3" />}
                            {existing ? '요청됨' : '수정 요청'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {requests.length > 0 && (
                <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 text-sm">
                    보낸 수정 요청 ({requests.length}건)
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {requests.map((r) => (
                      <li key={r.id} className="px-5 py-3 flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-slate-800">{r.submissionId}</span>
                          <span className="text-xs text-slate-400 ml-2">{r.reason}</span>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            r.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : r.status === 'RESOLVED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {r.status === 'PENDING' ? '대기 중' : r.status === 'RESOLVED' ? '수정 완료' : '취소됨'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// 외부 차트 라이브러리 없이 응답량 추세를 막대그래프로 보여준다 — 문항 수만큼 선을 그리면
// 오히려 읽기 어려워지므로, 회차 흐름 파악이 목적인 이 화면에서는 응답량만 시각화하고
// 숫자 문항 평균은 막대 위 툴팁성 텍스트로만 곁들인다.
function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const maxCount = Math.max(...trend.map((t) => t.count), 1);
  return (
    <div className="flex items-end gap-2 h-40">
      {trend.map((t) => {
        const heightPct = Math.max((t.count / maxCount) * 100, 4);
        const numericEntries = Object.entries(t.numericAverages);
        return (
          <div key={t.weekStart} className="flex-1 flex flex-col items-center justify-end h-full group relative">
            <div className="absolute -top-6 text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {t.count}건
              {numericEntries.length > 0 &&
                ` · ${numericEntries.map(([, avg]) => avg.toFixed(1)).join(', ')}`}
            </div>
            <div
              className="w-full bg-indigo-400 hover:bg-indigo-500 rounded-t transition-colors"
              style={{ height: `${heightPct}%` }}
            />
            <div className="text-[10px] text-slate-400 mt-1.5 whitespace-nowrap">{t.weekStart.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}
