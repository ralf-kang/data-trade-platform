'use client';

import { useEffect, useState } from 'react';
import { Copy, Edit3, Trash2, CheckCircle2, Circle } from 'lucide-react';
import type { FormListItem } from '@/lib/apiTypes';

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<FormListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 목록 재조회(복사 후 새로고침 등 이벤트 핸들러 전용) — 로딩 상태를 다시 true로 보여준다.
  const reloadTemplates = () => {
    setLoading(true);
    fetch('/api/forms')
      .then((res) => res.json())
      .then((json) => setTemplates(json.forms ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // 최초 마운트 시 loading 초기값이 이미 true이므로 다시 설정할 필요가 없다.
    fetch('/api/forms')
      .then((res) => res.json())
      .then((json) => setTemplates(json.forms ?? []))
      .finally(() => setLoading(false));
  }, []);

  const [showCloneModal, setShowCloneModal] = useState(false);
  const [selectedTemplateForClone, setSelectedTemplateForClone] = useState<FormListItem | null>(null);
  const [selectedFieldsToClone, setSelectedFieldsToClone] = useState<Set<string>>(new Set());
  const [cloning, setCloning] = useState(false);

  const openCloneModal = (template: FormListItem) => {
    setSelectedTemplateForClone(template);
    setSelectedFieldsToClone(new Set(template.fields?.map((f) => f.id) || [])); // Default: select all
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

  const handleCloneSubmit = async () => {
    if (!selectedTemplateForClone) return;
    setCloning(true);
    try {
      // Partial Clone Logic — 선택된 필드만 새 id로 복사
      const fieldsToCopy =
        selectedTemplateForClone.fields
          ?.filter((f) => selectedFieldsToClone.has(f.id))
          .map((f) => ({ ...f, id: crypto.randomUUID() })) || [];

      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${selectedTemplateForClone.title} (복사본)`,
          description: selectedTemplateForClone.description,
          fields: fieldsToCopy,
        }),
      });
      if (!res.ok) {
        alert('복사에 실패했습니다.');
        return;
      }
      setShowCloneModal(false);
      reloadTemplates();
    } finally {
      setCloning(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 양식을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/forms/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('삭제에 실패했습니다.');
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
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
              {loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">불러오는 중...</td>
                </tr>
              )}
              {!loading && templates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">등록된 양식이 없습니다.</td>
                </tr>
              )}
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{template.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {template.fields?.length || 0}개
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {template.createdAt.slice(0, 16).replace('T', ' ')}
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
                  disabled={selectedFieldsToClone.size === 0 || cloning}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cloning ? '복사 중...' : `선택한 ${selectedFieldsToClone.size}개 필드로 복사본 생성`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
