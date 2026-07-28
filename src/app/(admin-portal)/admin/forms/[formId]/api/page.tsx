'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plug, Key, FileCode2, PlayCircle, Copy, Trash2, ArrowLeft,
  CheckCircle2, AlertTriangle, Lock, Loader2, Plus,
} from 'lucide-react';
import type { ApiKeyItem, FormListItem } from '@/lib/apiTypes';

type Tab = 'keys' | 'contract' | 'playground';

export default function FormApiConsolePage() {
  const params = useParams();
  const formId = (params?.formId as string) || '';

  const [form, setForm] = useState<FormListItem | null>(null);
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('keys');
  const [baseUrl, setBaseUrl] = useState('');

  const loadKeys = useCallback(() => {
    fetch(`/api/forms/${formId}/api-keys`)
      .then((res) => (res.ok ? res.json() : { keys: [] }))
      .then((json) => setKeys(json.keys ?? []));
  }, [formId]);

  useEffect(() => {
    if (!formId) return;
    Promise.all([
      fetch(`/api/forms/${formId}`).then((res) => (res.ok ? res.json() : null)),
      fetch(`/api/forms/${formId}/api-keys`).then((res) => (res.ok ? res.json() : { keys: [] })),
      fetch('/api/system-config').then((res) => (res.ok ? res.json() : { config: {} })),
    ])
      .then(([formJson, keysJson, configJson]) => {
        setForm(formJson?.form ?? null);
        setKeys(keysJson.keys ?? []);
        setBaseUrl(configJson.config?.publicBaseUrl || window.location.origin);
      })
      .finally(() => setLoading(false));
  }, [formId]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">불러오는 중...</div>;
  }
  if (!form) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">양식지를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Link href="/admin/templates/urls" className="text-slate-400 hover:text-slate-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center">
                <Plug className="w-6 h-6 mr-2 text-indigo-600" />
                외부 연동 API — {form.title}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                양식지 <span className="font-mono">{formId}</span> · 스키마 v{form.schemaVersion}
              </p>
            </div>
          </div>
          <LifecycleBadge form={form} onChanged={setForm} />
        </div>

        {form.lifecycle === 'DRAFT' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-900">
              <strong>초안(DRAFT) 상태입니다.</strong> 필드 구성이 계속 바뀔 수 있어 외부 API <strong>입력이 차단</strong>되어 있습니다.
              설계가 끝났다면 위의 <em>확정하기</em>를 눌러 계약을 고정하세요. (조회 API는 초안 상태에서도 사용할 수 있습니다.)
            </div>
          </div>
        )}

        <div className="flex border-b border-slate-200 mb-6">
          {([
            ['keys', 'API 키 관리', Key],
            ['contract', '연동 계약(스키마)', FileCode2],
            ['playground', '테스트 콘솔', PlayCircle],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
                tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" /> {label}
            </button>
          ))}
        </div>

        {tab === 'keys' && <KeysTab formId={formId} keys={keys} onChanged={loadKeys} />}
        {tab === 'contract' && <ContractTab form={form} baseUrl={baseUrl} />}
        {tab === 'playground' && <PlaygroundTab formId={formId} form={form} baseUrl={baseUrl} />}
      </div>
    </div>
  );
}

