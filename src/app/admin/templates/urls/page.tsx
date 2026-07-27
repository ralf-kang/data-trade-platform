'use client';

import { useState } from 'react';
import { Link as LinkIcon, QrCode, Power, Eye, Copy, ExternalLink, Settings2, BarChart2 } from 'lucide-react';
import Link from 'next/link';

const MOCK_URLS = [
  { id: 'f-101', title: '2024 하반기 고객 만족도 조사', url: 'https://form.company.com/q/hx82ma', status: 'OPEN', views: 3420, submissions: 1450, lastUpdate: '2026-07-27 10:30' },
  { id: 'f-102', title: '신규 입사자 온보딩 피드백', url: 'https://form.company.com/q/k9m2nx', status: 'OPEN', views: 1205, submissions: 890, lastUpdate: '2026-07-20 15:45' },
  { id: 'f-103', title: '영업본부 주간 실적 취합 양식', url: 'https://form.company.com/q/p4L9qw', status: 'CLOSED', views: 500, submissions: 420, lastUpdate: '2026-07-10 18:00' },
];

export default function UrlManagerPage() {
  const [urls, setUrls] = useState(MOCK_URLS);

  const toggleStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    setUrls(urls.map(u => u.id === id ? { ...u, status: newStatus } : u));
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('URL이 복사되었습니다.');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-8">
      <div className="max-w-6xl mx-auto w-full">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <LinkIcon className="w-8 h-8 mr-3 text-indigo-600" />
              배포 URL 및 접속 관리
            </h1>
            <p className="text-slate-500 mt-2">생성된 양식지들의 외부 접속용 URL 리스트를 조회하고, 오픈 상태를 제어합니다.</p>
          </div>
          <Link href="/admin/dashboard" className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            대시보드로 돌아가기
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">양식지 정보</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">배포 URL</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">통계</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">배포 상태</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider text-right">관리</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {urls.map(item => (
                  <tr key={item.id} className={`transition-colors ${item.status === 'CLOSED' ? 'bg-slate-50/50 opacity-75' : 'hover:bg-indigo-50/30'}`}>
                    
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 mb-1">{item.title}</div>
                      <div className="text-xs text-slate-400">ID: {item.id} | 최종 수정: {item.lastUpdate}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-indigo-600 underline font-mono truncate max-w-[200px]">{item.url}</span>
                        <button onClick={() => handleCopy(item.url)} className="text-slate-400 hover:text-indigo-600" title="URL 복사">
                          <Copy className="w-4 h-4" />
                        </button>
                        <a href={item.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-600" title="새 탭에서 열기">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col text-sm">
                        <span className="text-slate-600 flex items-center mb-1">
                          <Eye className="w-4 h-4 mr-1.5 text-slate-400" /> 조회: {item.views.toLocaleString()}
                        </span>
                        <span className="text-slate-900 font-bold flex items-center">
                          <BarChart2 className="w-4 h-4 mr-1.5 text-indigo-500" /> 제출: {item.submissions.toLocaleString()}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {item.status === 'OPEN' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-emerald-700 bg-emerald-50 text-xs font-bold border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span> 서비스 중
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-slate-600 bg-slate-100 text-xs font-bold border border-slate-200">
                          <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5"></span> 마감됨
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        className="p-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded shadow-sm transition-colors"
                        title="QR 코드 생성"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded shadow-sm transition-colors"
                        title="설정"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => toggleStatus(item.id, item.status)}
                        className={`p-2 bg-white border rounded shadow-sm transition-colors ${item.status === 'OPEN' ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                        title={item.status === 'OPEN' ? '폼 접속 차단 (마감)' : '폼 접속 허용 (오픈)'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
