'use client';

import { useState } from 'react';
import { Copy, Edit3, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { FormTemplate, FormField } from '@/components/builder/types';

export default function AdminTemplatesPage() {
  // Mock Templates
  const [templates, setTemplates] = useState<FormTemplate[]>([
    {
      id: 'f-101',
      title: '2024 하반기 고객 만족도 조사',
      description: '고객 피드백 수집용 양식',
      fields: [
        { id: 'f101-1', type: 'text', label: '고객명', required: true, width: '50%' },
        { id: 'f101-2', type: 'regex-input', label: '연락처', required: true, regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$', width: '50%' },
        { id: 'f101-3', type: 'text', label: '이용 중인 서비스', required: true },
        { id: 'f101-4', type: 'text', label: '개선 사항 (선택)', required: false },
      ],
      createdAt: '2026-07-27 10:30',
      updatedAt: '2026-07-27 15:20',
    },
    {
      id: 'f-102',
      title: '신규 입사자 온보딩 피드백',
      description: '사내 온보딩 세션 피드백',
      fields: [
        { id: 'f102-1', type: 'text', label: '부서명', required: true, width: '50%' },
        { id: 'f102-2', type: 'text', label: '입사자 성함', required: true, width: '50%' },
        { id: 'f102-3', type: 'text', label: '가장 유용했던 세션', required: true },
        { id: 'f102-4', type: 'map-address', label: '근무 희망지 (옵션)', required: false },
      ],
      createdAt: '2026-07-19 09:00',
      updatedAt: '2026-07-20 09:30',
    },
    {
      id: 'f-103',
      title: '2026년 하반기 워크샵 참가 신청서',
      description: '전사 워크샵 참석 여부 및 희망 활동 조사',
      fields: [
        { id: 'f103-1', type: 'text', label: '부서명', required: true, width: '50%' },
        { id: 'f103-2', type: 'text', label: '성명', required: true, width: '50%' },
        { id: 'f103-3', type: 'radio', label: '참석 여부', required: true, options: ['참석', '불참'] },
        { id: 'f103-4', type: 'checkbox', label: '희망 액티비티 (선택)', required: false, options: ['등산', '볼링', '방탈출', '보드게임'] },
      ],
      createdAt: '2026-07-21 10:00',
      updatedAt: '2026-07-23 09:45',
    },
    {
      id: 'f-104',
      title: 'IT 장비 지급 요청서 (보안동의서 포함)',
      description: '노트북 및 모니터 신청',
      fields: [
        { id: 'f104-1', type: 'text', label: '신청자 사번', required: true },
        { id: 'f104-2', type: 'text', label: '요청 장비 (노트북/모니터 등)', required: true },
      ],
      createdAt: '2026-07-09 11:00',
      updatedAt: '2026-07-11 10:15',
    },
    {
      id: 'f-999',
      title: '종합 컴포넌트 테스트 양식지 (f-999)',
      description: '모든 23종 컴포넌트가 포함된 대규모 테스트 폼입니다.',
      fields: [],
      createdAt: '2026-07-27 17:30',
      updatedAt: '2026-07-27 17:30',
    }
  ]);

  const [showCloneModal, setShowCloneModal] = useState(false);
  const [selectedTemplateForClone, setSelectedTemplateForClone] = useState<FormTemplate | null>(null);
  const [selectedFieldsToClone, setSelectedFieldsToClone] = useState<Set<string>>(new Set());

  const openCloneModal = (template: FormTemplate) => {
    setSelectedTemplateForClone(template);
    setSelectedFieldsToClone(new Set(template.fields?.map(f => f.id) || [])); // Default: select all
    setShowCloneModal(true);
  };

  const toggleFieldClone = (fieldId: string) => {
    const newSet = new Set(selectedFieldsToClone);
    if (newSet.has(fieldId)) {
      newSet.delete(fieldId);
    } else {
      newSet.add(fieldId);
    }
    setSelectedFieldsToClone(newSet);
  };

  const handleCloneSubmit = () => {
    if (!selectedTemplateForClone) return;
    
    // Partial Clone Logic
    const fieldsToCopy = selectedTemplateForClone.fields?.filter(f => selectedFieldsToClone.has(f.id)).map(f => ({
      ...f,
      id: crypto.randomUUID() // new IDs for cloned fields
    })) || [];

    const now = new Date().toLocaleString('ko-KR', { hour12: false }).slice(0, 16).replace('.', '-');
    const newTemplate: FormTemplate = {
      id: `tpl-${Date.now()}`,
      title: `${selectedTemplateForClone.title} (복사본)`,
      description: selectedTemplateForClone.description,
      fields: fieldsToCopy,
      createdAt: now,
      updatedAt: now,
    };

    setTemplates([newTemplate, ...templates]);
    setShowCloneModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('정말로 이 양식을 삭제하시겠습니까?')) {
      setTemplates(templates.filter(t => t.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">내 템플릿 관리</h1>
            <p className="text-gray-500 mt-2">내가 작성한 양식을 관리하고 복사하여 새로운 양식을 만들 수 있습니다.</p>
          </div>
          <a href="/admin/builder" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700">
            + 새 양식 만들기 (빈 양식)
          </a>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">양식 제목</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">필드 수</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">생성일</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리/작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{template.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {template.fields?.length || 0}개
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {template.createdAt}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                    <div className="flex justify-end space-x-3">
                      <button onClick={() => openCloneModal(template)} className="text-indigo-600 hover:text-indigo-900 flex items-center" title="이 양식을 기반으로 복사">
                        <Copy className="w-4 h-4 mr-1" /> 복사(Clone)
                      </button>
                      <a href={`/admin/builder?id=${template.id}`} className="text-blue-600 hover:text-blue-900 flex items-center">
                        <Edit3 className="w-4 h-4 mr-1" /> 편집
                      </a>
                      <button onClick={() => handleDelete(template.id)} className="text-red-600 hover:text-red-900 flex items-center">
                        <Trash2 className="w-4 h-4 mr-1" /> 삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Partial Clone Modal */}
        {showCloneModal && selectedTemplateForClone && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">양식 복사 (Partial Clone)</h2>
                <p className="text-sm text-gray-500 mt-1">원본 양식 전체를 복사하거나, 필요한 특정 필드만 골라서 복사할 수 있습니다.</p>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto bg-gray-50">
                <div className="mb-4">
                  <span className="font-semibold text-gray-700">원본 템플릿: </span>
                  <span className="text-indigo-700">{selectedTemplateForClone.title}</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-3 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                    <span className="font-medium text-gray-700 text-sm">복사할 필드 선택</span>
                    <button 
                      onClick={() => {
                        const allFieldIds = selectedTemplateForClone.fields?.map(f => f.id) || [];
                        setSelectedFieldsToClone(selectedFieldsToClone.size === allFieldIds.length ? new Set() : new Set(allFieldIds));
                      }}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      전체 선택/해제
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {selectedTemplateForClone.fields?.map((field) => {
                      const isSelected = selectedFieldsToClone.has(field.id);
                      return (
                        <div 
                          key={field.id} 
                          onClick={() => toggleFieldClone(field.id)}
                          className={`p-3 flex items-center space-x-3 cursor-pointer hover:bg-indigo-50 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}
                        >
                          {isSelected ? (
                            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-300" />
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{field.label}</div>
                            <div className="text-xs text-gray-500">타입: {field.type} {field.required ? '(필수)' : '(선택)'}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 bg-white">
                <button 
                  onClick={() => setShowCloneModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 font-medium"
                >
                  취소
                </button>
                <button 
                  onClick={handleCloneSubmit}
                  disabled={selectedFieldsToClone.size === 0}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  선택한 {selectedFieldsToClone.size}개 필드로 복사본 생성
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
