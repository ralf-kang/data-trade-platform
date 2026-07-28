'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { FormListItem } from '@/lib/apiTypes';

export default function PublicFormViewer() {
  const params = useParams();
  const formId = params?.id as string;
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
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {form.fields.map((field) => (
            <div key={field.id} className="flex flex-col space-y-2">
              <label className="font-semibold text-gray-800">
                {field.label} {field.required && <span className="text-red-500">*</span>}
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
