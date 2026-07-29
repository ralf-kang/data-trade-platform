'use client';

import { useEffect, useState } from 'react';
import { Coins, Info, Construction } from 'lucide-react';

interface Points {
  balance: number;
  pending: number;
  rejected: number;
  programStarted: boolean;
  entries: Array<{
    id: string;
    delta: number;
    reason: string;
    status: string;
    statusReason: string | null;
    createdAt: string;
  }>;
}

interface GatedPoints {
  visible: boolean;
  developmentPreview: boolean;
  summary: Points | null;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  PENDING: { text: '검토 중', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { text: '지급 예정', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  PAID: { text: '지급 완료', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { text: '미지급', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  CANCELED: { text: '회수됨', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function MyPointsPage() {
  const [gated, setGated] = useState<GatedPoints | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/me/points')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setGated(j ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;
  if (!gated) return <div className="text-slate-500 text-sm">포인트 정보를 불러오지 못했습니다.</div>;

  if (!gated.visible) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-500" /> 포인트
          </h1>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
            <div className="text-sm text-slate-600">
              <p className="font-bold text-slate-800 mb-1">보상 제도는 준비 중입니다.</p>
              <p>적립 시작 시점과 지급 기준은 별도로 공지됩니다.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const points = gated.summary!;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Coins className="w-6 h-6 text-amber-500" /> 포인트
          {gated.developmentPreview && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Construction className="w-3 h-3" /> 개발 중 (관리자 미리보기)
            </span>
          )}
        </h1>
      </div>

      {!points.programStarted ? (
        /* 원장이 비어 있으면 가짜 숫자를 만들어 보여주지 않는다 */
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
            <div className="text-sm text-slate-600">
              <p className="font-bold text-slate-800 mb-1">보상 제도는 준비 중입니다.</p>
              <p>
                적립 시작 시점과 지급 기준은 별도로 공지됩니다. 공지 이전의 응답은
                소급 적립되지 않을 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 mb-1">사용 가능</div>
              <div className="text-2xl font-bold text-slate-900">{points.balance.toLocaleString()}P</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 mb-1">검토 중</div>
              <div className="text-2xl font-bold text-amber-600">{points.pending.toLocaleString()}P</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 mb-1">미지급</div>
              <div className="text-2xl font-bold text-slate-400">{points.rejected.toLocaleString()}P</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 text-sm">
              적립 내역
            </div>
            <ul className="divide-y divide-slate-100">
              {points.entries.map((e) => {
                const s = STATUS_LABEL[e.status] ?? { text: e.status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
                return (
                  <li key={e.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-800">{e.reason}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {e.createdAt.slice(0, 10)}
                        {/* 미지급 사유는 범주 수준으로만 안내한다 — 점수는 노출하지 않는다 */}
                        {e.statusReason && ` · ${e.statusReason}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${s.cls}`}>{s.text}</span>
                      <span className={`text-sm font-bold ${e.delta >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                        {e.delta >= 0 ? '+' : ''}{e.delta.toLocaleString()}P
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
