'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarRange, ArrowLeft, Plus, Play, Square, Send, Users,
  Copy, Loader2, AlertTriangle,
} from 'lucide-react';
import type { FormListItem } from '@/lib/apiTypes';

interface Progress {
  targets: number;
  invited: number;
  opened: number;
  responded: number;
}

interface CampaignItem {
  id: string;
  name: string;
  sequence: number;
  status: 'SCHEDULED' | 'OPEN' | 'CLOSED';
  startsAt: string;
  endsAt: string | null;
  schemaVersion: number;
  anonymityThreshold: number | null;
  progress: Progress;
}

export default function CampaignsPage() {
  const params = useParams();
  const formId = (params?.formId as string) || '';

  const [form, setForm] = useState<FormListItem | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Array<{ email: string; link: string }> | null>(null);

  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/forms/${formId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/forms/${formId}/campaigns`).then((r) => (r.ok ? r.json() : { campaigns: [] })),
    ]).then(([f, c]) => {
      setForm(f?.form ?? null);
      setCampaigns(c.campaigns ?? []);
    }).finally(() => setLoading(false));
  }, [formId]);

  useEffect(() => { if (formId) load(); }, [formId, load]);

  const create = async () => {
    if (!name.trim() || !startsAt) { alert('회차 이름과 시작일을 입력해주세요.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/forms/${formId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, startsAt: new Date(startsAt).toISOString(), endsAt: endsAt ? new Date(endsAt).toISOString() : null }),
      });
      if (!res.ok) { alert((await res.json().catch(() => ({}))).message ?? '생성 실패'); return; }
      setName(''); setStartsAt(''); setEndsAt('');
      load();
    } finally { setBusy(false); }
  };

  const changeStatus = async (id: string, status: string, label: string) => {
    if (status === 'CLOSED' && !confirm(`${label}하시겠습니까?\n마감하면 이 회차의 익명 응답 잔여분이 정리되고, 더 이상 응답을 받지 않습니다.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { alert('상태 변경 실패'); return; }
      load();
    } finally { setBusy(false); }
  };

  const sendLinks = async (id: string) => {
    if (!confirm('전체 임직원에게 이 회차의 개인화 응답 링크를 발급합니다.\n링크는 발급 직후 한 번만 확인할 수 있습니다. 계속할까요?')) return;
    setBusy(true);
    setIssued(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/targets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ALL_MEMBERS' }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.message ?? '발급 실패'); return; }
      setIssued(json.issued ?? []);
      load();
    } finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">불러오는 중...</div>;
  if (!form) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">양식지를 찾을 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center mb-6">
          <Link href="/admin/templates/urls" className="text-slate-400 hover:text-slate-600 mr-4"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center">
              <CalendarRange className="w-6 h-6 mr-2 text-indigo-600" /> 수집 회차 — {form.title}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              같은 양식으로 반복 수집합니다. <strong>양식을 다시 만들 필요가 없고</strong>, 회차가 곧 추세 분석의 시간축이 됩니다.
            </p>
          </div>
        </div>

        {/* 발급된 링크 — 이 화면을 벗어나면 다시 볼 수 없다 */}
        {issued && issued.length > 0 && (
          <div className="mb-6 p-5 bg-emerald-50 border-2 border-emerald-300 rounded-xl">
            <h3 className="font-bold text-emerald-900 mb-2">개인화 링크 {issued.length}건이 발급되었습니다</h3>
            <p className="text-sm text-emerald-800 mb-3">
              <strong>이 화면을 벗어나면 다시 볼 수 없습니다.</strong> 서버에는 해시만 저장되어 원문을 복구할 수 없으니 지금 복사해 발송하세요.
            </p>
            <div className="bg-white rounded p-3 max-h-52 overflow-y-auto text-xs font-mono space-y-1 border border-emerald-200">
              {issued.map((i) => (
                <div key={i.email} className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 shrink-0">{i.email}</span>
                  <span className="truncate text-indigo-600">{i.link}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(issued.map((i) => `${i.email}\t${i.link}`).join('\n')); alert('복사되었습니다.'); }}
              className="mt-3 px-4 py-1.5 bg-emerald-600 text-white rounded text-sm font-bold hover:bg-emerald-700 inline-flex items-center"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" /> 전체 복사 (이메일/링크)
            </button>
          </div>
        )}

        {/* 새 회차 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center"><Plus className="w-4 h-4 mr-2" /> 새 회차 만들기</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-xs font-semibold text-slate-500 md:col-span-2">회차 이름
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="2026 Q3 정기조사" className="w-full mt-1 p-2 border rounded text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-500">시작일
              <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full mt-1 p-2 border rounded text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-500">마감일 (선택)
              <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full mt-1 p-2 border rounded text-sm" />
            </label>
          </div>
          <button onClick={create} disabled={busy} className="mt-3 px-6 py-2 bg-indigo-600 text-white rounded font-bold text-sm hover:bg-indigo-700 disabled:opacity-50">
            {busy ? '처리 중...' : '회차 생성'}
          </button>
        </div>

        {/* 회차 목록 */}
        <div className="space-y-3">
          {campaigns.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">아직 회차가 없습니다.</div>
          )}
          {campaigns.map((c) => {
            const p = c.progress;
            const pct = (n: number) => (p.targets > 0 ? Math.round((n / p.targets) * 100) : 0);
            return (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">#{c.sequence}</span>
                      <h4 className="font-bold text-slate-900">{c.name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                        c.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : c.status === 'SCHEDULED' ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {c.status === 'OPEN' ? '수집 중' : c.status === 'SCHEDULED' ? '시작 전' : '마감됨'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {c.startsAt.slice(0, 10)} ~ {c.endsAt ? c.endsAt.slice(0, 10) : '무기한'} · 스키마 v{c.schemaVersion}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {c.status !== 'CLOSED' && (
                      <button onClick={() => sendLinks(c.id)} disabled={busy}
                        className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 rounded text-xs font-bold hover:bg-indigo-50 disabled:opacity-50 inline-flex items-center">
                        {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />} 링크 발급
                      </button>
                    )}
                    {c.status === 'SCHEDULED' && (
                      <button onClick={() => changeStatus(c.id, 'OPEN', '수집 시작')} disabled={busy}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center">
                        <Play className="w-3.5 h-3.5 mr-1" /> 수집 시작
                      </button>
                    )}
                    {c.status === 'OPEN' && (
                      <button onClick={() => changeStatus(c.id, 'CLOSED', '마감')} disabled={busy}
                        className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 rounded text-xs font-bold hover:bg-rose-50 disabled:opacity-50 inline-flex items-center">
                        <Square className="w-3.5 h-3.5 mr-1" /> 마감
                      </button>
                    )}
                  </div>
                </div>

                {/* 발송/열람/응답을 나눠 보여준다 — 어디서 떨어지는지 알아야 무엇을 고칠지 안다 */}
                <div className="grid grid-cols-4 gap-3 text-center">
                  {([
                    ['대상', p.targets, 'text-slate-700'],
                    ['발송', p.invited, 'text-indigo-600'],
                    ['열람', p.opened, 'text-amber-600'],
                    ['응답', p.responded, 'text-emerald-600'],
                  ] as const).map(([l, v, cls]) => (
                    <div key={l} className="bg-slate-50 rounded p-2 border border-slate-200">
                      <div className={`text-lg font-bold ${cls}`}>{v}</div>
                      <div className="text-[11px] text-slate-500">{l}{l !== '대상' && p.targets > 0 ? ` (${pct(v)}%)` : ''}</div>
                    </div>
                  ))}
                </div>

                {p.targets > 0 && p.opened > 0 && (
                  <p className="mt-2 text-xs text-slate-500 flex items-start">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1 mt-0.5 shrink-0 text-slate-400" />
                    {pct(p.opened) < 50
                      ? '발송 대비 열람이 낮습니다 — 발송 채널이나 안내 문구를 점검해 보세요.'
                      : p.opened > 0 && p.responded / p.opened < 0.5
                        ? '열람 대비 응답이 낮습니다 — 양식이 길거나 어려운지 점검해 보세요.'
                        : '응답 흐름이 양호합니다.'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
