'use client';

import React, { useEffect, useState } from 'react';
import { Lock, UserCheck } from 'lucide-react';
import type { FormListItem } from '@/lib/apiTypes';

interface Props {
  formId: string;
  /** 서버(page.tsx)가 응답 세션 쿠키로 판정한 신원 — 식별 응답이면 배지를 보여준다. */
  identified: boolean;
  respondentName: string | null;
}

export default function PublicFormViewer({ formId, identified, respondentName }: Props) {
  const [form, setForm] = useState<FormListItem | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!formId) return;
    let cancelled = false;
    // countView=1: 실제 사용자가 폼을 열람했을 때만 조회수를 카운트한다.
    fetch(`/api/forms/${formId}?countView=1`)
      .then((res) => (res.ok ? res.json() : { form: null }))
      .then((json) => {
        if (!cancelled) setForm(json.form ?? null);
      })
      .catch(() => {
        if (!cancelled) setForm(null);
      });
    return () => {
      cancelled = true;
    };
  }, [formId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const data: Record<string, unknown> = {};
      for (const field of form.fields) {
        if (field.type === 'checkbox') {
          data[field.id] = formData.getAll(field.id);
        } else {
          data[field.id] = formData.get(field.id) ?? '';
        }
      }
      const res = await fetch(`/api/forms/${formId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        alert('제출에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (form === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">양식지를 불러오는 중입니다...</div>
      </div>
    );
  }

  if (form === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">존재하지 않거나 마감된 양식지입니다.</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">제출되었습니다</h1>
          <p className="text-gray-600">소중한 응답 감사합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="mb-8 border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900">{form.title}</h1>
          <p className="mt-2 text-gray-600">{form.description}</p>

          {identified && (
            <div className="mt-4 inline-flex items-center px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-700">
              <UserCheck className="w-3.5 h-3.5 mr-1.5" />
              {respondentName ? `${respondentName} 님의 개인화 링크로 접속됨` : '개인화 링크로 접속됨'}
            </div>
          )}

          {/* 익명 문항 사전 고지 — 신뢰는 눈에 보여야 생긴다 */}
          {form.fields.some((f) => f.anonymous) && (
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 flex items-start">
              <Lock className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-slate-500" />
              <span>
                🔒 표시된 문항은 <strong>익명으로 저장</strong>되며 작성자와 연결되지 않습니다.
                관리자를 포함해 누구도 개별 응답을 열람할 수 없고, 제출 후에는 본인도 수정할 수 없습니다.
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {form.fields.map((field) => (
            <div key={field.id} className="flex flex-col space-y-2">
              <label className="font-semibold text-gray-800 flex items-center gap-2">
                {field.label} {field.required && <span className="text-red-500">*</span>}
                {field.anonymous && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    <Lock className="w-3 h-3 mr-1" /> 익명
                  </span>
                )}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  name={field.id}
                  required={field.required}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-y min-h-[100px]"
                  placeholder={`${field.label} 입력`}
                />
              ) : field.type === 'number' ? (
                <input
                  name={field.id}
                  type="number"
                  required={field.required}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder={`${field.label} 입력`}
                />
              ) : field.type === 'date' ? (
                <input
                  name={field.id}
                  type="date"
                  required={field.required}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              ) : field.type === 'select' ? (
                <select
                  name={field.id}
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
                  name={field.id}
                  type="file"
                  required={field.required}
                  className="w-full p-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500"
                />
              ) : (
                <input
                  name={field.id}
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
              disabled={submitting}
              className="w-full py-4 bg-indigo-600 text-white rounded-lg font-bold text-lg hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50"
            >
              {submitting ? '제출 중...' : '제출하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
