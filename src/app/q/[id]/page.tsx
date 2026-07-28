'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { FormTemplate } from '@/components/builder/types';

function getTemplateForFormId(formId: string | undefined): Partial<FormTemplate> | null {
    // Mock fetch form template
    if (formId === 'f-101') {
      return {
        id: 'f-101',
        title: '2024 하반기 고객 만족도 조사',
        description: '고객 피드백 수집용 양식',
        fields: [
          { id: 'f101-1', type: 'text', label: '고객명', required: true, width: '100%' },
          { id: 'f101-2', type: 'text', label: '연락처', required: true, width: '100%' },
          { id: 'f101-3', type: 'text', label: '이용 중인 서비스', required: true, width: '100%' },
          { id: 'f101-4', type: 'textarea', label: '개선 사항 (선택)', required: false, width: '100%' },
        ]
      };
    } else if (formId === 'f-102') {
      return {
        id: 'f-102',
        title: '신규 입사자 온보딩 피드백',
        description: '사내 온보딩 세션 피드백',
        fields: [
          { id: 'f102-1', type: 'text', label: '부서명', required: true, width: '100%' },
          { id: 'f102-2', type: 'text', label: '입사자 성함', required: true, width: '100%' },
          { id: 'f102-3', type: 'text', label: '가장 유용했던 세션', required: true, width: '100%' },
          { id: 'f102-4', type: 'text', label: '근무 희망지 (옵션)', required: false, width: '100%' },
        ]
      };
    } else if (formId === 'f-103') {
      return {
        id: 'f-103',
        title: '2026년 하반기 워크샵 참가 신청서',
        description: '전사 워크샵 참석 여부 및 희망 활동 조사',
        fields: [
          { id: 'f103-1', type: 'text', label: '부서명', required: true, width: '100%' },
          { id: 'f103-2', type: 'text', label: '성명', required: true, width: '100%' },
          { id: 'f103-3', type: 'radio', label: '참석 여부', required: true, width: '100%', options: ['참석', '불참'] },
          { id: 'f103-4', type: 'checkbox', label: '희망 액티비티 (선택)', required: false, width: '100%', options: ['등산', '볼링', '방탈출', '보드게임'] },
        ]
      };
    } else if (formId === 'f-104') {
      return {
        id: 'f-104',
        title: 'IT 장비 지급 요청서 (보안동의서 포함)',
        description: '노트북 및 모니터 신청',
        fields: [
          { id: 'f104-1', type: 'text', label: '신청자 사번', required: true, width: '100%' },
          { id: 'f104-2', type: 'text', label: '요청 장비 (노트북/모니터 등)', required: true, width: '100%' },
        ]
      };
    } else if (formId === 'f-999') {
      return {
        id: 'f-999',
        title: '종합 컴포넌트 테스트 양식지 (f-999)',
        description: '모든 23종 컴포넌트가 포함된 대규모 테스트 폼입니다.',
        fields: [
          { id: 'f999-1', type: 'text', label: '단답형 (이름)', required: true, width: '50%' },
          { id: 'f999-2', type: 'number', label: '숫자 (나이)', required: true, width: '50%' },
          { id: 'f999-3', type: 'regex-input', label: '연락처 (정규식)', required: true, width: '50%', regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$' },
          { id: 'f999-4', type: 'date', label: '방문 일자', required: false, width: '50%' },
          { id: 'f999-5', type: 'textarea', label: '장문형 (요청사항)', required: false, width: '100%' },
          { id: 'f999-6', type: 'select', label: '드롭다운 (부서)', required: true, width: '50%', options: ['개발팀', '디자인팀', '기획팀', '마케팅팀'] },
          { id: 'f999-7', type: 'radio', label: '단일 선택 (성별)', required: true, width: '50%', options: ['남성', '여성', '선택 안함'] },
          { id: 'f999-8', type: 'checkbox', label: '다중 선택 (관심사)', required: false, width: '100%', options: ['IT', '스포츠', '음악', '독서', '여행'] },
          { id: 'f999-9', type: 'map-address', label: '지도 및 주소', required: false, width: '100%' },
          { id: 'f999-10', type: 'file', label: '파일 첨부 (이력서 등)', required: false, width: '50%' },
          { id: 'f999-11', type: 'image', label: '단일 이미지 (프로필)', required: false, width: '50%' },
          { id: 'f999-12', type: 'image-gallery', label: '이미지 갤러리', required: false, width: '100%' },
          { id: 'f999-13', type: 'video-link', label: '동영상 링크', required: false, width: '100%' },
          { id: 'f999-14', type: 'table', label: '경력 테이블 (Table)', required: false, width: '100%' },
          { id: 'f999-15', type: 'nested-report', label: '하위 레포트 (프로젝트 상세)', required: false, width: '100%' },
          { id: 'f999-16', type: 'report-link', label: '관련 레포트 링크', required: false, width: '100%' },
          { id: 'f999-17', type: 'comment-thread', label: '댓글 코멘트 쓰레드', required: false, width: '100%' },
          { id: 'f999-18', type: 'slide-card', label: '슬라이드 카드 프리젠테이션', required: false, width: '100%' },
          { id: 'f999-19', type: 'popup-toggle', label: '안내 팝업 텍스트', required: false, width: '100%' },
          { id: 'f999-20', type: 'api-select', label: 'API 연동 리스트 (동적 사원검색)', required: false, width: '100%' },
          { id: 'f999-21', type: 'csv-select', label: 'CSV 대량 붙여넣기 데이터', required: false, width: '100%' },
          { id: 'f999-22', type: 'privacy-consent', label: '개인정보 활용 동의서', required: true, width: '100%' },
          { id: 'f999-23', type: 'signature', label: '자필 서명란', required: true, width: '100%' },
        ]
      };
    }
    return null;
}

export default function PublicFormViewer() {
  const params = useParams();
  const formId = params?.id as string;
  const template = useMemo(() => getTemplateForFormId(formId), [formId]);

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
              ) : field.type === 'number' ? (
                <input
                  type="number"
                  required={field.required}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder={`${field.label} 입력`}
                />
              ) : field.type === 'date' ? (
                <input
                  type="date"
                  required={field.required}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              ) : field.type === 'select' ? (
                <select
                  required={field.required}
                  defaultValue=""
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="" disabled>선택해주세요</option>
                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : field.type === 'radio' ? (
                <div className="flex flex-wrap gap-4">
                  {field.options?.map(opt => (
                    <label key={opt} className="flex items-center space-x-2">
                      <input type="radio" name={field.id} value={opt} required={field.required} className="w-4 h-4" />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              ) : field.type === 'checkbox' ? (
                <div className="flex flex-wrap gap-4">
                  {field.options?.map(opt => (
                    <label key={opt} className="flex items-center space-x-2">
                      <input type="checkbox" name={field.id} value={opt} className="w-4 h-4" />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              ) : field.type === 'file' || field.type === 'image' || field.type === 'image-gallery' || field.type === 'signature' ? (
                <input
                  type="file"
                  required={field.required}
                  className="w-full p-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500"
                />
              ) : (
                <input
                  type="text"
                  required={field.required}
                  pattern={field.regexPattern}
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
