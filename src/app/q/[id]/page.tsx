'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FormTemplate } from '@/components/builder/types';

export default function PublicFormViewer() {
  const params = useParams();
  const formId = params?.id as string;
  const [template, setTemplate] = useState<Partial<FormTemplate> | null>(null);

  useEffect(() => {
    // Mock fetch form template
    if (formId === 'f-101') {
      setTemplate({
        id: 'f-101',
        title: '2024 하반기 고객 만족도 조사',
        description: '고객 피드백 수집용 양식',
        fields: [
          { id: 'f101-1', type: 'text', label: '고객명', required: true, width: '100%' },
          { id: 'f101-2', type: 'text', label: '연락처', required: true, width: '100%' },
          { id: 'f101-3', type: 'text', label: '이용 중인 서비스', required: true, width: '100%' },
          { id: 'f101-4', type: 'textarea', label: '개선 사항 (선택)', required: false, width: '100%' },
        ]
      });
    } else if (formId === 'f-102') {
      setTemplate({
        id: 'f-102',
        title: '신규 입사자 온보딩 피드백',
        description: '사내 온보딩 세션 피드백',
        fields: [
          { id: 'f102-1', type: 'text', label: '부서명', required: true, width: '100%' },
          { id: 'f102-2', type: 'text', label: '입사자 성함', required: true, width: '100%' },
          { id: 'f102-3', type: 'text', label: '가장 유용했던 세션', required: true, width: '100%' },
          { id: 'f102-4', type: 'text', label: '근무 희망지 (옵션)', required: false, width: '100%' },
        ]
      });
    } else if (formId === 'f-104') {
      setTemplate({
        id: 'f-104',
        title: 'IT 장비 지급 요청서 (보안동의서 포함)',
        description: '노트북 및 모니터 신청',
        fields: [
          { id: 'f104-1', type: 'text', label: '신청자 사번', required: true, width: '100%' },
          { id: 'f104-2', type: 'text', label: '요청 장비 (노트북/모니터 등)', required: true, width: '100%' },
        ]
      });
    }
  }, [formId]);

  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">양식지를 불러오는 중입니다...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="mb-8 border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900">{template.title}</h1>
          <p className="mt-2 text-gray-600">{template.description}</p>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); alert('제출되었습니다!'); }} className="space-y-6">
          {template.fields?.map((field) => (
            <div key={field.id} className="flex flex-col space-y-2">
              <label className="font-semibold text-gray-800">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              
              {field.type === 'textarea' ? (
                <textarea 
                  required={field.required}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-y min-h-[100px]"
                  placeholder={`${field.label} 입력`}
                />
              ) : (
                <input 
                  type="text" 
                  required={field.required}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder={`${field.label} 입력`}
                />
              )}
            </div>
          ))}

          <div className="pt-6">
            <button 
              type="submit"
              className="w-full py-4 bg-indigo-600 text-white rounded-lg font-bold text-lg hover:bg-indigo-700 transition-colors shadow-md"
            >
              제출하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
