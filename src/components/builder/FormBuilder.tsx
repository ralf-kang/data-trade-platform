'use client';

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FormField, FieldType, FormTemplate } from './types';
import { 
  Type, AlignLeft, Hash, List, 
  CheckSquare, Calendar, Upload, PenTool,
  Image as ImageIcon, Images, Video, Table, FileBox, MessageSquare, Link as LinkIcon,
  Layers, BellOff, ShieldAlert, Database, FileSpreadsheet, EyeOff, Save, ArrowUp, ArrowDown, Trash2, Plus,
  Smartphone, Monitor, Globe, Regex, MapPin, CheckSquare as CheckIcon, LayoutGrid, Star, GripHorizontal
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import AiAutoGenerator from './AiAutoGenerator';

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: '단답형', icon: <Type className="w-4 h-4" /> },
  { type: 'textarea', label: '장문형', icon: <AlignLeft className="w-4 h-4" /> },
  { type: 'number', label: '숫자', icon: <Hash className="w-4 h-4" /> },
  { type: 'select', label: '드롭다운', icon: <List className="w-4 h-4" /> },
  { type: 'radio', label: '단일 선택', icon: <CheckSquare className="w-4 h-4" /> },
  { type: 'checkbox', label: '다중 선택', icon: <CheckSquare className="w-4 h-4" /> },
  { type: 'date', label: '날짜', icon: <Calendar className="w-4 h-4" /> },
  { type: 'file', label: '파일 첨부', icon: <Upload className="w-4 h-4" /> },
  { type: 'signature', label: '서명', icon: <PenTool className="w-4 h-4" /> },
  { type: 'image', label: '단일 이미지', icon: <ImageIcon className="w-4 h-4 text-purple-600" /> },
  { type: 'image-gallery', label: '이미지 갤러리', icon: <Images className="w-4 h-4 text-purple-600" /> },
  { type: 'video-link', label: '동영상 링크', icon: <Video className="w-4 h-4 text-purple-600" /> },
  { type: 'table', label: '표 (Table)', icon: <Table className="w-4 h-4 text-purple-600" /> },
  { type: 'nested-report', label: '하위 레포트', icon: <FileBox className="w-4 h-4 text-purple-600" /> },
  { type: 'report-link', label: '레포트 링크', icon: <LinkIcon className="w-4 h-4 text-purple-600" /> },
  { type: 'comment-thread', label: '댓글 코멘트', icon: <MessageSquare className="w-4 h-4 text-purple-600" /> },
  { type: 'slide-card', label: '슬라이드 카드', icon: <Layers className="w-4 h-4 text-amber-600" /> },
  { type: 'popup-toggle', label: '팝업(자동닫힘)', icon: <BellOff className="w-4 h-4 text-amber-600" /> },
  { type: 'privacy-consent', label: '개인정보 동의서', icon: <ShieldAlert className="w-4 h-6 text-red-600" /> },
  { type: 'api-select', label: 'API 연동 리스트', icon: <Database className="w-4 h-4 text-amber-600" /> },
  { type: 'csv-select', label: 'CSV 붙여넣기', icon: <FileSpreadsheet className="w-4 h-4 text-amber-600" /> },
  { type: 'regex-input', label: '정규식 검증 입력', icon: <Regex className="w-4 h-4 text-blue-600" /> },
  { type: 'map-address', label: '주소 및 지도', icon: <MapPin className="w-4 h-4 text-green-600" /> },
];

