'use client';

import { useState } from 'react';
import { Database, Search, Filter, Calendar, FileText, ArrowRight, Table } from 'lucide-react';
import Link from 'next/link';

// Mock Form Metadata for Data Hub
const MOCK_FORMS = [
  { id: 'f-101', title: '2024 하반기 고객 만족도 조사', responses: 4, lastSubmit: '2026-07-27 15:20', status: 'OPEN' },
  { id: 'f-102', title: '신규 입사자 온보딩 피드백', responses: 2, lastSubmit: '2026-07-20 09:30', status: 'OPEN' },
  { id: 'f-103', title: '2026년 하반기 워크샵 참가 신청서', responses: 2, lastSubmit: '2026-07-23 09:45', status: 'OPEN' },
  { id: 'f-104', title: 'IT 장비 지급 요청서 (보안동의서 포함)', responses: 2, lastSubmit: '2026-07-11 10:15', status: 'CLOSED' },
  { id: 'f-999', title: '종합 컴포넌트 테스트 양식지 (f-999)', responses: 125, lastSubmit: '2026-07-27 17:30', status: 'OPEN' },
];

const RECENT_SUBMISSIONS = [
  { formId: 'f-999', formTitle: '종합 컴포넌트 테스트...', date: '2026-07-27 17:30', dataId: 'SUB-999-0125', extract: '테스터125 / 010-1234-5678' },
  { formId: 'f-103', formTitle: '2026년 하반기 워크샵...', date: '2026-07-23 09:45', dataId: 'SUB-302', extract: '최준호 / 볼링' },
  { formId: 'f-101', formTitle: '2024 하반기 고객 만...', date: '2026-07-27 15:20', dataId: 'SUB-004', extract: '이상치 / 010-111-222' },
  { formId: 'f-101', formTitle: '2024 하반기 고객 만...', date: '2026-07-27 14:05', dataId: 'SUB-003', extract: '이영희 / 010-5555-5555' },
  { formId: 'f-101', formTitle: '2024 하반기 고객 만...', date: '2026-07-27 11:15', dataId: 'SUB-002', extract: '김철수 / 010-9999-8888' },
  { formId: 'f-101', formTitle: '2024 하반기 고객 만...', date: '2026-07-27 10:30', dataId: 'SUB-001', extract: '홍길동 / 010-1234-5678' },
];

export default function DataHubPage() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredForms = MOCK_FORMS.filter(form => 
    form.title.includes(searchTerm) || form.id.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-8">
      <div className="max-w-6xl mx-auto w-full">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <Database className="w-8 h-8 mr-3 text-indigo-600" />
              제출 데이터 통합 관리
            </h1>
            <p className="text-slate-500 mt-2">각 양식지별로 수집된 응답 데이터를 통합 조회하고 검색할 수 있습니다.</p>
          </div>
        </div>

        {/* Unified Search & Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-slate-700 mb-2">양식지 검색 (이름 또는 ID)</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="검색어를 입력하세요..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
          </div>
          
          <div className="w-full md:w-48">
            <label className="block text-sm font-semibold text-slate-700 mb-2">조회 기간</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <select className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none appearance-none bg-white">
                <option>전체 기간</option>
                <option>최근 7일</option>
                <option>최근 30일</option>
                <option>이번 달</option>
              </select>
            </div>
          </div>

          <div className="w-full md:w-48">
            <label className="block text-sm font-semibold text-slate-700 mb-2">양식 상태</label>
            <div className="relative">
              <Filter className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <select className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none appearance-none bg-white">
                <option>모든 상태</option>
                <option>서비스 중 (OPEN)</option>
                <option>마감됨 (CLOSED)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Forms List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredForms.map(form => (
            <div key={form.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                    <FileText className="w-6 h-6" />
                  </div>
                  {form.status === 'OPEN' ? (
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">OPEN</span>
                  ) : (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full border border-slate-200">CLOSED</span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{form.title}</h3>
                <p className="text-sm text-slate-500 font-mono mb-4">ID: {form.id}</p>
                
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">누적 응답 데이터</span>
                    <span className="font-bold text-indigo-600">{form.responses.toLocaleString()}건</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">최근 제출일시</span>
                    <span className="font-medium text-slate-700">{form.lastSubmit}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 mt-auto">
                <Link 
                  href={`/admin/data/${form.id}`}
                  className="w-full flex items-center justify-center py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-colors"
                >
                  <Table className="w-4 h-4 mr-2" />
                  데이터 상세 조회하기
                </Link>
              </div>
            </div>
          ))}
          
          {filteredForms.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
              검색 조건에 맞는 양식지가 없습니다.
            </div>
          )}
        </div>

        {/* Global Recent Submissions (일괄 조회) */}
        <div className="mt-12 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              <Table className="w-5 h-5 mr-2 text-indigo-600" />
              최근 통합 제출 내역 (일괄 조회)
            </h2>
            <p className="text-sm text-slate-500 mt-1">모든 양식지에서 최근 수집된 데이터를 한눈에 모아봅니다.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">양식지 정보</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">데이터 ID</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">제출 일시</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">주요 내용 (요약)</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">액션</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {RECENT_SUBMISSIONS.map((sub, idx) => (
                  <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900">{sub.formTitle}</div>
                      <div className="text-xs text-slate-400">ID: {sub.formId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                      {sub.dataId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {sub.date}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {sub.extract}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/admin/data/${sub.formId}`} className="text-indigo-600 hover:text-indigo-900">
                        상세 보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-center">
            <button className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
              통합 내역 더보기 (전체 로드)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
