'use client';

import { useState } from 'react';
import { Settings, Mail, ShieldAlert, Key, Save, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function SuperAdminSettingsPage() {
  const [isSaved, setIsSaved] = useState(false);
  const [smtp, setSmtp] = useState({ host: 'smtp.company.com', port: '465', user: 'no-reply@company.com', pass: '********' });
  const [oauth, setOauth] = useState({ clientId: 'cl_1234567890', clientSecret: 'sk_live_***********', redirect: 'https://form.company.com/oauth/callback' });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-8">
      <div className="max-w-4xl mx-auto w-full">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <Settings className="w-8 h-8 mr-3 text-slate-700" />
              시스템 환경 설정
            </h1>
            <p className="text-slate-500 mt-2">최고 관리자(Super Admin) 전용 글로벌 시스템 설정 페이지입니다.</p>
          </div>
          <Link href="/super-admin" className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            슈퍼 어드민 대시보드
          </Link>
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
