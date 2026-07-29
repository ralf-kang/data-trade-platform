'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Lock, TrendingUp, Pencil } from 'lucide-react';

interface Item {
  campaignId: string;
  campaignName: string;
  sequence: number;
  formId: string;
  formTitle: string;
  submittedAt: string;
  revision: number;
  hasAnonymousFields: boolean;
}

export default function MyResponsesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/me/responses')
      .then((r) => (r.ok ? r.json() : { responses: [] }))
      .then((j) => setItems(j.responses ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;

  // 양식지 단위로 묶는다 — 회차가 여러 개인 양식은 한 덩어리로 보여야 추세가 눈에 들어온다.
  const byForm = new Map<string, Item[]>();
  for (const it of items) {
    if (!byForm.has(it.formId)) byForm.set(it.formId, []);
    byForm.get(it.formId)!.push(it);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">내 응답</h1>
        <p className="text-sm text-slate-500 mt-1">응답한 양식지와 회차별 이력입니다.</p>
      </div>

      {byForm.size === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
          아직 응답한 양식지가 없습니다.
        </div>
      )}

      {[...byForm.entries()].map(([formId, list]) => (
        <section key={formId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <h2 className="font-bold text-slate-800 text-sm">{list[0].formTitle}</h2>
              <span className="text-xs text-slate-400">{list.length}회 참여</span>
            </div>
            {/* 회차가 2개 이상일 때만 추세가 성립한다 */}
            {list.length >= 2 && (
              <Link
                href={`/me/trends/${formId}`}
                className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
              >
                <TrendingUp className="w-3.5 h-3.5" /> 나의 변화 보기
              </Link>
            )}
          </div>
          <ul className="divide-y divide-slate-100">
            {list.map((it) => (
              <li key={it.campaignId} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400">#{it.sequence}</span>
                  <div>
                    <div className="text-sm font-medium text-slate-800">{it.campaignName}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{it.submittedAt.slice(0, 10)}</span>
                      {it.revision > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Pencil className="w-3 h-3" /> {it.revision}회 수정
                        </span>
                      )}
                      {it.hasAnonymousFields && (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Lock className="w-3 h-3" /> 익명 문항 포함
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/me/responses/${it.campaignId}`}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  내용 보기
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
