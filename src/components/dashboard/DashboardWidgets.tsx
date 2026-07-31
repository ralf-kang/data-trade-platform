'use client';

import Link from 'next/link';
import {
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Tags,
  ArrowRight,
  Info,
} from 'lucide-react';

export interface DashboardStats {
  formCount: number;
  myFormCount: number;
  submissionTotal: number;
  storedCounterTotal: number;
  daily: Array<{ date: string; count: number }>;
  topForms: Array<{ formId: string; title: string; count: number }>;
  actionItems: {
    pendingShareRequests: number;
    pendingCorrections: number;
    pendingApprovals: number;
    pendingAuthorAuths: number;
  };
  privacy: { maskedForms: number; totalForms: number; approvedHandlers: number; identifiedForms: number };
  taxonomy: { categorized: number; uncategorized: number };
}

/** 최근 제출 추이 — 외부 차트 라이브러리 없이 막대만으로 흐름을 보여준다. */
export function SubmissionTrendWidget({ daily }: { daily: DashboardStats['daily'] }) {
  const max = Math.max(...daily.map((d) => d.count), 1);
  const recentSum = daily.reduce((s, d) => s + d.count, 0);

  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
        <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-600" /> 최근 제출 추이
        </h2>
        <span className="text-xs text-slate-400">{daily.length}일간 {recentSum.toLocaleString()}건</span>
      </div>
      <div className="p-5">
        {recentSum === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">최근 제출이 없습니다.</p>
        ) : (
          <div className="flex items-end gap-1 h-28">
            {daily.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                <div className="absolute -top-5 text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  {d.date.slice(5)} · {d.count}건
                </div>
                <div
                  className="w-full bg-indigo-400 hover:bg-indigo-500 rounded-t transition-colors"
                  style={{ height: `${Math.max((d.count / max) * 100, 3)}%` }}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
          <span>{daily[0]?.date.slice(5)}</span>
          <span>{daily[daily.length - 1]?.date.slice(5)}</span>
        </div>
      </div>
    </section>
  );
}

/** 조치 필요 — 방치되면 응답자·요청자가 계속 기다리게 되는 것들만 모은다. */
export function ActionItemsWidget({ items }: { items: DashboardStats['actionItems'] }) {
  const rows = [
    { label: '승인 대기 공유 신청', count: items.pendingShareRequests, href: '/admin/share-requests' },
    { label: '미처리 수정 요청', count: items.pendingCorrections, href: '/admin/data' },
    { label: '대기 중 배포 승인', count: items.pendingApprovals, href: '/super-admin' },
    { label: '심사 대기 취급자 신청', count: items.pendingAuthorAuths, href: '/super-admin/author-authorizations' },
  ];
  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
        <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${total > 0 ? 'text-amber-600' : 'text-slate-300'}`} /> 조치 필요
        </h2>
        {total > 0 && (
          <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            {total}건
          </span>
        )}
      </div>
      {total === 0 ? (
        <p className="p-6 text-sm text-slate-400 text-center">지금 처리할 항목이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows
            .filter((r) => r.count > 0)
            .map((r) => (
              <li key={r.label}>
                <Link href={r.href} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50">
                  <span className="text-slate-700">{r.label}</span>
                  <span className="flex items-center gap-1.5 text-slate-900 font-bold">
                    {r.count}건 <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

/** 개인정보 관점 요약 — 이 플랫폼에서 가장 중요한 위험 지표를 한 곳에 모은다. */
export function PrivacyWidget({ privacy }: { privacy: DashboardStats['privacy'] }) {
  const maskedRate = privacy.totalForms === 0 ? 0 : Math.round((privacy.maskedForms / privacy.totalForms) * 100);

  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> 개인정보 보호 현황
        </h2>
      </div>
      <div className="p-5 space-y-3">
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-600">마스킹 대상 양식지</span>
            <span className="font-bold text-slate-900">
              {privacy.maskedForms} / {privacy.totalForms}
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded overflow-hidden">
            <div className="h-full bg-amber-400" style={{ width: `${maskedRate}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            제작자가 개인정보 취급 자격 없이 만든 양식지입니다. 자유서술 응답이 가려져 보입니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-500">개인정보 취급자</p>
            <p className="text-lg font-bold text-slate-900">{privacy.approvedHandlers}명</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">신원 수집 양식지</p>
            <p className="text-lg font-bold text-slate-900">{privacy.identifiedForms}개</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 분류 정리 상태 — 분류 체계가 실제로 쓰이고 있는지, 방치된 양식이 얼마나 되는지. */
export function TaxonomyWidget({ taxonomy }: { taxonomy: DashboardStats['taxonomy'] }) {
  const total = taxonomy.categorized + taxonomy.uncategorized;
  const rate = total === 0 ? 0 : Math.round((taxonomy.categorized / total) * 100);

  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <Tags className="w-4 h-4 text-violet-600" /> 분류 정리 상태
        </h2>
      </div>
      <div className="p-5">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold text-slate-900">{rate}%</span>
          <span className="text-sm text-slate-500">산업분야 지정 완료</span>
        </div>
        <div className="h-2 bg-slate-100 rounded overflow-hidden mb-2">
          <div className="h-full bg-violet-400" style={{ width: `${rate}%` }} />
        </div>
        {taxonomy.uncategorized > 0 ? (
          <Link href="/admin/templates" className="text-xs text-violet-700 hover:underline flex items-center gap-1">
            미분류 {taxonomy.uncategorized}개 정리하기 <ArrowRight className="w-3 h-3" />
          </Link>
        ) : (
          <p className="text-xs text-slate-400">모든 양식지가 분류되어 있습니다.</p>
        )}
      </div>
    </section>
  );
}

/** 저장된 카운터와 실제 집계가 다를 때만 나타나는 경고. */
export function CounterDriftNotice({ stats }: { stats: DashboardStats }) {
  const diff = stats.submissionTotal - stats.storedCounterTotal;
  if (diff === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
      <Info className="w-4 h-4 mt-0.5 shrink-0" />
      <span>
        위 숫자는 <strong>실제 저장된 문서를 집계한 값</strong>입니다. 양식지에 기록된 누적 카운터
        합계({stats.storedCounterTotal.toLocaleString()}건)와 {Math.abs(diff).toLocaleString()}건 차이가
        있습니다 — 재시드·수동 삭제 등으로 카운터가 실제와 어긋난 것으로, 화면 숫자가 맞습니다.
      </span>
    </div>
  );
}
