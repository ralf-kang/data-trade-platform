'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, FileText, Coins, CheckCircle2, ArrowRight, Clock, Construction } from 'lucide-react';

interface Pending {
  campaignId: string;
  campaignName: string;
  formId: string;
  formTitle: string;
  endsAt: string | null;
  daysLeft: number | null;
}

interface Summary {
  pendingCount: number;
  responseCount: number;
  formCount: number;
  targetedCount: number;
  points: {
    visible: boolean;
    developmentPreview: boolean;
    summary: { balance: number; pending: number; programStarted: boolean } | null;
  };
}

export default function MemberHome() {
  const [data, setData] = useState<{
    user: { name: string; department: string | null };
    summary: Summary;
    pending: Pending[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/me/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;
  if (!data) return <div className="text-slate-500 text-sm">정보를 불러오지 못했습니다. 다시 로그인해 주세요.</div>;

  const { user, summary, pending } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">안녕하세요, {user.name} 님</h1>
        {user.department && <p className="text-sm text-slate-500 mt-1">{user.department}</p>}
      </div>

      {/* 요약 위젯 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="조치 필요"
          value={summary.pendingCount}
          tone={summary.pendingCount > 0 ? 'warn' : 'ok'}
          icon={summary.pendingCount > 0 ? AlertTriangle : CheckCircle2}
        />
        <Stat label="응답한 양식" value={summary.formCount} icon={FileText} />
        <Stat label="총 응답 횟수" value={summary.responseCount} icon={CheckCircle2} />
        <Stat
          label="보유 포인트"
          value={summary.points.visible && summary.points.summary?.programStarted ? summary.points.summary.balance : '—'}
          icon={Coins}
        />
      </div>

      {/* 조치 필요 — 이 화면의 존재 이유. 여러 부서 요청이 한곳에 모인다. */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2 text-amber-600" />
          <h2 className="font-bold text-slate-800 text-sm">지금 응답이 필요합니다</h2>
        </div>
        {pending.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            응답이 밀린 양식지가 없습니다.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((p) => (
              <li key={p.campaignId} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">{p.formTitle}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{p.campaignName}</span>
                    {p.daysLeft !== null && (
                      <span className={`inline-flex items-center gap-1 ${p.daysLeft <= 3 ? 'text-rose-600 font-bold' : ''}`}>
                        <Clock className="w-3 h-3" />
                        {p.daysLeft >= 0 ? `D-${p.daysLeft}` : '기한 지남'}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/q/${p.formId}`}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 inline-flex items-center gap-1"
                >
                  응답하기 <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 포인트 — 원장이 비어 있으면 가짜 숫자 대신 상태를 정직하게 알린다 */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-bold text-slate-800 text-sm flex items-center mb-3 gap-2">
          <Coins className="w-4 h-4 text-amber-500" /> 포인트
          {summary.points.visible && summary.points.developmentPreview && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Construction className="w-3 h-3" /> 개발 중
            </span>
          )}
        </h2>
        {summary.points.visible && summary.points.summary?.programStarted ? (
          <div className="flex items-baseline gap-6">
            <div>
              <div className="text-2xl font-bold text-slate-900">{summary.points.summary.balance.toLocaleString()}P</div>
              <div className="text-xs text-slate-500">사용 가능</div>
            </div>
            {summary.points.summary.pending > 0 && (
              <div>
                <div className="text-lg font-bold text-amber-600">{summary.points.summary.pending.toLocaleString()}P</div>
                <div className="text-xs text-slate-500">검토 중</div>
              </div>
            )}
            <Link href="/me/points" className="ml-auto text-sm text-indigo-600 hover:underline">내역 보기</Link>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            보상 제도는 <strong>준비 중</strong>입니다. 적립 시작 시점과 지급 기준은 별도로 공지됩니다.
          </p>
        )}
      </section>

      <div className="text-center">
        <Link href="/me/responses" className="text-sm text-indigo-600 hover:underline">
          내가 응답한 양식지 전체 보기 →
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'warn' | 'ok';
}) {
  const color =
    tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-emerald-600' : 'text-slate-900';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
