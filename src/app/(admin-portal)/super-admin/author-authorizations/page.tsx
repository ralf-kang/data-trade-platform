'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  UserCog, ArrowLeft, CheckCircle2, XCircle, Ban, Clock, AlertTriangle,
} from 'lucide-react';

interface AuthRow {
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
  purpose: string;
  plannedDataItems: string;
  trainingValidUntil: string | null;
  reauthorizeBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  revokedReason: string | null;
  requestedAt: string;
  user: { id: string; name: string; email: string; department: string | null };
}

const STATUS_LABEL: Record<AuthRow['status'], { text: string; cls: string }> = {
  PENDING: { text: '심사 대기', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { text: '승인됨', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SUSPENDED: { text: '정지(교육만료)', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  EXPIRED: { text: '재승인필요', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  REVOKED: { text: '해제됨', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function AuthorAuthorizationsPage() {
  const [rows, setRows] = useState<AuthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/author-authorizations')
      .then((res) => (res.ok ? res.json() : { authorizations: [] }))
      .then((json) => setRows(json.authorizations ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (userId: string) => {
    if (!confirm('이 신청을 승인하시겠습니까?\n교육 유효기간 12개월, 재승인 주기 24개월이 자동으로 설정됩니다.')) return;
    setBusyId(userId);
    try {
      const res = await fetch(`/api/author-authorizations/${userId}/approve`, { method: 'POST' });
      if (!res.ok) { alert('승인에 실패했습니다.'); return; }
      load();
    } finally { setBusyId(null); }
  };

  const reject = async (userId: string) => {
    const reason = prompt('거부 사유를 입력해주세요.');
    if (!reason) return;
    setBusyId(userId);
    try {
      const res = await fetch(`/api/author-authorizations/${userId}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      });
      if (!res.ok) { alert('처리에 실패했습니다.'); return; }
      load();
    } finally { setBusyId(null); }
  };

  const revoke = async (userId: string, name: string) => {
    const reason = prompt(`[${name}] 님의 개인정보 취급자 자격을 해제합니다.\n사유(퇴사/직무변경/위반 등)를 입력해주세요.`);
    if (!reason) return;
    setBusyId(userId);
    try {
      const res = await fetch(`/api/author-authorizations/${userId}/revoke`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      });
      if (!res.ok) { alert('처리에 실패했습니다.'); return; }
      load();
    } finally { setBusyId(null); }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">불러오는 중...</div>;

  const isExpiringSoon = (dateStr: string | null) => {
    if (!dateStr) return false;
    const days = (new Date(dateStr).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    return days >= 0 && days <= 30;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Link href="/super-admin" className="text-slate-400 hover:text-slate-600 mr-4"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center">
                <UserCog className="w-6 h-6 mr-2 text-indigo-600" /> 개인정보취급자 명부
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                양식 제작 자격(개인정보 취급자 지정) 신청·승인·해제를 관리합니다.
                UserRole.AUTHOR(기능 권한)와는 별개의 심사이며, 기본 자격은 없습니다.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">신청 이력이 없습니다.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-500">신청자</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-500">목적 / 수집예정항목</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-500">상태</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-500">교육유효기간</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-500">재승인기한</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-slate-500">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const s = STATUS_LABEL[r.status];
                  const busy = busyId === r.userId;
                  return (
                    <tr key={r.userId}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{r.user.name}</div>
                        <div className="text-xs text-slate-400">{r.user.email}{r.user.department ? ` · ${r.user.department}` : ''}</div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="text-slate-800 truncate" title={r.purpose}>{r.purpose}</div>
                        <div className="text-xs text-slate-400 truncate" title={r.plannedDataItems}>{r.plannedDataItems}</div>
                        {r.status === 'REVOKED' && r.revokedReason && (
                          <div className="text-xs text-rose-500 mt-0.5">사유: {r.revokedReason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${s.cls}`}>{s.text}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {r.trainingValidUntil ? (
                          <span className={isExpiringSoon(r.trainingValidUntil) ? 'text-amber-600 font-bold flex items-center gap-1' : ''}>
                            {isExpiringSoon(r.trainingValidUntil) && <AlertTriangle className="w-3 h-3" />}
                            {r.trainingValidUntil.slice(0, 10)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {r.reauthorizeBy ? r.reauthorizeBy.slice(0, 10) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5">
                        {r.status === 'PENDING' && (
                          <>
                            <button onClick={() => approve(r.userId)} disabled={busy}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 승인
                            </button>
                            <button onClick={() => reject(r.userId)} disabled={busy}
                              className="px-2.5 py-1 bg-white border border-rose-300 text-rose-600 rounded text-xs font-bold hover:bg-rose-50 disabled:opacity-50 inline-flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> 거부
                            </button>
                          </>
                        )}
                        {(r.status === 'APPROVED' || r.status === 'SUSPENDED') && (
                          <button onClick={() => revoke(r.userId, r.user.name)} disabled={busy}
                            className="px-2.5 py-1 bg-white border border-slate-300 text-slate-600 rounded text-xs font-bold hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1">
                            <Ban className="w-3.5 h-3.5" /> 해제
                          </button>
                        )}
                        {(r.status === 'EXPIRED' || r.status === 'REVOKED') && (
                          <span className="text-xs text-slate-400 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> 재신청 대기</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
