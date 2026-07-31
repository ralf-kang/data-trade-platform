'use client';

import { useEffect, useState } from 'react';
import { Users, FileText, ArrowUpRight, TrendingUp, Copy, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import type { FormListItem } from '@/lib/apiTypes';

export default function AdminDashboardPage() {
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [pendingShareCount, setPendingShareCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/forms').then((res) => res.json()),
      fetch('/api/share-requests').then((res) => (res.ok ? res.json() : { received: [] })),
    ])
      .then(([formsJson, shareJson]) => {
        setForms(formsJson.forms ?? []);
        const received: { status: string }[] = shareJson.received ?? [];
        setPendingShareCount(received.filter((r) => r.status === 'PENDING').length);
      })
      .finally(() => setLoading(false));
  }, []);

  const popularForms = [...forms].sort((a, b) => b.submissionCount - a.submissionCount).slice(0, 5);
  const totalSubmissions = forms.reduce((sum, f) => sum + f.submissionCount, 0);

  const handleRequestShare = async (form: FormListItem) => {
    const res = await fetch('/api/share-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formId: form.id }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }));
      alert(
        error === 'CANNOT_REQUEST_OWN_FORM'
          ? '내가 소유한 양식에는 공유를 요청할 수 없습니다.'
          : '공유 요청에 실패했습니다.'
      );
      return;
    }
    alert(`[${form.title}] 양식의 원작자에게 공유(복사) 권한을 요청했습니다.\n"공유 신청 및 승인함" 메뉴에서 확인하실 수 있습니다.`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-8 min-h-screen">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
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
                <h3 className="text-2xl font-bold text-gray-900">{loading ? '-' : `${forms.length}개`}</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div className="p-4 bg-emerald-50 rounded-full mr-4 text-emerald-600">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">누적 수집 데이터</p>
                <h3 className="text-2xl font-bold text-gray-900">{loading ? '-' : `${totalSubmissions.toLocaleString()}건`}</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div className="p-4 bg-amber-50 rounded-full mr-4 text-amber-600">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">나의 공유 승인 대기</p>
                <h3 className="text-2xl font-bold text-gray-900">{loading ? '-' : `${pendingShareCount}건`}</h3>
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
              {loading && <div className="p-8 text-center text-gray-400">불러오는 중...</div>}
              {!loading && popularForms.length === 0 && (
                <div className="p-8 text-center text-gray-400">등록된 양식이 없습니다.</div>
              )}
              {popularForms.map((form, idx) => (
                <div key={form.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center mb-4 md:mb-0">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center mr-4 shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{form.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">원작자: {form.ownerName ?? '알 수 없음'}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{form.submissionCount.toLocaleString()}건 제출</div>
                      <div className="text-xs font-medium mt-1 text-gray-400">조회 {form.viewCount.toLocaleString()}회</div>
                    </div>
                    <button
                      onClick={() => handleRequestShare(form)}
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
              <Link href="/admin/templates" className="text-sm font-medium text-gray-600 hover:text-indigo-600 flex items-center justify-center w-full">
                더 많은 사내 템플릿 보기 <ArrowUpRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
