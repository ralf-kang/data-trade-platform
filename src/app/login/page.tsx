'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Info, KeyRound, Loader2, Mail, Monitor, Shield, User,
} from 'lucide-react';

/**
 * 로그인 — 모든 검증은 서버 라우트에서 하고, 세션 쿠키도 서버가 서명해서 발급한다.
 *
 *  - 임직원·관리자: Windows(AD/LDAP) 계정 아이디/비밀번호 (/api/auth/ldap-login)
 *    LDAP 연동이 아직 꺼져 있으면 과도기용 이메일 간편 로그인(/api/auth/email-login)을 보여준다.
 *  - 최고 관리자: 등록된 관리자 메일로 받은 6자리 인증번호 (/api/auth/super/*)
 */

type Tab = 'user' | 'super';

interface Methods {
  ldapEnabled: boolean;
  superAdminEmailMasked: string;
}

// 입력칸 공통 스타일 — 글자색/배경을 명시해 OS 다크모드와 무관하게 항상 잘 보이게 한다.
const INPUT =
  'block w-full pl-10 pr-3 py-3 bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-xl ' +
  'focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all text-[15px]';

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('user');
  const [methods, setMethods] = useState<Methods | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Windows 계정
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // 이메일 간편 로그인(LDAP 미설정 시)
  const [email, setEmail] = useState('');
  const [target, setTarget] = useState<'member' | 'admin'>('member');
  // 최고 관리자 인증번호
  const [codeSent, setCodeSent] = useState<{ to: string; ttl: number } | null>(null);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/auth/methods')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        // 메인 화면의 "최고 관리자 로그인" 링크(/login?tab=super)로 들어오면 해당 탭을 바로 연다.
        if (new URLSearchParams(window.location.search).get('tab') === 'super') setTab('super');
        setMethods(m ?? { ldapEnabled: false, superAdminEmailMasked: '' });
      })
      .catch(() => setMethods({ ldapEnabled: false, superAdminEmailMasked: '' }));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError('');
  };

  const handleWindowsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { ok, json } = await postJson('/api/auth/ldap-login', { username, password });
    setBusy(false);
    if (!ok) return setError(json.message ?? '로그인에 실패했습니다.');
    router.push(json.redirect ?? '/me');
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { ok, json } = await postJson('/api/auth/email-login', { email, target });
    setBusy(false);
    if (!ok) return setError(json.message ?? '로그인에 실패했습니다.');
    router.push(json.redirect ?? '/me');
  };

  const handleSendCode = async () => {
    setBusy(true);
    setError('');
    const { ok, json } = await postJson('/api/auth/super/send-code', {});
    setBusy(false);
    if (!ok) {
      if (json.retryAfterSec) setCooldown(json.retryAfterSec);
      return setError(json.message ?? '인증번호를 보내지 못했습니다.');
    }
    setCodeSent({ to: json.sentTo, ttl: json.ttlMinutes });
    setCooldown(60);
    setCode('');
    setTimeout(() => codeRef.current?.focus(), 50);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { ok, json } = await postJson('/api/auth/super/verify-code', { code });
    setBusy(false);
    if (!ok) return setError(json.message ?? '인증에 실패했습니다.');
    router.push(json.redirect ?? '/super-admin');
  };

  const isSuper = tab === 'super';

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex flex-col items-center justify-center p-4">
      <Link href="/" className="mb-4 self-center inline-flex items-center text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4 mr-1" /> 처음 화면으로
      </Link>

      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className={`px-8 pt-8 pb-6 text-white ${isSuper ? 'bg-slate-900' : 'bg-indigo-600'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-xl">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Web Report Editor 로그인</h1>
              <p className="text-white/80 text-sm">
                {isSuper ? '등록된 관리자 메일로 인증번호를 보내드려요' : '평소 쓰는 회사 계정으로 들어오세요'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* 탭 */}
          <div className="flex p-1 mb-6 bg-gray-100 rounded-xl" role="tablist">
            {([
              ['user', '임직원 · 관리자'],
              ['super', '최고 관리자'],
            ] as const).map(([t, text]) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => switchTab(t)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                  tab === t
                    ? t === 'super'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {text}
              </button>
            ))}
          </div>

          {error && (
            <div role="alert" className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">
              {error}
            </div>
          )}

          {!methods ? (
            <div className="py-10 flex justify-center text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : tab === 'user' ? (
            methods.ldapEnabled ? (
              /* ── Windows 계정 로그인 ── */
              <form onSubmit={handleWindowsLogin} className="space-y-5">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-900">
                  <Monitor className="w-5 h-5 mt-0.5 shrink-0 text-indigo-600" />
                  <span>
                    <strong>회사 PC에 로그인할 때 쓰는 Windows 계정</strong>을 그대로 입력하세요.
                    별도 회원가입은 필요 없습니다.
                  </span>
                </div>
                <div>
                  <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Windows 아이디
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    <input
                      id="username"
                      required
                      autoFocus
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={INPUT}
                      placeholder="예: hong 또는 도메인\hong"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Windows 비밀번호
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    <input
                      id="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={INPUT}
                      placeholder="PC 로그인 비밀번호"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex justify-center items-center py-3.5 rounded-xl text-[15px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Windows 계정으로 로그인 <ArrowRight className="ml-2 w-4 h-4" /></>}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  처음 로그인하면 계정이 자동으로 만들어지고, 회사 디렉터리의 이름·부서가 연결됩니다.
                </p>
              </form>
            ) : (
              /* ── 이메일 간편 로그인 (LDAP 미설정 과도기) ── */
              <form onSubmit={handleEmailLogin} className="space-y-5">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                  <Info className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" />
                  <span>
                    Windows 계정 로그인이 아직 설정되지 않아 <strong>이메일로 임시 로그인</strong>합니다.
                    최고 관리자가 AD 연동을 켜면 Windows 계정으로 바뀝니다.
                  </span>
                </div>
                <div className="flex gap-2">
                  {([
                    ['member', '응답 이력 보기 (임직원)'],
                    ['admin', '양식 관리 (관리자)'],
                  ] as const).map(([v, text]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTarget(v)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                        target === v ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    회사 이메일
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={INPUT}
                      placeholder="name@company.com"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex justify-center items-center py-3.5 rounded-xl text-[15px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>로그인 <ArrowRight className="ml-2 w-4 h-4" /></>}
                </button>
              </form>
            )
          ) : (
            /* ── 최고 관리자: 이메일 인증번호 ── */
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
                <Mail className="w-5 h-5 mt-0.5 shrink-0 text-slate-500" />
                <span>
                  버튼을 누르면 등록된 최고관리자 메일
                  {methods.superAdminEmailMasked && (
                    <> (<strong className="font-mono">{methods.superAdminEmailMasked}</strong>)</>
                  )}
                  로 6자리 인증번호가 발송됩니다. 비밀번호는 필요 없습니다.
                </span>
              </div>

              <button
                type="button"
                onClick={handleSendCode}
                disabled={busy || cooldown > 0}
                className="w-full flex justify-center items-center py-3.5 rounded-xl text-[15px] font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 transition-colors"
              >
                {busy && !codeSent ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : cooldown > 0 ? (
                  `인증번호 다시 받기 (${cooldown}초)`
                ) : codeSent ? (
                  '인증번호 다시 받기'
                ) : (
                  <>인증번호 받기 <Mail className="ml-2 w-4 h-4" /></>
                )}
              </button>

              {codeSent && (
                <form onSubmit={handleVerify} className="space-y-4 pt-2">
                  <p className="text-sm text-gray-600 text-center">
                    <strong className="font-mono text-gray-900">{codeSent.to}</strong> 으로 보냈어요.
                    {` ${codeSent.ttl}분 안에 입력해 주세요.`}
                  </p>
                  <input
                    ref={codeRef}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    aria-label="6자리 인증번호"
                    className="block w-full text-center tracking-[0.5em] text-2xl py-3 bg-white text-gray-900 placeholder:text-gray-300 border border-gray-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none font-mono"
                    placeholder="000000"
                  />
                  <button
                    type="submit"
                    disabled={busy || code.length !== 6}
                    className="w-full flex justify-center items-center py-3.5 rounded-xl text-[15px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="mr-2 w-5 h-5" /> 인증하고 접속하기</>}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      <Link href="/legal/database-rights" className="mt-5 text-xs text-gray-400 hover:text-gray-600">
        데이터베이스제작자 권리 고지
      </Link>
    </div>
  );
}
