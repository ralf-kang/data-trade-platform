'use client';

import { useState } from 'react';
import { Table, ArrowLeft, Download, Filter, Search, Edit2, Save, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// Mock Data Store
const MOCK_STORE: Record<string, { title: string, headers: string[], data: any[] }> = {
  'f-101': {
    title: '2024 하반기 고객 만족도 조사',
    headers: ['ID', '제출 일시', '고객명', '연락처', '이용 중인 서비스', '개선 사항 (선택)'],
    data: [
      { id: 'SUB-001', date: '2026-07-27 10:30', col1: '홍길동', col2: '010-1234-5678', col3: '프리미엄 요금제', col4: '속도가 조금 더 빨랐으면 좋겠습니다.' },
      { id: 'SUB-002', date: '2026-07-27 11:15', col1: '김철수', col2: '010-9999-8888', col3: '베이직 요금제', col4: '만족합니다.' },
      { id: 'SUB-003', date: '2026-07-27 14:05', col1: '이영희', col2: '010-5555-5555', col3: '스탠다드 요금제', col4: '결제 수단이 다양했으면 좋겠어요.' },
      { id: 'SUB-004', date: '2026-07-27 15:20', col1: '이상치', col2: '010-111-222', col3: '미확인', col4: '연락처 오류 (수정 요망)' },
    ]
  },
  'f-102': {
    title: '신규 입사자 온보딩 피드백',
    headers: ['ID', '제출 일시', '부서명', '입사자 성함', '가장 유용했던 세션', '근무 희망지 (옵션)'],
    data: [
      { id: 'SUB-101', date: '2026-07-20 09:00', col1: '개발1팀', col2: '정개발', col3: '사내 보안 정책 교육', col4: '판교 오피스' },
      { id: 'SUB-102', date: '2026-07-20 09:30', col1: '디자인팀', col2: '박디자인', col3: '사내 문화 워크샵', col4: '강남 오피스' },
    ]
  },
  'f-104': {
    title: 'IT 장비 지급 요청서 (보안동의서 포함)',
    headers: ['ID', '제출 일시', '신청자 사번', '요청 장비'],
    data: [
      { id: 'SUB-201', date: '2026-07-10 14:00', col1: 'EMP-9901', col2: '맥북 프로 16인치, 4K 모니터 1대' },
      { id: 'SUB-202', date: '2026-07-11 10:15', col1: 'EMP-9902', col2: 'LG 그램 15인치, 무선 마우스' },
    ]
  },
  'f-999': {
    title: '종합 컴포넌트 테스트 양식지 (f-999)',
    headers: [
      'ID', '제출 일시', '단답형', '숫자', '연락처', '일자', '장문형', '드롭다운', '단일선택', 
      '다중선택', '지도', '파일', '이미지', '갤러리', '영상', '표', '하위보고서', 
      '링크', '댓글', '슬라이드', '팝업', 'API리스트', 'CSV', '동의서', '서명'
    ],
    data: Array.from({ length: 125 }).map((_, i) => ({
      id: `SUB-999-${(i + 1).toString().padStart(4, '0')}`,
      date: `2026-07-${String(Math.floor(Math.random() * 27) + 1).padStart(2, '0')} ${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      col1: `테스터${i + 1}`,
      col2: Math.floor(Math.random() * 60) + 20,
      col3: `010-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      col4: '2026-08-01',
      col5: '테스트 요청사항입니다. 긴 문장 입력 테스트.',
      col6: ['개발팀', '기획팀', '디자인팀'][i % 3],
      col7: i % 2 === 0 ? '남성' : '여성',
      col8: 'IT, 독서',
      col9: '서울시 강남구 테헤란로',
      col10: 'resume.pdf',
      col11: 'profile_pic.jpg',
      col12: 'gallery_1.jpg, gallery_2.jpg',
      col13: 'https://youtube.com/watch?v=123',
      col14: '3행 4열 표 데이터',
      col15: '하위 보고서 완료',
      col16: 'https://report.company.com/r/123',
      col17: '3개의 코멘트',
      col18: '슬라이드 확인 완료',
      col19: '안내문 읽음',
      col20: 'EMP-001 (김사원)',
      col21: '24행 CSV 처리됨',
      col22: '동의함(Y)',
      col23: 'sign_data_base64...'
    }))
  }
};

export default function DataViewerPage() {
  const params = useParams();
  const formId = params?.formId as string || 'f-101';
  const currentMock = MOCK_STORE[formId] || MOCK_STORE['f-101'];

  const [data, setData] = useState(currentMock.data);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  const handleEditClick = (row: any) => {
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
              제출 데이터 뷰어: {currentMock.title} (Form: {formId})
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
                  {currentMock.headers.map((header, idx) => (
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

                    {/* Fixed Columns: ID, Date */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.date}</td>
                    
                    {/* Dynamic Data Columns */}
                    {currentMock.headers.slice(2).map((_, idx) => {
                      const key = `col${idx + 1}`;
                      const value = row[key] || '';
                      const isEditing = editingId === row.id;
                      
                      return (
                        <td key={idx} className="px-6 py-4 text-sm text-gray-900 min-w-[150px]">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editForm[key] || ''} 
                              onChange={e => setEditForm({...editForm, [key]: e.target.value})} 
                              className="w-full p-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" 
                            />
                          ) : (
                            <div className="flex items-center">
                              {/* 이상치 감지 예시 (101 양식의 연락처 컬럼) */}
                              {formId === 'f-101' && key === 'col2' && value.length < 13 && value.length > 0 && (
                                <AlertTriangle className="w-4 h-4 text-amber-500 mr-2 shrink-0" title="의심되는 이상치(포맷 불일치)" />
                              )}
                              {value}
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
