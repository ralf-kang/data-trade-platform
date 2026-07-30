'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface CorrectionRequest {
  id: string;
  formId: string;
  submissionId: string;
  issueType: string;
  reason: string;
  requestedAt: string;
}

const ISSUE_LABEL: Record<string, string> = {
  MISSING: '결측치',
  OUTLIER: '이상치',
  OTHER: '확인 요청',
};

export default function MyCorrectionsPage() {
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/me/corrections')
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((j) => setRequests(j.requests ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" /> 수정 요청
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          제출하신 응답 중 관리자가 확인을 요청한 항목입니다. 아래에서 해당 양식지로 이동해
          다시 제출하면 자동으로 처리 완료로 표시됩니다.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
          현재 대기 중인 수정 요청이 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  {ISSUE_LABEL[r.issueType] ?? r.issueType}
                </span>
                <span className="text-xs text-slate-400">{r.requestedAt.slice(0, 10)}</span>
              </div>
              <p className="text-sm text-slate-700 mt-2">{r.reason}</p>
              <Link
                href={`/q/${r.formId}`}
                className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline font-medium"
              >
                양식지로 이동해 수정하기 <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
