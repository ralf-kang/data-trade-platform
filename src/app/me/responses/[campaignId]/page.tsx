'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

interface Detail {
  formTitle: string;
  campaignName: string;
  submittedAt: string;
  revision: number;
  fields: Array<{ id: string; label: string; value: unknown | null; anonymous: boolean }>;
}

export default function MyResponseDetailPage() {
  const params = useParams();
  const campaignId = params?.campaignId as string;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) return;
    fetch(`/api/me/responses/${campaignId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setDetail(j?.detail ?? null))
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;
  if (!detail) return <div className="text-slate-500 text-sm">응답을 찾을 수 없습니다.</div>;

  const render = (v: unknown) =>
    Array.isArray(v) ? v.join(', ') : v === null || v === '' ? '—' : String(v);

  return (
    <div className="space-y-5">
      <Link href="/me/responses" className="text-sm text-slate-400 hover:text-slate-600 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> 내 응답으로
      </Link>

      <div>
        <h1 className="text-xl font-bold text-slate-900">{detail.formTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {detail.campaignName} · {detail.submittedAt.slice(0, 10)}
          {detail.revision > 0 && ` · ${detail.revision}회 수정`}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {detail.fields.map((f) => (
          <div key={f.id} className="px-5 py-3 grid grid-cols-3 gap-4">
            <div className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
              {f.label}
              {f.anonymous && <Lock className="w-3 h-3 text-slate-400" />}
            </div>
            <div className="col-span-2 text-sm">
              {f.anonymous ? (
                // 본인에게 보여주는 것조차 "당신과 연결되어 저장돼 있다"는 뜻이 되어
                // 익명성 주장이 무너진다. 응답 시점에 미리 고지한 제약이다.
                <span className="text-slate-400 italic">
                  익명으로 저장되어 조회할 수 없습니다
                </span>
              ) : (
                <span className="text-slate-900">{render(f.value)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
