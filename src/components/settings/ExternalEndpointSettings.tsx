'use client';

import { useEffect, useState } from 'react';
import { Network, Server, ShieldCheck, PlugZap, Loader2, CheckCircle2, XCircle } from 'lucide-react';

type EndpointMode = 'BUILTIN' | 'EXTERNAL' | 'DISABLED';

interface Endpoint {
  id: string;
  label: string;
  mode: EndpointMode;
  scheme: string | null;
  host: string | null;
  port: number | null;
  pathTemplate: string | null;
  hasApiKey: boolean;
  dataAsOf: string | null;
  lastCheckedAt: string | null;
  lastCheckOk: boolean | null;
  note: string | null;
}

const MODE_META: Record<EndpointMode, { label: string; cls: string }> = {
  BUILTIN: { label: '내장(로컬)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EXTERNAL: { label: '외부 연결', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  DISABLED: { label: '사용 안 함', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

/**
 * 외부 연결 목록 (docs/주소입력-지도분포-설계.md §3).
 * 폐쇄망 반입 시 방화벽 허용 목록을 이 표에서 그대로 뽑을 수 있어야 하므로,
 * 여기 보이는 값이 곧 실제 호출 대상이다(코드에 하드코딩된 목적지가 따로 없다).
 */
export default function ExternalEndpointSettings() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  const load = () => {
    fetch('/api/super-admin/external-endpoints')
      .then((r) => (r.ok ? r.json() : { endpoints: [] }))
      .then((j) => setEndpoints(j.endpoints ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setSavingId(id);
    await fetch('/api/super-admin/external-endpoints', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    setSavingId(null);
    load();
  };

  const runTest = async (id: string) => {
    setTestingId(id);
    const res = await fetch('/api/super-admin/external-endpoints', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'test' }),
    });
    const json = await res.json();
    setTestingId(null);
    setTestResult((prev) => ({ ...prev, [id]: json }));
    load();
  };

  if (loading) return <div className="p-6 text-sm text-slate-400">불러오는 중...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center">
        <Network className="w-5 h-5 text-indigo-600 mr-2" />
        <h2 className="font-bold text-slate-800">외부 연결 (방화벽 허용 목록)</h2>
      </div>

      <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-800 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          이 시스템이 외부로 요청을 보내는 <strong>모든 목적지</strong>입니다. 폐쇄망에 반입할 때 이
          표의 호스트·포트를 그대로 방화벽 허용 목록으로 사용할 수 있습니다.
          <strong> 여기 표시된 값이 곧 실제 호출 대상</strong>이며, 코드에 별도로 박힌 목적지는 없습니다.
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {endpoints.map((e) => (
          <div key={e.id} className="p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-800 text-sm">{e.label}</h3>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${MODE_META[e.mode].cls}`}>
                    {MODE_META[e.mode].label}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-slate-400 mt-0.5">{e.id}</p>
              </div>

              <select
                value={e.mode}
                onChange={(ev) => patch(e.id, { mode: ev.target.value })}
                disabled={savingId === e.id}
                className="text-xs p-1.5 border border-slate-300 rounded bg-white shrink-0"
              >
                <option value="EXTERNAL">외부 연결</option>
                <option value="BUILTIN">내장(로컬)</option>
                <option value="DISABLED">사용 안 함</option>
              </select>
            </div>

            {e.note && <p className="text-xs text-slate-500 mb-3 leading-relaxed">{e.note}</p>}

            {e.mode === 'EXTERNAL' && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2">
                  <input
                    defaultValue={e.scheme ?? 'https'}
                    onBlur={(ev) => ev.target.value !== (e.scheme ?? '') && patch(e.id, { scheme: ev.target.value })}
                    className="col-span-2 p-2 border border-slate-300 rounded text-xs font-mono"
                    placeholder="https"
                  />
                  <input
                    defaultValue={e.host ?? ''}
                    onBlur={(ev) => ev.target.value !== (e.host ?? '') && patch(e.id, { host: ev.target.value })}
                    className="col-span-7 p-2 border border-slate-300 rounded text-xs font-mono"
                    placeholder="호스트명 또는 IP"
                  />
                  <input
                    type="number"
                    defaultValue={e.port ?? ''}
                    onBlur={(ev) =>
                      Number(ev.target.value) !== e.port &&
                      patch(e.id, { port: ev.target.value ? Number(ev.target.value) : null })
                    }
                    className="col-span-3 p-2 border border-slate-300 rounded text-xs font-mono"
                    placeholder="포트"
                  />
                </div>

                <input
                  defaultValue={e.pathTemplate ?? ''}
                  onBlur={(ev) => ev.target.value !== (e.pathTemplate ?? '') && patch(e.id, { pathTemplate: ev.target.value })}
                  className="w-full p-2 border border-slate-300 rounded text-xs font-mono"
                  placeholder="URL 템플릿 (지도 타일: https://{s}.tile.example.com/{z}/{x}/{y}.png)"
                />

                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    onBlur={(ev) => ev.target.value && patch(e.id, { apiKey: ev.target.value })}
                    className="flex-1 p-2 border border-slate-300 rounded text-xs font-mono"
                    placeholder={e.hasApiKey ? '••••••• (설정됨 — 변경하려면 새 키 입력)' : 'API 키 (필요한 경우)'}
                  />
                  <button
                    onClick={() => runTest(e.id)}
                    disabled={testingId === e.id}
                    className="px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    {testingId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}
                    연결 확인
                  </button>
                </div>

                {testResult[e.id] && (
                  <div
                    className={`text-xs flex items-center gap-1.5 ${
                      testResult[e.id].ok ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {testResult[e.id].ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {testResult[e.id].message}
                  </div>
                )}
              </div>
            )}

            {e.mode === 'BUILTIN' && (
              <p className="text-xs text-slate-500">
                내장 데이터 기준일:{' '}
                <strong>{e.dataAsOf ? new Date(e.dataAsOf).toLocaleDateString('ko-KR') : '미설정'}</strong>
                {' — '}오프라인 갱신 체계에서는 갱신을 놓치면 신규 항목이 조회되지 않는 형태로 조용히
                실패하므로 기준일을 확인하세요.
              </p>
            )}

            {e.lastCheckedAt && (
              <p className="text-[11px] text-slate-400 mt-2">
                마지막 연결 확인: {new Date(e.lastCheckedAt).toLocaleString('ko-KR')}{' '}
                {e.lastCheckOk ? '✅' : '❌'}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