function LifecycleBadge({ form, onChanged }: { form: FormListItem; onChanged: (f: FormListItem) => void }) {
  const [busy, setBusy] = useState(false);
  const isPublished = form.lifecycle === 'PUBLISHED';

  const toggle = async () => {
    const next = isPublished ? 'DRAFT' : 'PUBLISHED';
    if (next === 'DRAFT' && !confirm('초안으로 되돌리면 외부 API 입력이 즉시 차단됩니다. 계속할까요?')) return;
    if (next === 'PUBLISHED' && !confirm('현재 필드 구성을 외부 연동 계약으로 확정합니다. 계속할까요?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lifecycle: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.message ?? '변경에 실패했습니다.');
        return;
      }
      const { form: updated } = await res.json();
      onChanged(updated);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
        isPublished ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}>
        {isPublished ? '확정됨 (PUBLISHED)' : '초안 (DRAFT)'}
      </span>
      <button
        onClick={toggle}
        disabled={busy}
        className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 ${
          isPublished ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'
        }`}
      >
        {busy ? '처리 중...' : isPublished ? '초안으로 되돌리기' : '확정하기'}
      </button>
    </div>
  );
}

function KeysTab({ formId, keys, onChanged }: { formId: string; keys: ApiKeyItem[]; onChanged: () => void }) {
  // 만료 판정 기준 시각을 렌더 중 Date.now()로 읽으면 렌더가 순수하지 않게 되므로,
  // 마운트 시점에 한 번 고정한다(만료 표시는 초 단위 정확도가 필요하지 않다).
  const [now] = useState(() => Date.now());
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'READ' | 'WRITE' | 'READ_WRITE'>('READ');
  const [rateLimit, setRateLimit] = useState('60');
  const [expiresAt, setExpiresAt] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const issue = async () => {
    if (!name.trim()) { alert('키 이름을 입력해주세요.'); return; }
    setIssuing(true);
    try {
      const res = await fetch(`/api/forms/${formId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scope, rateLimitPerMin: Number(rateLimit) || 60, expiresAt: expiresAt || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.message ?? '발급에 실패했습니다.');
        return;
      }
      const { plaintextKey } = await res.json();
      setNewKey(plaintextKey);
      setName('');
      onChanged();
    } finally {
      setIssuing(false);
    }
  };

  const revoke = async (keyId: string, keyName: string) => {
    if (!confirm(`[${keyName}] 키를 폐기하시겠습니까?\n해당 키를 쓰는 연동은 즉시 중단됩니다.`)) return;
    const res = await fetch(`/api/forms/${formId}/api-keys/${keyId}`, { method: 'DELETE' });
    if (!res.ok) { alert('폐기에 실패했습니다.'); return; }
    onChanged();
  };

  return (
    <div className="space-y-6">
      {newKey && (
        <div className="p-5 bg-emerald-50 border-2 border-emerald-300 rounded-xl">
          <div className="flex items-center mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mr-2" />
            <h3 className="font-bold text-emerald-900">API 키가 발급되었습니다</h3>
          </div>
          <p className="text-sm text-emerald-800 mb-3">
            <strong>이 화면을 벗어나면 다시 볼 수 없습니다.</strong> 지금 안전한 곳에 복사해 두세요.
            (서버에는 해시만 저장되어 원문을 복구할 수 없습니다.)
          </p>
          <div className="flex gap-2">
            <code className="flex-1 p-3 bg-white border border-emerald-200 rounded font-mono text-sm break-all">{newKey}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(newKey); alert('복사되었습니다.'); }}
              className="px-4 bg-emerald-600 text-white rounded font-bold text-sm hover:bg-emerald-700"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-3 text-xs text-emerald-700 hover:underline">확인했습니다 (닫기)</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center"><Plus className="w-4 h-4 mr-2" /> 새 API 키 발급</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-xs font-semibold text-slate-500 md:col-span-2">키 이름 (용도 식별)
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: ERP 연동 (읽기전용)" className="w-full mt-1 p-2 border rounded text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-500">권한
            <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="w-full mt-1 p-2 border rounded text-sm bg-white">
              <option value="READ">READ — 조회만</option>
              <option value="WRITE">WRITE — 입력만</option>
              <option value="READ_WRITE">READ_WRITE — 조회+입력</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">분당 요청 한도
            <input type="number" value={rateLimit} onChange={(e) => setRateLimit(e.target.value)} className="w-full mt-1 p-2 border rounded text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-500 md:col-span-2">만료일 (선택 — 비우면 무기한)
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full mt-1 p-2 border rounded text-sm" />
          </label>
          <div className="md:col-span-2 flex items-end">
            <button onClick={issue} disabled={issuing} className="w-full py-2 bg-indigo-600 text-white rounded font-bold text-sm hover:bg-indigo-700 disabled:opacity-50">
              {issuing ? '발급 중...' : '키 발급'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 font-bold text-slate-900 text-sm">발급된 키 ({keys.length})</div>
        {keys.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">발급된 API 키가 없습니다.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-2 text-left text-xs font-bold text-slate-500">이름 / 키</th>
                <th className="px-5 py-2 text-left text-xs font-bold text-slate-500">권한</th>
                <th className="px-5 py-2 text-left text-xs font-bold text-slate-500">사용</th>
                <th className="px-5 py-2 text-left text-xs font-bold text-slate-500">상태</th>
                <th className="px-5 py-2 text-right text-xs font-bold text-slate-500">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map((k) => {
                const revoked = !!k.revokedAt;
                const expired = !!k.expiresAt && new Date(k.expiresAt).getTime() < now;
                return (
                  <tr key={k.id} className={revoked || expired ? 'opacity-50' : ''}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{k.name}</div>
                      <div className="font-mono text-xs text-slate-400">{k.keyPrefix}••••••••</div>
                    </td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-bold">{k.scope}</span></td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {k.useCount.toLocaleString()}회
                      {k.lastUsedAt && <div className="text-slate-400">최근 {k.lastUsedAt.slice(0, 10)}</div>}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {revoked ? <span className="text-rose-600 font-bold">폐기됨</span>
                        : expired ? <span className="text-amber-600 font-bold">만료됨</span>
                        : <span className="text-emerald-600 font-bold">활성</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!revoked && (
                        <button onClick={() => revoke(k.id, k.name)} className="text-rose-600 hover:text-rose-800 text-xs font-bold inline-flex items-center">
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> 폐기
                        </button>
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
  );
}

// 렌더 중에 컴포넌트를 새로 만들면 매 렌더마다 상태가 초기화되므로 최상위에 선언한다.
function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden">
      <div className="flex justify-between items-center px-4 py-2 bg-slate-800">
        <span className="text-xs font-bold text-slate-300">{title}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); alert('복사되었습니다.'); }}
          className="text-slate-400 hover:text-white"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
      <pre className="p-4 text-xs text-slate-200 overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

function ContractTab({ form, baseUrl }: { form: FormListItem; baseUrl: string }) {
  const endpoint = `${baseUrl}/api/v1/forms/${form.id}`;
  const sampleRow = Object.fromEntries(
    form.fields.slice(0, 3).map((f) => [f.id, f.type === 'number' ? 123 : `${f.label} 값`])
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-slate-900 text-sm">필드 계약 (schema v{form.schemaVersion})</span>
          <span className="text-xs text-slate-400">외부 시스템은 아래 <strong>id</strong>를 키로 사용합니다</span>
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-2 text-left text-xs font-bold text-slate-500">필드 id (API 키값)</th>
              <th className="px-5 py-2 text-left text-xs font-bold text-slate-500">라벨</th>
              <th className="px-5 py-2 text-left text-xs font-bold text-slate-500">타입</th>
              <th className="px-5 py-2 text-left text-xs font-bold text-slate-500">필수</th>
              <th className="px-5 py-2 text-left text-xs font-bold text-slate-500">제약</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {form.fields.map((f) => (
              <tr key={f.id}>
                <td className="px-5 py-2 font-mono text-xs text-indigo-700">{f.id}</td>
                <td className="px-5 py-2 text-slate-700">{f.label}</td>
                <td className="px-5 py-2 text-slate-500 text-xs">{f.type}</td>
                <td className="px-5 py-2">{f.required ? <span className="text-rose-600 font-bold text-xs">필수</span> : <span className="text-slate-400 text-xs">선택</span>}</td>
                <td className="px-5 py-2 text-xs text-slate-500">
                  {f.options?.length ? `선택지: ${f.options.join(', ')}` : f.regexPattern ? <code className="font-mono">{f.regexPattern}</code> : '—'}
                </td>
              </tr>
            ))}
            {form.fields.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400">정의된 필드가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <CodeBlock title="1) 계약 조회" code={`curl -H "Authorization: Bearer \$API_KEY" \\
  ${endpoint}/schema`} />

      <CodeBlock title="2) 대량 조회 (커서 페이지네이션 — nextCursor가 null이 될 때까지 반복)" code={`curl -H "Authorization: Bearer \$API_KEY" \\
  "${endpoint}/submissions?pageSize=100"

# 증분 동기화 (해당 시각 이후 신규분만)
curl -H "Authorization: Bearer \$API_KEY" \\
  "${endpoint}/submissions?since=2026-07-01T00:00:00Z"

# 이어받기
curl -H "Authorization: Bearer \$API_KEY" \\
  "${endpoint}/submissions?cursor=\$NEXT_CURSOR"`} />

      <CodeBlock title="3) 대량 입력 (externalId로 멱등 — 재전송해도 중복 적재 안 됨)" code={`curl -X POST -H "Authorization: Bearer \$API_KEY" \\
  -H "Content-Type: application/json" \\
  ${endpoint}/submissions/bulk \\
  -d '${JSON.stringify({ mode: 'lenient', rows: [{ externalId: 'ERP-0001', data: sampleRow }] }, null, 2)}'

# mode: "lenient"(기본) 유효한 행만 적재 · "strict" 한 건이라도 오류면 전량 거부
# 응답: 200 전량수용 / 207 부분수용 / 422 전량거부, 행별 status(accepted|rejected|duplicate)`} />

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
        <strong>스키마 버전 관리:</strong> 응답 헤더 <code className="font-mono">X-Form-Schema-Version</code>으로 현재 계약 버전을 알 수 있습니다.
        확정된 양식지의 필드를 수정하면 이 값이 올라가므로, 연동 측에서 값이 바뀌면 매핑을 점검하도록 구현하세요.
      </div>
    </div>
  );
}

function PlaygroundTab({ formId, form, baseUrl }: { formId: string; form: FormListItem; baseUrl: string }) {
  const [apiKey, setApiKey] = useState('');
  const [action, setAction] = useState<'schema' | 'list' | 'bulk'>('schema');
  const [bulkBody, setBulkBody] = useState(() =>
    JSON.stringify(
      {
        mode: 'lenient',
        rows: [
          {
            externalId: 'TEST-0001',
            data: Object.fromEntries(form.fields.slice(0, 3).map((f) => [f.id, f.type === 'number' ? 30 : '테스트값'])),
          },
        ],
      },
      null,
      2
    )
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ status: number; body: string } | null>(null);

  const run = async () => {
    if (!apiKey.trim()) { alert('발급받은 API 키를 입력해주세요.'); return; }
    setRunning(true);
    setResult(null);
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${apiKey.trim()}` };
      let res: Response;
      if (action === 'schema') {
        res = await fetch(`/api/v1/forms/${formId}/schema`, { headers });
      } else if (action === 'list') {
        res = await fetch(`/api/v1/forms/${formId}/submissions?pageSize=5`, { headers });
      } else {
        res = await fetch(`/api/v1/forms/${formId}/submissions/bulk`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: bulkBody,
        });
      }
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* 원문 유지 */ }
      setResult({ status: res.status, body: pretty });
    } catch (e) {
      setResult({ status: 0, body: String(e) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-4 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 flex items-start">
        <Lock className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
        <span>
          발급받은 키를 붙여넣어 실제 API를 호출해 봅니다. 이 화면에서 입력한 키는 브라우저 메모리에만 있고 저장되지 않습니다.
          <strong> 실제 데이터가 조회/적재되므로</strong> 테스트 시 유의하세요.
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <label className="block text-xs font-semibold text-slate-500">API 키
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="wre_..."
            className="w-full mt-1 p-2 border rounded text-sm font-mono"
          />
        </label>

        <div className="flex gap-2">
          {([['schema', '계약 조회'], ['list', '대량 조회(5건)'], ['bulk', '대량 입력']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setAction(id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold border ${
                action === id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {action === 'bulk' && (
          <label className="block text-xs font-semibold text-slate-500">요청 본문 (JSON)
            <textarea
              value={bulkBody}
              onChange={(e) => setBulkBody(e.target.value)}
              rows={10}
              className="w-full mt-1 p-3 border rounded font-mono text-xs"
            />
          </label>
        )}

        <div className="flex items-center gap-3">
          <button onClick={run} disabled={running} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 disabled:opacity-50 inline-flex items-center">
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
            {running ? '호출 중...' : '실행'}
          </button>
          <span className="text-xs text-slate-400 font-mono">
            {action === 'schema' && `GET ${baseUrl}/api/v1/forms/${formId}/schema`}
            {action === 'list' && `GET ${baseUrl}/api/v1/forms/${formId}/submissions?pageSize=5`}
            {action === 'bulk' && `POST ${baseUrl}/api/v1/forms/${formId}/submissions/bulk`}
          </span>
        </div>
      </div>

      {result && (
        <div className="bg-slate-900 rounded-xl overflow-hidden">
          <div className={`px-4 py-2 text-xs font-bold ${
            result.status >= 200 && result.status < 300 ? 'bg-emerald-700 text-white'
              : result.status === 207 ? 'bg-amber-600 text-white' : 'bg-rose-700 text-white'
          }`}>
            HTTP {result.status || '요청 실패'}
          </div>
          <pre className="p-4 text-xs text-slate-200 overflow-x-auto max-h-96">{result.body}</pre>
        </div>
      )}
    </div>
  );
}
