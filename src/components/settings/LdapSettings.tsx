'use client';

import { useEffect, useState } from 'react';
import {
  Network, Save, Loader2, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, KeyRound, Info, Users,
} from 'lucide-react';

/** 서버가 돌려주는 설정 — bindPassword는 절대 포함되지 않는다. */
interface LdapConfigView {
  enabled: boolean;
  host: string | null;
  port: number;
  encryption: 'NONE' | 'LDAPS' | 'STARTTLS';
  verifyCert: boolean;
  timeoutMs: number;
  bindDn: string | null;
  baseDn: string | null;
  userSearchFilter: string;
  userSearchScope: string;
  attrEmail: string;
  attrName: string;
  attrEmployeeNo: string | null;
  attrDepartment: string | null;
  attrPosition: string | null;
  defaultRole: 'MEMBER' | 'AUTHOR' | 'PLATFORM_ADMIN';
  deactivateMissing: boolean;
  hasBindPassword: boolean;
  encryptionConfigured: boolean;
  lastSyncAt: string | null;
  lastSyncResult: string | null;
}

interface DiagnosticResult {
  step: 'CONNECT' | 'TLS' | 'BIND' | 'SEARCH';
  ok: boolean;
  message: string;
  hint?: string;
}

interface TestResult {
  success: boolean;
  steps: DiagnosticResult[];
  sampleCount?: number;
  sampleAttributes?: Record<string, string>;
}

interface SyncResult {
  created: number;
  updated: number;
  deactivated: number;
  skipped: Array<{ dn: string; reason: string }>;
  total: number;
}

const STEP_LABEL: Record<DiagnosticResult['step'], string> = {
  CONNECT: '1. 서버 연결',
  TLS: '2. 암호화 채널',
  BIND: '3. 계정 인증',
  SEARCH: '4. 사용자 검색',
};

