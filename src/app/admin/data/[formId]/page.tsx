'use client';

import { useState } from 'react';
import { Table, ArrowLeft, Download, Filter, Search, Edit2, Save, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// Mock Data
const MOCK_HEADERS = ['ID', '제출 일시', '성명', '연락처', '거주지 주소', '기타 의견'];
const MOCK_DATA = [
  { id: 'SUB-001', date: '2026-07-27 10:30', name: '홍길동', phone: '010-1234-5678', address: '서울특별시 강남구 테헤란로 123', notes: '빠른 처리 부탁드립니다.' },
  { id: 'SUB-002', date: '2026-07-27 11:15', name: '김철수', phone: '010-9999-8888', address: '경기도 성남시 분당구 판교역로 456', notes: '없음' },
  { id: 'SUB-003', date: '2026-07-27 14:05', name: '이영희', phone: '010-5555-5555', address: '부산광역시 해운대구 마린시티 789', notes: '추가 문의사항 있습니다.' },
  { id: 'SUB-004', date: '2026-07-27 15:20', name: '이상치', phone: '010-111-222', address: '강원도 춘천시', notes: '연락처가 이상하게 입력됨 (오류)' },
];

export default function DataViewerPage() {
  const params = useParams();
  const formId = params?.formId as string || 'f-unknown';

  const [data, setData] = useState(MOCK_DATA);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  const handleEditClick = (row: typeof MOCK_DATA[0]) => {
    setEditingId(row.id);
    setEditForm({ ...row });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = () => {
    setData(data.map(item => item.id === editingId ? editForm : item));
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
              제출 데이터 뷰어 (Form: {formId})
            </h1>
            <p className="text-sm text-gray-500 mt-1">수집된 데이터를 조회하고 비정상 값을 직접 재가공할 수 있습니다.</p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input type="text" placeholder="데이터 검색..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 outline-none" />
          </div>
          <button className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
            <Filter className="w-4 h-4 mr-2" /> 필터
          </button>
          <button className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-bold shadow-sm transition-colors">
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
                  {MOCK_HEADERS.map((header, idx) => (
                    <th key={idx} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data.map((row) => (
                  <tr key={row.id} className={`hover:bg-indigo-50/30 transition-colors ${editingId === row.id ? 'bg-indigo-50/50' : ''}`}>
                    
                    {/* Action Column */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm border-r border-gray-100 bg-gray-50/50">
                      {editingId === row.id ? (
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

                    {/* Data Columns */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.date}</td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {editingId === row.id ? (
                        <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                      ) : row.name}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 relative group">
                      {editingId === row.id ? (
                        <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full p-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                      ) : (
                        <div className="flex items-center">
                          {row.phone.length < 13 && (
                            <AlertTriangle className="w-4 h-4 text-amber-500 mr-2 shrink-0" title="의심되는 이상치(포맷 불일치)" />
                          )}
                          {row.phone}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-900 min-w-[250px]">
                      {editingId === row.id ? (
                        <input type="text" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full p-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                      ) : row.address}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-500 min-w-[200px]">
                      {editingId === row.id ? (
                        <input type="text" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full p-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                      ) : row.notes}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="bg-slate-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">총 <span className="font-bold text-gray-900">{data.length}</span>건의 데이터가 있습니다.</p>
            <div className="flex space-x-2">
              <button className="px-3 py-1 border border-gray-300 bg-white rounded text-sm text-gray-600 disabled:opacity-50" disabled>이전</button>
              <button className="px-3 py-1 border border-gray-300 bg-white rounded text-sm text-gray-600 disabled:opacity-50" disabled>다음</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
