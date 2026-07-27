'use client';

import { useState, useEffect } from 'react';
import { Share2, Check, X, Clock, FileText, User } from 'lucide-react';
import Link from 'next/link';

const MOCK_REQUESTS_RECEIVED = [
  { id: 'req-1', from: '마케팅팀 이영희', targetForm: '2024 하반기 고객 만족도 조사 (f-101)', date: '2026-07-27 14:20', status: 'PENDING' },
  { id: 'req-2', from: '디자인팀 박철수', targetForm: '2024 하반기 고객 만족도 조사 (f-101)', date: '2026-07-26 09:15', status: 'APPROVED' },
];

const MOCK_REQUESTS_SENT = [
  { id: 'req-3', to: '인사팀 김민수', targetForm: '신규 입사자 온보딩 피드백 (f-102)', date: '2026-07-27 16:05', status: 'PENDING' },
];

export default function ShareRequestsPage() {
  const [received, setReceived] = useState(MOCK_REQUESTS_RECEIVED);
  const [sent, setSent] = useState(MOCK_REQUESTS_SENT);
  const [activeTab, setActiveTab] = useState<'RECEIVED' | 'SENT'>('RECEIVED');

  useEffect(() => {
    const localRequests = JSON.parse(localStorage.getItem('shareRequests') || '[]');
    if (localRequests.length > 0) {
      setSent(prev => [...prev, ...localRequests]);
    }
  }, []);

  const handleAction = (id: string, action: 'APPROVED' | 'REJECTED') => {
    if (confirm(`이 공유 요청을 ${action === 'APPROVED' ? '승인' : '거절'}하시겠습니까?\n승인 시 상대방은 이 양식의 사본을 가지게 됩니다.`)) {
      setReceived(received.map(r => r.id === id ? { ...r, status: action } : r));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">승인됨</span>;
      case 'REJECTED': return <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-bold">거절됨</span>;
      default: return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold flex items-center"><Clock className="w-3 h-3 mr-1"/> 대기 중</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-8">
      <div className="max-w-5xl mx-auto w-full">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Share2 className="w-8 h-8 mr-3 text-indigo-600" />
              양식 공유 신청 및 승인함
            </h1>
            <p className="text-gray-500 mt-2">사내 오픈소스 생태계: 타 부서/관리자에게 양식 사용 권한을 요청하거나 승인합니다.</p>
          </div>
          <Link href="/admin/dashboard" className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            대시보드로 돌아가기
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button 
              onClick={() => setActiveTab('RECEIVED')}
              className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'RECEIVED' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            >
              내가 받은 요청 (Received)
              <span className="ml-2 bg-rose-500 text-white px-2 py-0.5 rounded-full text-xs">{received.filter(r => r.status === 'PENDING').length}</span>
            </button>
            <button 
              onClick={() => setActiveTab('SENT')}
              className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'SENT' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            >
              내가 보낸 요청 (Sent)
            </button>
          </div>

          {/* List */}
          <div className="p-0">
            <ul className="divide-y divide-gray-100">
              {(activeTab === 'RECEIVED' ? received : sent).map(req => (
                <li key={req.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        {getStatusBadge(req.status)}
                        <span className="text-xs text-gray-400">{req.date}</span>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center text-sm">
                        <div className="flex items-center text-gray-900 font-bold mb-2 md:mb-0 md:mr-6">
                          <FileText className="w-4 h-4 mr-2 text-indigo-500" />
                          {req.targetForm}
                        </div>
                        <div className="flex items-center text-gray-600">
                          <User className="w-4 h-4 mr-2 text-gray-400" />
                          {activeTab === 'RECEIVED' ? (
                            <span><strong className="text-gray-900">{req.from}</strong> 님이 복사를 요청했습니다.</span>
                          ) : (
                            <span><strong className="text-gray-900">{req.to}</strong> 님에게 복사를 요청했습니다.</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {activeTab === 'RECEIVED' && req.status === 'PENDING' && (
                      <div className="flex space-x-2 ml-4">
                        <button 
                          onClick={() => handleAction(req.id, 'APPROVED')}
                          className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-bold shadow-sm"
                        >
                          <Check className="w-4 h-4 mr-1" /> 승인
                        </button>
                        <button 
                          onClick={() => handleAction(req.id, 'REJECTED')}
                          className="flex items-center px-4 py-2 bg-white border border-gray-300 text-rose-600 rounded-lg hover:bg-rose-50 text-sm font-bold shadow-sm"
                        >
                          <X className="w-4 h-4 mr-1" /> 거절
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
              
              {(activeTab === 'RECEIVED' ? received : sent).length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  표시할 요청 건이 없습니다.
                </div>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
