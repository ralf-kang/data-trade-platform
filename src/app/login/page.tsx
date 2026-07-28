'use client';

import { useState } from 'react';
import { Shield, Key, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  
  // Default credentials config
  const DEFAULT_ID = 'ralfkang@ktl.re.kr';
  const DEFAULT_PW = 'test1234';
  const DEFAULT_MFA = '111111';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuperAdmin) {
      if (email !== DEFAULT_ID || password !== DEFAULT_PW) {
        alert('이메일 또는 비밀번호가 일치하지 않습니다.\n(기본 계정: ralfkang@ktl.re.kr / test1234)');
        return;
      }
      setShowMfa(true);
    } else {
      // 일반 관리자 로그인 처리
      document.cookie = "adminRole=admin; path=/";
      document.cookie = `adminEmail=${encodeURIComponent(email)}; path=/`;
      router.push('/admin/dashboard');
    }
  };

  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode !== DEFAULT_MFA) {
      alert('MFA 코드가 일치하지 않습니다.\n(기본 MFA: 111111)');
      return;
    }
    document.cookie = "adminRole=super-admin; path=/";
    document.cookie = `adminEmail=${encodeURIComponent(email)}; path=/`;
    router.push('/super-admin');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className={`p-8 ${isSuperAdmin ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white'}`}>
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <Shield className="w-10 h-10" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Web Report Editor</h1>
          <p className="text-center text-white/80 text-sm">관리자 시스템 접속</p>
        </div>

        {!showMfa ? (
          <form onSubmit={handleLogin} className="p-8">
            {/* 권한 토글 스위치 */}
            <div className="flex p-1 mb-8 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => setIsSuperAdmin(false)}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                  !isSuperAdmin ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                일반 관리자
              </button>
              <button
                type="button"
                onClick={() => setIsSuperAdmin(true)}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                  isSuperAdmin ? 'bg-slate-900 shadow-sm text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                최고 관리자 (Super)
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">이메일 주소</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none"
                    placeholder="admin@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">비밀번호</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {isSuperAdmin && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800 flex items-start">
                    <Shield className="w-5 h-5 mr-2 shrink-0 text-amber-600" />
                    <span>최고 관리자로 접속 시, 이메일로 발송된 2차 인증(MFA) 코드를 추가로 입력해야 합니다.</span>
                  </p>
                </div>
              )}

              <button
                type="submit"
                className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white transition-all ${
                  isSuperAdmin ? 'bg-slate-900 hover:bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <span>{isSuperAdmin ? '최고 관리자로 로그인' : '로그인'}</span>
                <ArrowRight className="ml-2 w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit} className="p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                <Mail className="w-8 h-8 text-slate-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">2차 보안 인증</h2>
              <p className="text-sm text-gray-500 mt-2">
                <span className="font-semibold text-gray-700">{email}</span>(으)로 발송된 6자리 인증 코드를 입력해주세요.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="block w-full text-center tracking-[0.5em] text-2xl py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all outline-none font-mono"
                  placeholder="000000"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all"
              >
                <CheckCircle2 className="mr-2 w-5 h-5" />
                인증 완료 및 접속
              </button>

              <button
                type="button"
                onClick={() => setShowMfa(false)}
                className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                로그인 화면으로 돌아가기
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
