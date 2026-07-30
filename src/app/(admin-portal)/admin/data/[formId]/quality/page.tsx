'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, TrendingDown, Send, CheckCircle2 } from 'lucide-react';

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

interface QualityReport {
  totalSubmissions: number;
  missing: MissingFieldStat[];
  outliers: OutlierEntry[];
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
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {loading && <div className="text-slate-400 text-sm">불러오는 중...</div>}

          {report && !loading && (
            <>
              <div className="text-sm text-slate-500">전체 응답 {report.totalSubmissions.toLocaleString()}건 분석</div>

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