export default function LdapSettings() {
  const [config, setConfig] = useState<LdapConfigView | null>(null);
  const [bindPassword, setBindPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    fetch('/api/ldap-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setConfig(json?.config ?? null))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof LdapConfigView>(key: K, value: LdapConfigView[K]) =>
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...config };
      // 비워두면 기존 비밀번호를 유지한다(서버에서 undefined는 '유지'로 해석).
      if (bindPassword) body.bindPassword = bindPassword;
      delete body.hasBindPassword;
      delete body.encryptionConfigured;
      delete body.lastSyncAt;
      delete body.lastSyncResult;

      const res = await fetch('/api/ldap-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.message ?? '저장에 실패했습니다.');
        return;
      }
      setConfig(json.config);
      setBindPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ldap-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bindPassword ? { bindPassword } : {}),
      });
      setTestResult(await res.json());
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    if (!confirm('LDAP 디렉터리의 사용자를 가져옵니다.\n디렉터리에서 사라진 계정은 삭제되지 않고 "이탈(LEFT)"로 표시됩니다.\n계속할까요?')) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/ldap-config/sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        alert(json.message ?? '동기화에 실패했습니다.');
        return;
      }
      setSyncResult(json.result);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-6 text-slate-400 text-sm">LDAP 설정을 불러오는 중...</div>;
  }
  if (!config) {
    return <div className="bg-white rounded-xl border border-slate-200 p-6 text-slate-500 text-sm">LDAP 설정을 불러오지 못했습니다.</div>;
  }

  const label = 'block text-xs font-semibold text-slate-500 mb-1';
  const input = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center">
          <Network className="w-5 h-5 text-indigo-600 mr-2" />
          <h2 className="font-bold text-slate-800">LDAP / Active Directory 연동</h2>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
            className="w-4 h-4"
          />
          연동 사용
        </label>
      </div>

      <div className="p-6 space-y-6">
        {!config.encryptionConfigured && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start text-sm text-rose-900">
            <AlertTriangle className="w-5 h-5 mr-2 mt-0.5 shrink-0 text-rose-600" />
            <div>
              <strong>APP_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.</strong>
              <p className="mt-1">
                바인딩 비밀번호를 암호화해 저장할 수 없어 설정이 실패합니다.
                32자 이상의 무작위 문자열을 <code className="font-mono">.env</code>에 추가한 뒤 다시 시도하세요.
              </p>
            </div>
          </div>
        )}

        {/* ── 연결 ── */}
        <section>
          <h3 className="font-bold text-slate-800 text-sm mb-3">연결</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className={label}>호스트</label>
              <input className={input} value={config.host ?? ''} placeholder="ldap.company.com"
                onChange={(e) => set('host', e.target.value)} />
            </div>
            <div>
              <label className={label}>포트</label>
              <input className={input} type="number" value={config.port}
                onChange={(e) => set('port', Number(e.target.value))} />
            </div>
            <div>
              <label className={label}>암호화</label>
              <select className={input} value={config.encryption}
                onChange={(e) => {
                  const enc = e.target.value as LdapConfigView['encryption'];
                  set('encryption', enc);
                  // 흔한 실수를 줄이기 위해 표준 포트를 함께 맞춰준다.
                  if (enc === 'LDAPS' && config.port === 389) set('port', 636);
                  if (enc !== 'LDAPS' && config.port === 636) set('port', 389);
                }}>
                <option value="STARTTLS">STARTTLS (389)</option>
                <option value="LDAPS">LDAPS (636)</option>
                <option value="NONE">암호화 없음</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 mt-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={config.verifyCert}
                onChange={(e) => set('verifyCert', e.target.checked)} />
              인증서 검증
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">타임아웃(ms)</span>
              <input className="w-24 px-2 py-1 border border-slate-300 rounded text-sm" type="number"
                value={config.timeoutMs} onChange={(e) => set('timeoutMs', Number(e.target.value))} />
            </div>
          </div>
          {config.encryption === 'NONE' && (
            <p className="mt-2 text-xs text-rose-600">
              ⚠ 평문 연결은 자격증명이 그대로 전송됩니다. 폐쇄망이 아니면 STARTTLS 또는 LDAPS를 사용하세요.
            </p>
          )}
          {!config.verifyCert && (
            <p className="mt-2 text-xs text-amber-600">
              ⚠ 인증서 검증을 끄면 중간자 공격에 노출됩니다. 사내 자체서명 인증서 테스트 용도로만 임시 사용하세요.
            </p>
          )}
        </section>

        {/* ── 바인딩 ── */}
        <section className="pt-4 border-t border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center">
            <KeyRound className="w-4 h-4 mr-1.5 text-slate-500" /> 검색용 바인딩 계정
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            사용자를 검색할 때 사용할 서비스 계정입니다. 대부분의 디렉터리는 익명 검색을 막아두므로 설정이 필요합니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Bind DN</label>
              <input className={input} value={config.bindDn ?? ''} placeholder="cn=svc-forms,ou=service,dc=company,dc=com"
                onChange={(e) => set('bindDn', e.target.value)} />
            </div>
            <div>
              <label className={label}>
                Bind 비밀번호
                {config.hasBindPassword && <span className="ml-2 text-emerald-600">저장됨</span>}
              </label>
              <input className={input} type="password" value={bindPassword}
                placeholder={config.hasBindPassword ? '변경할 때만 입력 (비워두면 유지)' : '비밀번호'}
                onChange={(e) => setBindPassword(e.target.value)} />
            </div>
          </div>
        </section>

        {/* ── 검색 ── */}
        <section className="pt-4 border-t border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm mb-3">사용자 검색</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className={label}>Base DN</label>
              <input className={input} value={config.baseDn ?? ''} placeholder="ou=users,dc=company,dc=com"
                onChange={(e) => set('baseDn', e.target.value)} />
            </div>
            <div>
              <label className={label}>검색 범위</label>
              <select className={input} value={config.userSearchScope}
                onChange={(e) => set('userSearchScope', e.target.value)}>
                <option value="sub">하위 전체 (sub)</option>
                <option value="one">직계 하위 (one)</option>
                <option value="base">해당 항목만 (base)</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className={label}>검색 필터</label>
            <input className={`${input} font-mono`} value={config.userSearchFilter}
              onChange={(e) => set('userSearchFilter', e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">
              <code className="font-mono">{'{username}'}</code> 자리에 로그인 아이디가 들어갑니다.
              AD 예시: <code className="font-mono">(&(objectClass=user)(sAMAccountName={'{username}'}))</code>
            </p>
          </div>
        </section>

        {/* ── 속성 매핑 ── */}
        <section className="pt-4 border-t border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm mb-1">속성 매핑</h3>
          <p className="text-xs text-slate-500 mb-3">
            LDAP 속성명을 이 시스템의 사용자 필드로 연결합니다. 부서·직급은 부서별 통계와 소수 응답 보호의 기준이 됩니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={label}>이메일 ← </label>
              <input className={`${input} font-mono`} value={config.attrEmail} onChange={(e) => set('attrEmail', e.target.value)} /></div>
            <div><label className={label}>이름 ← </label>
              <input className={`${input} font-mono`} value={config.attrName} onChange={(e) => set('attrName', e.target.value)} /></div>
            <div><label className={label}>사번 ← </label>
              <input className={`${input} font-mono`} value={config.attrEmployeeNo ?? ''} onChange={(e) => set('attrEmployeeNo', e.target.value)} /></div>
            <div><label className={label}>부서 ← </label>
              <input className={`${input} font-mono`} value={config.attrDepartment ?? ''} onChange={(e) => set('attrDepartment', e.target.value)} /></div>
            <div><label className={label}>직급 ← </label>
              <input className={`${input} font-mono`} value={config.attrPosition ?? ''} onChange={(e) => set('attrPosition', e.target.value)} /></div>
          </div>
        </section>

        {/* ── 동기화 정책 ── */}
        <section className="pt-4 border-t border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm mb-3">동기화 정책</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>신규 계정 기본 역할</label>
              <select className={input} value={config.defaultRole}
                onChange={(e) => set('defaultRole', e.target.value as LdapConfigView['defaultRole'])}>
                <option value="MEMBER">MEMBER — 응답자 (권장)</option>
                <option value="AUTHOR">AUTHOR — 양식 제작 가능</option>
                <option value="PLATFORM_ADMIN">PLATFORM_ADMIN — 전체 권한</option>
              </select>
              {config.defaultRole === 'PLATFORM_ADMIN' && (
                <p className="text-xs text-rose-600 mt-1">
                  ⚠ 동기화되는 모든 계정이 플랫폼 관리자가 됩니다. 의도한 설정인지 확인하세요.
                </p>
              )}
            </div>
            <div className="flex items-end">
              <label className="flex items-start gap-2 text-sm text-slate-700 pb-2">
                <input type="checkbox" className="mt-0.5" checked={config.deactivateMissing}
                  onChange={(e) => set('deactivateMissing', e.target.checked)} />
                <span>
                  디렉터리에서 사라진 계정을 <strong>이탈(LEFT)</strong>로 표시
                  <span className="block text-xs text-slate-400">삭제하지 않습니다 — 과거 응답·소유 이력이 보존됩니다.</span>
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* ── 동작 ── */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm">
            {saved ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? '저장 중...' : saved ? '저장됨' : '설정 저장'}
          </button>
          <button onClick={handleTest} disabled={testing}
            className="flex items-center px-6 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50 text-sm">
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Network className="w-4 h-4 mr-2" />}
            {testing ? '테스트 중...' : '연결 테스트'}
          </button>
          <button onClick={handleSync} disabled={syncing || !config.enabled}
            title={!config.enabled ? '연동을 사용으로 설정하고 저장한 뒤 실행할 수 있습니다' : undefined}
            className="flex items-center px-6 py-2 bg-white border border-emerald-300 text-emerald-700 font-bold rounded-lg hover:bg-emerald-50 disabled:opacity-50 text-sm">
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {syncing ? '동기화 중...' : '사용자 동기화'}
          </button>
          {config.lastSyncAt && (
            <span className="self-center text-xs text-slate-400">
              마지막 동기화: {config.lastSyncAt.slice(0, 16).replace('T', ' ')}
            </span>
          )}
        </div>

        {/* ── 진단 결과 ── */}
        {testResult && (
          <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            <h4 className={`font-bold text-sm mb-3 ${testResult.success ? 'text-emerald-900' : 'text-rose-900'}`}>
              {testResult.success ? '✅ 연결 정상' : '❌ 연결 실패 — 아래 단계를 확인하세요'}
            </h4>
            <div className="space-y-2">
              {testResult.steps.map((s, i) => (
                <div key={i} className="flex items-start text-sm">
                  {s.ok ? <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 text-emerald-600 shrink-0" />
                        : <XCircle className="w-4 h-4 mr-2 mt-0.5 text-rose-600 shrink-0" />}
                  <div>
                    <span className="font-semibold text-slate-700">{STEP_LABEL[s.step]}</span>
                    <span className="text-slate-600"> — {s.message}</span>
                    {s.hint && (
                      <p className="text-xs text-slate-500 mt-0.5 flex items-start">
                        <Info className="w-3 h-3 mr-1 mt-0.5 shrink-0" />{s.hint}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {testResult.sampleAttributes && (
              <div className="mt-4 pt-3 border-t border-emerald-200">
                <p className="text-xs font-bold text-slate-600 mb-2">
                  표본 1건의 속성 — 위 &ldquo;속성 매핑&rdquo;이 맞는지 확인하세요
                </p>
                <div className="bg-white rounded p-3 font-mono text-xs space-y-0.5 max-h-40 overflow-y-auto">
                  {Object.entries(testResult.sampleAttributes).map(([k, v]) => (
                    <div key={k}><span className="text-indigo-600">{k}</span>: {v}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 동기화 결과 ── */}
        {syncResult && (
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
            <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" /> 동기화 결과 (총 {syncResult.total}건 조회)
            </h4>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                ['신규', syncResult.created, 'text-emerald-600'],
                ['갱신', syncResult.updated, 'text-indigo-600'],
                ['이탈 처리', syncResult.deactivated, 'text-amber-600'],
                ['건너뜀', syncResult.skipped.length, 'text-slate-500'],
              ].map(([l, v, c]) => (
                <div key={l as string} className="bg-white rounded p-3 border border-slate-200">
                  <div className={`text-xl font-bold ${c}`}>{v as number}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{l as string}</div>
                </div>
              ))}
            </div>
            {syncResult.skipped.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-slate-600 mb-1">건너뛴 항목</p>
                <div className="bg-white rounded p-2 text-xs space-y-1 max-h-32 overflow-y-auto border border-slate-200">
                  {syncResult.skipped.map((s, i) => (
                    <div key={i} className="text-slate-600">
                      <span className="font-mono text-slate-400">{s.dn}</span> — {s.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
