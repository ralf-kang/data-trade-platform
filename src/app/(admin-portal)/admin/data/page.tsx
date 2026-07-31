'use client';

import { useEffect, useState } from 'react';
import { Database, Search, Filter, Calendar, FileText, Table, Lock } from 'lucide-react';
import Link from 'next/link';
import type { FormListItem, SubmissionItem } from '@/lib/apiTypes';

export default function DataHubPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [recent, setRecent] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      // withAccess=1: 각 양식지별로 내가 제출 데이터를 조회할 권한이 있는지
      // (owner/shared/super-admin/none)를 함께 받아온다.
      fetch('/api/forms?withAccess=1').then((res) => res.json()),
      fetch('/api/submissions/recent?limit=10').then((res) => res.json()),
    ])
      .then(([formsJson, recentJson]) => {
        setForms(formsJson.forms ?? []);
        setRecent(recentJson.submissions ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const formTitleById = new Map(forms.map((f) => [f.id, f.title]));

  const filteredForms = forms.filter(
    (form) => form.title.includes(searchTerm) || form.id.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-8">
      <div className="max-w-6xl mx-auto w-full">

        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
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
          {loading && (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
              불러오는 중...
            </div>
          )}
          {!loading && filteredForms.map(form => (
            <div key={form.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              <div className="p-6 flex-1">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
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
                <p className="text-sm text-slate-500 font-mono mb-2">ID: {form.id}</p>
                {form.dataAccess === 'owner' && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">내 양식</span>
                )}
                {form.dataAccess === 'shared' && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">공유받음 (조회 가능)</span>
                )}
                {form.dataAccess === 'none' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 mb-2">
                    <Lock className="w-3 h-3 mr-1" /> 조회 권한 없음
                  </span>
                )}

                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">누적 응답 데이터</span>
                    <span className="font-bold text-indigo-600">{form.submissionCount.toLocaleString()}건</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">최근 수정일시</span>
                    <span className="font-medium text-slate-700">{form.updatedAt.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 mt-auto">
                {form.dataAccess === 'none' ? (
                  <div className="w-full flex items-center justify-center py-2.5 bg-slate-100 text-slate-400 rounded-lg text-sm font-bold cursor-not-allowed" title="양식 소유자에게 공유를 요청하세요">
                    <Lock className="w-4 h-4 mr-2" />
                    조회 권한 없음
                  </div>
                ) : (
                  <Link
                    href={`/admin/data/${form.id}`}
                    className="w-full flex items-center justify-center py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-colors"
                  >
                    <Table className="w-4 h-4 mr-2" />
                    데이터 상세 조회하기
                  </Link>
                )}
              </div>
            </div>
          ))}

          {!loading && filteredForms.length === 0 && (
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
                {!loading && recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">제출된 데이터가 없습니다.</td>
                  </tr>
                )}
                {recent.map((sub) => (
                  <tr key={`${sub.formId}-${sub.submissionId}`} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900">{formTitleById.get(sub.formId) ?? sub.formId}</div>
                      <div className="text-xs text-slate-400">ID: {sub.formId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                      {sub.submissionId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {sub.submittedAt}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {Object.values(sub.data).slice(0, 2).join(' / ')}
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
        </div>

      </div>
    </div>
  );
}
