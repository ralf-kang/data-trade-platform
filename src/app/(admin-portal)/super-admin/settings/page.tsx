'use client';

import { useEffect, useState } from 'react';
import { Settings, Mail, Key, Save, CheckCircle2, Globe, QrCode, Coins } from 'lucide-react';
import Link from 'next/link';
import LdapSettings from '@/components/settings/LdapSettings';
import ExternalEndpointSettings from '@/components/settings/ExternalEndpointSettings';

export default function SuperAdminSettingsPage() {
  const [isSaved, setIsSaved] = useState(false);
  const [smtp, setSmtp] = useState({ host: 'smtp.company.com', port: '465', user: 'no-reply@company.com', pass: '********' });
  const [oauth, setOauth] = useState({ clientId: 'cl_1234567890', clientSecret: 'sk_live_***********', redirect: 'https://form.company.com/oauth/callback' });

  // QR/배포 URL 생성에 사용할 운영 서버 기본 URL — 실제 Postgres(SystemConfig)에 저장된다.
  const [publicBaseUrl, setPublicBaseUrl] = useState('');
  const [baseUrlSaving, setBaseUrlSaving] = useState(false);
  const [baseUrlSaved, setBaseUrlSaved] = useState(false);

  // 보상(포인트) 화면 노출 범위 — canSeeRewards()가 참조하는 단일 스위치.
  const [rewardVisibility, setRewardVisibilityState] = useState<'HIDDEN' | 'ADMIN_ONLY' | 'ALL_MEMBERS'>('ADMIN_ONLY');
  const [rewardSaving, setRewardSaving] = useState(false);
  const [rewardSaved, setRewardSaved] = useState(false);

  useEffect(() => {
    fetch('/api/system-config')
      .then((res) => (res.ok ? res.json() : { config: {} }))
      .then((json) => {
        setPublicBaseUrl(json.config?.publicBaseUrl ?? '');
        setRewardVisibilityState(json.config?.rewardVisibility ?? 'ADMIN_ONLY');
      });
  }, []);

  const handleSaveRewardVisibility = async (value: 'HIDDEN' | 'ADMIN_ONLY' | 'ALL_MEMBERS') => {
    setRewardVisibilityState(value);
    setRewardSaving(true);
    try {
      const res = await fetch('/api/system-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardVisibility: value }),
      });
      if (!res.ok) {
        alert('저장에 실패했습니다. 슈퍼관리자 권한이 필요합니다.');
        return;
      }
      setRewardSaved(true);
      setTimeout(() => setRewardSaved(false), 3000);
    } finally {
      setRewardSaving(false);
    }
  };

  const handleSaveBaseUrl = async () => {
    setBaseUrlSaving(true);
    try {
      const res = await fetch('/api/system-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicBaseUrl: publicBaseUrl || null }),
      });
      if (!res.ok) {
        alert('저장에 실패했습니다. 슈퍼관리자 권한이 필요합니다.');
        return;
      }
      setBaseUrlSaved(true);
      setTimeout(() => setBaseUrlSaved(false), 3000);
    } finally {
      setBaseUrlSaving(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-8">
      <div className="max-w-4xl mx-auto w-full">
        
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <Settings className="w-8 h-8 mr-3 text-slate-700" />
              시스템 환경 설정
            </h1>
            <p className="text-slate-500 mt-2">최고 관리자(Super Admin) 전용 글로벌 시스템 설정 페이지입니다.</p>
          </div>
          <Link href="/super-admin" className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shrink-0 whitespace-nowrap">
            슈퍼 어드민 대시보드
          </Link>
        </div>

        {/* QR/배포 URL 기본 도메인 — 실제 저장/적용됨 (Postgres SystemConfig) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center">
            <Globe className="w-5 h-5 text-indigo-600 mr-2" />
            <h2 className="font-bold text-slate-800">운영 서버 공개 기본 URL (QR 코드 생성용)</h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-500 flex items-start">
              <QrCode className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
              배포 URL 관리 화면의 QR 코드/외부 접속 URL은 여기에 등록한 기본 URL을 기준으로 생성됩니다.
              비워두면 현재 접속 중인 브라우저 주소를 임시로 사용합니다 (모바일에서 스캔 시 오작동할 수 있으므로 운영 환경에서는 반드시 설정하세요).
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={publicBaseUrl}
                onChange={(e) => setPublicBaseUrl(e.target.value)}
                placeholder="https://forms.company.com"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none font-mono text-sm"
              />
              <button
                type="button"
                onClick={handleSaveBaseUrl}
                disabled={baseUrlSaving}
                className="flex items-center px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {baseUrlSaved ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                {baseUrlSaving ? '저장 중...' : baseUrlSaved ? '저장됨' : '저장'}
              </button>
            </div>
          </div>
        </div>

        {/* 보상 화면 노출 범위 — canSeeRewards() 단일 게이트가 참조하는 값 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center">
            <Coins className="w-5 h-5 text-amber-500 mr-2" />
            <h2 className="font-bold text-slate-800">보상(포인트) 화면 노출 범위</h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-500">
              마이페이지 포인트 화면과 관련 API(/api/me/points, /api/me/summary)에 모두 적용됩니다.
              품질 게이트 없이 전체 공개하면 어뷰징을 막을 수단이 없으므로, 준비가 끝나기 전에는
              관리자 미리보기(ADMIN_ONLY)로 두는 것을 권장합니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  { value: 'HIDDEN', label: '전체 비공개', desc: '관리자를 포함해 아무에게도 보이지 않음' },
                  { value: 'ADMIN_ONLY', label: '관리자만 미리보기', desc: '슈퍼/일반 관리자에게만 "개발 중" 배지와 함께 노출' },
                  { value: 'ALL_MEMBERS', label: '전체 공개', desc: '전 임직원에게 정식 노출 (운영 시작)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={rewardSaving}
                  onClick={() => handleSaveRewardVisibility(opt.value)}
                  className={`text-left p-4 rounded-lg border-2 transition-colors disabled:opacity-50 ${
                    rewardVisibility === opt.value
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-sm text-slate-800">{opt.label}</div>
                  <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
            {rewardSaved && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 저장되었습니다.
              </p>
            )}
          </div>
        </div>

        {/* LDAP / AD 연동 — 임직원 계정의 출처가 되므로 다른 설정보다 앞에 둔다 */}
        <div className="mb-8">
          <LdapSettings />

          {/* 외부 연결 목록 — 이 시스템이 밖으로 나가는 모든 목적지(방화벽 허용 목록 근거) */}
          <ExternalEndpointSettings />
        </div>

        <form onSubmit={handleSave} className="space-y-8">

          {/* SMTP Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center">
              <Mail className="w-5 h-5 text-indigo-600 mr-2" />
              <h2 className="font-bold text-slate-800">SMTP 메일 서버 설정</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">SMTP Host</label>
                <input 
                  type="text" 
                  value={smtp.host}
                  onChange={e => setSmtp({...smtp, host: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">SMTP Port</label>
                <input 
                  type="text" 
                  value={smtp.port}
                  onChange={e => setSmtp({...smtp, port: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">User / Email</label>
                <input 
                  type="text" 
                  value={smtp.user}
                  onChange={e => setSmtp({...smtp, user: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                <input 
                  type="password" 
                  value={smtp.pass}
                  onChange={e => setSmtp({...smtp, pass: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none" 
                />
              </div>
            </div>
          </div>

          {/* OAuth Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center">
              <Key className="w-5 h-5 text-indigo-600 mr-2" />
              <h2 className="font-bold text-slate-800">Claude OAuth 2.0 연동 설정</h2>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-sm text-slate-500 mb-2">문서 생성 AI 자동화를 위한 Claude API OAuth 자격 증명입니다.</p>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Client ID</label>
                <input 
                  type="text" 
                  value={oauth.clientId}
                  onChange={e => setOauth({...oauth, clientId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none font-mono" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Client Secret</label>
                <input 
                  type="password" 
                  value={oauth.clientSecret}
                  onChange={e => setOauth({...oauth, clientSecret: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none font-mono" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Redirect URI</label>
                <input 
                  type="text" 
                  value={oauth.redirect}
                  onChange={e => setOauth({...oauth, redirect: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 outline-none font-mono" 
                  readOnly
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button 
              type="submit"
              className="flex items-center px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              {isSaved ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              {isSaved ? '저장됨' : '설정 저장'}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
}
