'use client';

import { useState } from 'react';
import { LayoutDashboard, Users, FileText, ArrowUpRight, TrendingUp, Copy, Shield, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  // Mock Data for Popular Forms Widget
  const [popularForms] = useState([
    { id: 'f-101', title: '2024 하반기 고객 만족도 조사', owner: '마케팅팀 김민수', submissions: 1450, growth: '+12%' },
    { id: 'f-102', title: '신규 입사자 온보딩 피드백', owner: '인사팀 이영희', submissions: 890, growth: '+5%' },
    { id: 'f-103', title: '영업본부 주간 실적 취합 양식', owner: '영업본부 박철수', submissions: 420, growth: '+2%' },
    { id: 'f-104', title: 'IT 장비 지급 요청서 (보안동의서 포함)', owner: 'IT지원팀 정대만', submissions: 215, growth: '-1%' },
  ]);

  const handleRequestShare = (title: string) => {
    alert(`[${title}] 양식의 원작자에게 공유(복사) 권한을 요청했습니다.\n관리자의 승인이 완료되면 알림이 발송됩니다.`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar (Admin Nav) */}
      <div className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold flex items-center">
            <Shield className="w-6 h-6 mr-2 text-indigo-400" />
            Admin Portal
          </h2>
          <p className="text-xs text-slate-400 mt-2">일반 관리자 워크스페이스</p>
        </div>
        <nav className="flex-1 py-4">
          <Link href="/admin/dashboard" className="flex items-center px-6 py-3 bg-indigo-600 border-l-4 border-indigo-400 text-white font-medium">
            <LayoutDashboard className="w-5 h-5 mr-3" /> 대시보드 메인
          </Link>
          <Link href="/admin/templates" className="flex items-center px-6 py-3 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
            <FileText className="w-5 h-5 mr-3" /> 내 양식 관리
          </Link>
          <Link href="/admin/templates/urls" className="flex items-center px-6 py-3 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
            <Globe className="w-5 h-5 mr-3" /> 배포 URL 관리
          </Link>
          <Link href="/admin/share-requests" className="flex items-center px-6 py-3 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
            <Users className="w-5 h-5 mr-3" /> 공유 신청 및 승인함
          </Link>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
            <div className="flex space-x-3">
              <Link href="/admin/builder" className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
                + 새 양식 만들기
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div className="p-4 bg-indigo-50 rounded-full mr-4 text-indigo-600">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">운영 중인 양식</p>
                <h3 className="text-2xl font-bold text-gray-900">12개</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div className="p-4 bg-emerald-50 rounded-full mr-4 text-emerald-600">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">누적 수집 데이터</p>
                <h3 className="text-2xl font-bold text-gray-900">8,430건</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div className="p-4 bg-amber-50 rounded-full mr-4 text-amber-600">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">나의 공유 승인 대기</p>
                <h3 className="text-2xl font-bold text-gray-900">3건</h3>
              </div>
            </div>
          </div>

          {/* Popular Forms Widget (Cross-tenant Ecosystem) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-indigo-600" />
                  사내 양식 트렌드 및 인기 랭킹
                </h2>
                <p className="text-sm text-gray-500 mt-1">다른 부서/관리자가 만든 우수한 양식을 둘러보고, 복사를 신청해보세요.</p>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {popularForms.map((form, idx) => (
                <div key={form.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center mb-4 md:mb-0">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center mr-4 shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{form.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">원작자: {form.owner}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{form.submissions.toLocaleString()}건 제출</div>
                      <div className={`text-xs font-medium mt-1 ${form.growth.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
                        전주 대비 {form.growth}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRequestShare(form.title)}
                      className="px-4 py-2 flex items-center text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      복사 신청
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
              <button className="text-sm font-medium text-gray-600 hover:text-indigo-600 flex items-center justify-center w-full">
                더 많은 사내 템플릿 보기 <ArrowUpRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Need to import Globe for the sidebar
import { Globe } from 'lucide-react';
