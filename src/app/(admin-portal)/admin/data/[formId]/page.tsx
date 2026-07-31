'use client';

import { useEffect, useState } from 'react';
import { Table, ArrowLeft, Download, Filter, Search, Edit2, Save, X, AlertTriangle, Cloud, ShieldQuestion, Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { FormListItem, SubmissionItem } from '@/lib/apiTypes';

const PAGE_SIZE = 20;

export default function DataViewerPage() {
  const params = useParams();
  const formId = (params?.formId as string) || '';

  const [form, setForm] = useState<FormListItem | null>(null);
  const [data, setData] = useState<SubmissionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});

  // 마스킹 열람 — 셀 단위로만 연다. 목록 응답에는 원문이 들어 있지 않으므로,
  // 열람할 때마다 서버에 따로 요청해서 받아온다(그 요청이 감사 로그로 남는다).
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  const cellKey = (submissionId: string, fieldId: string) => `${submissionId}:${fieldId}`;

  const handleReveal = async (submissionId: string, fieldId: string) => {
    const key = cellKey(submissionId, fieldId);
    setRevealing(key);
    setRevealError(null);
    try {
      const res = await fetch(`/api/forms/${formId}/submissions/${submissionId}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRevealError(json.message ?? '값을 열람할 수 없습니다.');
        return;
      }
      setRevealed((prev) => ({ ...prev, [key]: json.value }));
    } finally {
      setRevealing(null);
    }
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // 폼 필드 구성(비정형, Elasticsearch) — 제출 데이터의 컬럼 정의로 그대로 사용한다.
  useEffect(() => {
    if (!formId) return;
    fetch(`/api/forms/${formId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setForm(json?.form ?? null));
  }, [formId]);

  // 제출 데이터(비정형, Elasticsearch) — 페이지/검색어가 바뀔 때마다 서버에서 다시 조회한다.
  useEffect(() => {
    if (!formId) return;
    let cancelled = false;
    // formId/page/searchTerm이 바뀔 때마다(마운트 이후에도) 로딩 상태를 다시 보여줘야 하므로
    // 여기서 명시적으로 true로 리셋한다 (마운트 1회성 초기값만으로는 불충분).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (searchTerm) qs.set('search', searchTerm);
    fetch(`/api/forms/${formId}/submissions?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : { items: [], total: 0 }))
      .then((json) => {
        if (cancelled) return;
        setData(json.items ?? []);
        setTotal(json.total ?? 0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formId, page, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const columns = form?.fields.map((f) => ({ key: f.id, label: f.label })) ?? [];

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleExportCsv = async () => {
    // 클라이언트가 pageSize를 크게 요청해 한 번에 전체를 긁어가는 대신, 서버가 내부적으로
    // 페이지를 순회하고 감사 로그(DATA_EXPORT)를 남기는 전용 추출 엔드포인트를 사용한다
    // (저작권법 제93조 대응 — src/app/api/forms/[formId]/submissions/export/route.ts).
    const qs = new URLSearchParams();
    if (searchTerm) qs.set('search', searchTerm);
    const res = await fetch(`/api/forms/${formId}/submissions/export?${qs.toString()}`);
    if (!res.ok) {
      if (res.status === 429) {
        alert('대량 추출 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.');
      } else {
        alert('추출에 실패했습니다.');
      }
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formId}_data.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleEditClick = (row: SubmissionItem) => {
    setEditingId(row.submissionId);
    setEditForm({ ...row.data });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/forms/${formId}/submissions/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: editForm }),
    });
    if (!res.ok) {
      alert('수정에 실패했습니다.');
      return;
    }
    setData((prev) =>
      prev.map((item) => (item.submissionId === editingId ? { ...item, data: editForm } : item))
    );
    setEditingId(null);
    setEditForm({});
    alert('데이터가 수정(재가공)되었습니다. 행동 로그(Audit Logs)에 기록됩니다.');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center">
          <Link href="/admin/templates" className="text-gray-400 hover:text-gray-600 mr-4">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <Table className="w-5 h-5 mr-2 text-indigo-600" />
              제출 데이터 뷰어: {form?.title ?? '...'} (Form: {formId})
            </h1>
            <p className="text-sm text-gray-500 mt-1">수집된 데이터를 조회하고 비정상 값을 직접 재가공할 수 있습니다.</p>
          </div>
        </div>

        <div className="flex space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="데이터 검색..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>
          <button className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
            <Filter className="w-4 h-4 mr-2" /> 필터
          </button>
          <Link
            href={`/admin/data/${formId}/wordcloud`}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <Cloud className="w-4 h-4 mr-2" /> 워드클라우드
          </Link>
          <Link
            href={`/admin/data/${formId}/quality`}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <ShieldQuestion className="w-4 h-4 mr-2" /> 결측치·이상치
          </Link>
          <button onClick={handleExportCsv} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-bold shadow-sm transition-colors">
            <Download className="w-4 h-4 mr-2" /> 엑셀/CSV 추출
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-100 border-b border-gray-200 w-16">
                    동작
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">제출 일시</th>
                  {columns.map((col) => (
                    <th key={col.key} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={columns.length + 3} className="px-6 py-8 text-center text-gray-400">불러오는 중...</td>
                  </tr>
                )}
                {!loading && data.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 3} className="px-6 py-8 text-center text-gray-400">제출된 데이터가 없습니다.</td>
                  </tr>
                )}
                {data.map((row) => (
                  <tr key={row.submissionId} className={`hover:bg-indigo-50/30 transition-colors ${editingId === row.submissionId ? 'bg-indigo-50/50' : ''}`}>

                    {/* Action Column */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm border-r border-gray-100 bg-gray-50/50">
                      {editingId === row.submissionId ? (
                        <div className="flex space-x-2">
                          <button onClick={handleSaveEdit} className="text-emerald-600 hover:text-emerald-800" title="저장">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={handleCancelEdit} className="text-red-500 hover:text-red-700" title="취소">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handleEditClick(row)} className="text-indigo-600 hover:text-indigo-900 flex items-center" title="수정 (재가공)">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>

                    {/* Fixed Columns: ID, Date */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.submissionId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.submittedAt}</td>

                    {/* Dynamic Data Columns (폼 필드 구성 기반) */}
                    {columns.map((col) => {
                      const value = String(row.data[col.key] ?? '');
                      const isEditing = editingId === row.submissionId;
                      const isPhoneField = /연락처|전화/.test(col.label);

                      return (
                        <td key={col.key} className="px-6 py-4 text-sm text-gray-900 min-w-[150px]">
                          {isEditing ? (
                            <input
                              type="text"
                              value={String(editForm[col.key] ?? '')}
                              onChange={(e) => setEditForm({ ...editForm, [col.key]: e.target.value })}
                              className="w-full p-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          ) : (
                            <div className="flex items-center">
                              {/* 이상치 감지 예시 (연락처류 컬럼의 포맷 불일치) */}
                              {isPhoneField && value.length > 0 && value.length < 13 && (
                                <span title="의심되는 이상치(포맷 불일치)" className="mr-2 shrink-0">
                                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                                </span>
                              )}
                              {(() => {
                                const key = cellKey(row.submissionId, col.key);
                                if (revealed[key] !== undefined) {
                                  return (
                                    <span className="text-slate-900">
                                      {revealed[key] === '' ? <span className="text-slate-300">(비어 있음)</span> : revealed[key]}
                                      <span className="ml-1.5 text-[10px] text-amber-600 align-middle">열람됨</span>
                                    </span>
                                  );
                                }
                                // 마스킹된 셀만 클릭 대상으로 만든다. 개인정보 취급자가 아니면
                                // 서버가 거부하고, 그 시도도 감사 로그에 남는다.
                                if (value.includes('마스킹됨')) {
                                  return (
                                    <button
                                      onClick={() => handleReveal(row.submissionId, col.key)}
                                      disabled={revealing === key}
                                      className="inline-flex items-center gap-1 text-slate-400 hover:text-indigo-600 disabled:opacity-50"
                                      title="개인정보 취급자만 열람할 수 있습니다. 열람 이력이 감사 로그에 기록됩니다."
                                    >
                                      {revealing === key ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Eye className="w-3.5 h-3.5" />
                                      )}
                                      {value}
                                    </button>
                                  );
                                }
                                return value;
                              })()}
                            </div>
                          )}
                        </td>
                      );
                    })}

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {revealError && (
            <div className="mx-6 mb-3 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2.5 text-sm text-rose-700 flex items-center justify-between gap-2">
              <span>{revealError}</span>
              <button onClick={() => setRevealError(null)} className="text-rose-400 hover:text-rose-600 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="bg-slate-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              총 <span className="font-bold text-gray-900">{total}</span>건 중{' '}
              {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)}건 표시
              (페이지 {page} / {totalPages})
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-gray-300 bg-white rounded text-sm text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                disabled={page <= 1}
              >
                이전
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-gray-300 bg-white rounded text-sm text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                disabled={page >= totalPages}
              >
                다음
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