export default function FormBuilder() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id');

  const [template, setTemplate] = useState<Partial<FormTemplate>>(() => {
    if (id === 'f-101') {
      return {
        id: 'f-101',
        title: '2024 하반기 고객 만족도 조사',
        description: '고객 피드백 수집용 양식',
        fields: [
          { id: 'f101-1', type: 'text', label: '고객명', required: true, nullable: false, width: '50%' },
          { id: 'f101-2', type: 'regex-input', label: '연락처', required: true, nullable: false, regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$', width: '50%' },
          { id: 'f101-3', type: 'text', label: '이용 중인 서비스', required: true, nullable: false, width: '100%' },
          { id: 'f101-4', type: 'text', label: '개선 사항 (선택)', required: false, nullable: true, width: '100%' },
        ]
      };
    }
    if (id === 'f-102') {
      return {
        id: 'f-102',
        title: '신규 입사자 온보딩 피드백',
        description: '사내 온보딩 세션 피드백',
        fields: [
          { id: 'f102-1', type: 'text', label: '부서명', required: true, nullable: false, width: '50%' },
          { id: 'f102-2', type: 'text', label: '입사자 성함', required: true, nullable: false, width: '50%' },
          { id: 'f102-3', type: 'text', label: '가장 유용했던 세션', required: true, nullable: false, width: '100%' },
          { id: 'f102-4', type: 'map-address', label: '근무 희망지 (옵션)', required: false, nullable: true, width: '100%' },
        ]
      };
    }
    if (id === 'f-103') {
      return {
        id: 'f-103',
        title: '2026년 하반기 워크샵 참가 신청서',
        description: '전사 워크샵 참석 여부 및 희망 활동 조사',
        fields: [
          { id: 'f103-1', type: 'text', label: '부서명', required: true, nullable: false, width: '50%' },
          { id: 'f103-2', type: 'text', label: '성명', required: true, nullable: false, width: '50%' },
          { id: 'f103-3', type: 'radio', label: '참석 여부', required: true, nullable: false, width: '100%', options: ['참석', '불참'] },
          { id: 'f103-4', type: 'checkbox', label: '희망 액티비티 (선택)', required: false, nullable: true, width: '100%', options: ['등산', '볼링', '방탈출', '보드게임'] },
        ]
      };
    }
    if (id === 'f-104') {
      return {
        id: 'f-104',
        title: 'IT 장비 지급 요청서 (보안동의서 포함)',
        description: '노트북 및 모니터 신청',
        fields: [
          { id: 'f104-1', type: 'text', label: '신청자 사번', required: true, nullable: false, width: '100%' },
          { id: 'f104-2', type: 'text', label: '요청 장비 (노트북/모니터 등)', required: true, nullable: false, width: '100%' },
        ]
      };
    }
    if (id === 'f-999') {
      return {
        id: 'f-999',
        title: '종합 컴포넌트 테스트 양식지 (f-999)',
        description: '모든 23종 컴포넌트가 포함된 대규모 테스트 폼입니다.',
        fields: [
          { id: 'f999-1', type: 'text', label: '단답형 (이름)', required: true, nullable: false, width: '50%' },
          { id: 'f999-2', type: 'number', label: '숫자 (나이)', required: true, nullable: false, width: '50%' },
          { id: 'f999-3', type: 'regex-input', label: '연락처 (정규식)', required: true, nullable: false, regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$', width: '50%' },
          { id: 'f999-4', type: 'date', label: '방문 일자', required: false, nullable: true, width: '50%' },
          { id: 'f999-5', type: 'textarea', label: '장문형 (요청사항)', required: false, nullable: true, width: '100%' },
          { id: 'f999-6', type: 'select', label: '드롭다운 (부서)', required: true, nullable: false, width: '50%', options: ['개발팀', '디자인팀', '기획팀', '마케팅팀'] },
          { id: 'f999-7', type: 'radio', label: '단일 선택 (성별)', required: true, nullable: false, width: '50%', options: ['남성', '여성', '선택 안함'] },
          { id: 'f999-8', type: 'checkbox', label: '다중 선택 (관심사)', required: false, nullable: true, width: '100%', options: ['IT', '스포츠', '음악', '독서', '여행'] },
          { id: 'f999-9', type: 'map-address', label: '지도 및 주소', required: false, nullable: true, width: '100%' },
          { id: 'f999-10', type: 'file', label: '파일 첨부 (이력서 등)', required: false, nullable: true, width: '50%' },
          { id: 'f999-11', type: 'image', label: '단일 이미지 (프로필)', required: false, nullable: true, width: '50%' },
          { id: 'f999-12', type: 'image-gallery', label: '이미지 갤러리', required: false, nullable: true, width: '100%' },
          { id: 'f999-13', type: 'video-link', label: '동영상 링크', required: false, nullable: true, width: '100%' },
          { id: 'f999-14', type: 'table', label: '경력 테이블 (Table)', required: false, nullable: true, width: '100%' },
          { id: 'f999-15', type: 'nested-report', label: '하위 레포트 (프로젝트 상세)', required: false, nullable: true, width: '100%' },
          { id: 'f999-16', type: 'report-link', label: '관련 레포트 링크', required: false, nullable: true, width: '100%' },
          { id: 'f999-17', type: 'comment-thread', label: '댓글 코멘트 쓰레드', required: false, nullable: true, width: '100%' },
          { id: 'f999-18', type: 'slide-card', label: '슬라이드 카드 프리젠테이션', required: false, nullable: true, width: '100%' },
          { id: 'f999-19', type: 'popup-toggle', label: '안내 팝업 텍스트', required: false, nullable: true, width: '100%' },
          { id: 'f999-20', type: 'api-select', label: 'API 연동 리스트 (동적 사원검색)', required: false, nullable: true, width: '100%' },
          { id: 'f999-21', type: 'csv-select', label: 'CSV 대량 붙여넣기 데이터', required: false, nullable: true, width: '100%' },
          { id: 'f999-22', type: 'privacy-consent', label: '개인정보 활용 동의서', required: true, nullable: false, width: '100%' },
          { id: 'f999-23', type: 'signature', label: '자필 서명란', required: true, nullable: false, width: '100%' },
        ]
      };
    }
    return {
      title: '',
      description: '',
      fields: []
    };
  });

  const fields = template.fields || [];
  const setFields = (newFields: FormField[]) => setTemplate(prev => ({ ...prev, fields: newFields }));

  // Preview Modal State
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'mobile' | 'pc' | 'hybrid'>('hybrid');

  // Bulk Selection State
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  // Drag and Drop (Simple Sort State)
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: uuidv4(),
      type,
      label: '새 항목',
      required: false,
      nullable: true,
      width: '100%',
      options: ['옵션 1', '옵션 2']
    };
    setFields([...fields, newField]);
  };

  const addFavoriteBlock = () => {
    // 예제: 인적사항 세트 (이름, 연락처, 주소)
    const block: FormField[] = [
      { id: uuidv4(), type: 'text', label: '성명', required: true, width: '50%' },
      { id: uuidv4(), type: 'regex-input', label: '휴대폰 번호', required: true, regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$', width: '50%' },
      { id: uuidv4(), type: 'map-address', label: '거주지 주소', required: true, width: '100%' },
    ];
    setFields([...fields, ...block]);
  };

  const toggleSelection = (id: string, multi: boolean) => {
    const newSet = new Set(multi ? selectedFields : []);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedFields(newSet);
  };

  const selectAll = () => {
    if (selectedFields.size === fields.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(fields.map(f => f.id)));
    }
  };

  const handleBulkAction = (action: 'require' | 'optional' | 'delete') => {
    if (selectedFields.size === 0) return;
    
    if (action === 'delete') {
      if(confirm(`선택한 ${selectedFields.size}개 필드를 정말 삭제하시겠습니까?`)) {
        setFields(fields.filter(f => !selectedFields.has(f.id)));
        setSelectedFields(new Set());
      }
      return;
    }

    setFields(fields.map(field => {
      if (selectedFields.has(field.id)) {
        if (action === 'require') return { ...field, required: true, nullable: false };
        if (action === 'optional') return { ...field, required: false, nullable: true };
      }
      return field;
    }));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    if (direction === 'up' && index > 0) {
      [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    } else if (direction === 'down' && index < newFields.length - 1) {
      [newFields[index + 1], newFields[index]] = [newFields[index], newFields[index + 1]];
    }
    setFields(newFields);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleSave = async () => {
    console.log('Saving template:', template);
    alert('저장되었습니다. (콘솔 확인)');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar: Toolbox */}
      <div className="w-64 bg-white border-r p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4 text-gray-800">양식 도구</h2>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {FIELD_TYPES.map((ft) => (
            <button
              key={ft.type}
              onClick={() => addField(ft.type)}
              className="flex flex-col items-center justify-center p-3 border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors bg-gray-50 text-gray-700"
            >
              {ft.icon}
              <span className="text-xs mt-2">{ft.label}</span>
            </button>
          ))}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">즐겨찾기 블록 / 추천</h3>
          <button 
            onClick={addFavoriteBlock}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 p-3 rounded-lg transition-colors"
          >
            <Star className="w-4 h-4" />
            <span className="font-medium text-sm">인적사항 세트 (이름+연락처+주소) 추가</span>
          </button>
        </div>
      </div>

      {/* Main Content - Canvas */}
      <div className="flex-1 bg-gray-100 overflow-y-auto p-8 relative">
        {/* Bulk Action Bar (Floating) */}
        {selectedFields.size > 0 && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-full shadow-2xl z-40 flex items-center space-x-6">
            <span className="font-bold">{selectedFields.size}개 선택됨</span>
            <div className="flex space-x-3 border-l border-gray-700 pl-6">
              <button onClick={() => handleBulkAction('require')} className="text-sm font-medium hover:text-blue-300">모두 필수로 변경</button>
              <button onClick={() => handleBulkAction('optional')} className="text-sm font-medium hover:text-gray-300">모두 선택(Null)으로 변경</button>
              <button onClick={() => handleBulkAction('delete')} className="text-sm font-medium text-red-400 hover:text-red-300 border-l border-gray-700 pl-3">일괄 삭제</button>
            </div>
            <button onClick={() => setSelectedFields(new Set())} className="ml-4 text-gray-400 hover:text-white">✕</button>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <AiAutoGenerator onGenerated={(newFields) => setFields([...fields, ...newFields])} />

          <div className="bg-white rounded-xl shadow-md border border-gray-200 min-h-[600px] p-8">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h1 className="text-2xl font-bold text-gray-900">보고서 양식 편집기</h1>
              <div className="flex space-x-2">
                <button onClick={() => setShowPreview(true)} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors">
                  <Globe className="w-4 h-4" />
                  <span>배포 사전 확인</span>
                </button>
                <button onClick={handleSave} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                  <Save className="w-4 h-4" />
                  <span>양식 저장</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <input type="text" placeholder="보고서 제목" className="w-full text-3xl font-bold border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 outline-none" value={template.title} onChange={(e) => setTemplate({ ...template, title: e.target.value })} />
              <textarea placeholder="보고서 설명" className="w-full text-gray-600 border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 outline-none resize-none" value={template.description} onChange={(e) => setTemplate({ ...template, description: e.target.value })} rows={2} />
            </div>

            <div className="flex justify-between items-center mt-8">
              <h2 className="text-lg font-bold text-gray-800">입력 항목 구성</h2>
              <button onClick={selectAll} className="text-sm text-indigo-600 hover:underline">
                {selectedFields.size === fields.length && fields.length > 0 ? '전체 선택 해제' : '전체 선택'}
              </button>
            </div>
            
            <div className="flex flex-wrap -mx-2 mt-4">
              {fields.map((field, index) => {
                const isSelected = selectedFields.has(field.id);
                return (
                  <div key={field.id} className={`p-2 transition-all duration-200 ${field.width === '50%' ? 'w-1/2' : 'w-full'}`}>
                    <div className={`p-5 rounded-lg border-2 ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'} shadow-sm relative group`}>
                      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-gray-300 cursor-pointer" checked={isSelected} onChange={() => toggleSelection(field.id, true)} />
                      </div>
                      <div className="absolute top-3 right-12 text-gray-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripHorizontal className="w-5 h-5" />
                      </div>

                      <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveField(index, 'up')} className="p-1 text-gray-500 hover:text-blue-600 bg-white rounded shadow-sm" disabled={index === 0}><ArrowUp className="w-4 h-4" /></button>
                        <button onClick={() => moveField(index, 'down')} className="p-1 text-gray-500 hover:text-blue-600 bg-white rounded shadow-sm" disabled={index === fields.length - 1}><ArrowDown className="w-4 h-4" /></button>
                        <button onClick={() => removeField(field.id)} className="p-1 text-gray-500 hover:text-red-600 bg-white rounded shadow-sm"><Trash2 className="w-4 h-4" /></button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase">항목 이름</label>
                          <input type="text" value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase">설명 (선택)</label>
                          <input type="text" value={field.description || ''} onChange={(e) => updateField(field.id, { description: e.target.value })} className="w-full p-2 border rounded" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
                        <div className="flex flex-col space-y-3">
                          <h4 className="text-xs font-bold text-gray-500 uppercase">입력 강제 옵션</h4>
                          <label className="flex items-center space-x-2"><input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, { required: e.target.checked, nullable: !e.target.checked })} /> <span className="text-sm">필수</span></label>
                        </div>
                        <div className="flex flex-col space-y-3">
                          <h4 className="text-xs font-bold text-gray-500 uppercase">레이아웃</h4>
                          <div className="flex space-x-2">
                            <button onClick={() => updateField(field.id, { width: '100%' })} className={`px-2 py-1 text-xs rounded border ${field.width === '100%' ? 'bg-indigo-50' : ''}`}>100%</button>
                            <button onClick={() => updateField(field.id, { width: '50%' })} className={`px-2 py-1 text-xs rounded border ${field.width === '50%' ? 'bg-indigo-50' : ''}`}>50%</button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Regex Specific Settings */}
                      {field.type === 'regex-input' && (
                        <div className="space-y-2 p-3 border border-blue-100 bg-blue-50 rounded mt-4">
                          <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                            <Regex className="w-4 h-4 text-blue-600" />
                            <span>정규식(Regex) 검증 패턴 설정</span>
                          </label>
                          <select
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                            value={field.regexPattern || ''}
                            onChange={(e) => updateField(field.id, { regexPattern: e.target.value })}
                          >
                            <option value="">패턴 선택 (자유 입력)</option>
                            <option value="^01(?:0|1|[6-9])-(?:\d{3}|\d{4})-\d{4}$">휴대폰 번호 (010-XXXX-XXXX)</option>
                            <option value="^\d{2}[0-1]\d[0-3]\d-[1-4]\d{6}$">주민등록번호 (YYYYYY-XXXXXXX)</option>
                            <option value="^\d{3}-\d{2}-\d{5}$">사업자등록번호 (XXX-XX-XXXXX)</option>
                            <option value="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$">이메일 주소</option>
                          </select>
                        </div>
                      )}

                      {/* Map Specific Warning */}
                      {field.type === 'map-address' && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800 flex items-start space-x-2 mt-4">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>입력된 주소를 기반으로 Google Maps 또는 네이버 지도의 핀이 자동으로 표시되는 복합 컴포넌트입니다.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Deployment Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl flex flex-col h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">배포 전 사전 확인 (디바이스 프리뷰)</h2>
                <p className="text-sm text-gray-500 mt-1">사용자들이 이 폼을 주로 어떤 기기에서 입력하나요?</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              <div className="w-64 border-r border-gray-200 p-6 flex flex-col space-y-4 bg-gray-50">
                <h3 className="font-semibold text-gray-700">타겟 디바이스 선택</h3>
                <button 
                  onClick={() => setPreviewMode('mobile')}
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${previewMode === 'mobile' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white hover:bg-gray-100'}`}
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="font-medium">모바일 폰 주력</span>
                </button>
                <button 
                  onClick={() => setPreviewMode('pc')}
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${previewMode === 'pc' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white hover:bg-gray-100'}`}
                >
                  <Monitor className="w-5 h-5" />
                  <span className="font-medium">PC 화면 주력</span>
                </button>
                <button 
                  onClick={() => setPreviewMode('hybrid')}
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${previewMode === 'hybrid' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white hover:bg-gray-100'}`}
                >
                  <Globe className="w-5 h-5" />
                  <span className="font-medium">둘 다 대응 (반응형)</span>
                </button>
                
                <div className="mt-auto pt-6">
                  <button 
                    onClick={() => { setShowPreview(false); handleSave(); }}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm"
                  >
                    이 설정으로 최종 배포
                  </button>
                </div>
              </div>
              
              <div className="flex-1 bg-gray-200 flex items-center justify-center p-8 overflow-y-auto">
                {/* Simulated Device Frame */}
                <div 
                  className={`bg-white shadow-2xl overflow-y-auto transition-all duration-300 ${
                    previewMode === 'mobile' ? 'w-[375px] h-[812px] rounded-[2.5rem] border-[8px] border-gray-900 p-6' : 
                    previewMode === 'pc' ? 'w-full max-w-4xl h-full rounded-lg border border-gray-300 p-10' :
                    'w-full max-w-2xl h-[90%] rounded-xl border border-gray-300 p-8'
                  }`}
                >
                  <h1 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b">{template.title}</h1>
                  {fields.length === 0 ? (
                    <div className="text-center text-gray-400 py-20">양식 내용이 없습니다.</div>
                  ) : (
                    <div className="flex flex-wrap -mx-2">
                      {fields.map(field => (
                        <div key={field.id} className={`p-2 ${previewMode === 'mobile' ? 'w-full' : (field.width === '50%' ? 'w-1/2' : 'w-full')}`}>
                          <div className="flex flex-col space-y-2">
                            <label className="font-medium text-gray-700">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <div className="p-3 border border-gray-200 rounded-md bg-gray-50 text-gray-400 text-sm">
                              {FIELD_TYPES.find(t => t.type === field.type)?.label} 입력란
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
