'use client';

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FormField, FieldType, FormTemplate } from './types';
import { 
  Type, AlignLeft, Hash, List, 
  CheckSquare, Calendar, Upload, PenTool,
  Trash2, ArrowUp, ArrowDown, Plus, Save,
  Image as ImageIcon, Images, Video, Table, FileBox, MessageSquare, Link as LinkIcon
} from 'lucide-react';

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
];

export default function FormBuilder() {
  const [template, setTemplate] = useState<Partial<FormTemplate>>({
    title: '',
    description: '',
    fields: []
  });

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: uuidv4(),
      type,
      label: '새로운 ' + FIELD_TYPES.find(f => f.type === type)?.label,
      required: false,
      options: ['옵션 1', '옵션 2'] // default for options-based fields
    };
    setTemplate(prev => ({ ...prev, fields: [...(prev.fields || []), newField] }));
  };

  const removeField = (id: string) => {
    setTemplate(prev => ({
      ...prev,
      fields: (prev.fields || []).filter(f => f.id !== id)
    }));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const fields = [...(template.fields || [])];
    if (direction === 'up' && index > 0) {
      [fields[index - 1], fields[index]] = [fields[index], fields[index - 1]];
    } else if (direction === 'down' && index < fields.length - 1) {
      [fields[index + 1], fields[index]] = [fields[index], fields[index + 1]];
    }
    setTemplate(prev => ({ ...prev, fields }));
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setTemplate(prev => ({
      ...prev,
      fields: (prev.fields || []).map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  };

  const handleSave = async () => {
    // API call to save template
    console.log('Saving template:', template);
    alert('저장되었습니다. (콘솔 확인)');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar: Toolbox */}
      <div className="w-64 bg-white border-r p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4 text-gray-800">양식 도구</h2>
        <div className="grid grid-cols-2 gap-2">
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
      </div>

      {/* Main Canvas */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-900">보고서 양식 편집기</h1>
            <button 
              onClick={handleSave}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              <Save className="w-4 h-4 mr-2" />
              양식 저장
            </button>
          </div>

          <div className="space-y-4 mb-8">
            <input
              type="text"
              placeholder="보고서 제목"
              className="w-full text-3xl font-bold border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 px-0 py-2 outline-none"
              value={template.title}
              onChange={(e) => setTemplate({ ...template, title: e.target.value })}
            />
            <textarea
              placeholder="보고서 설명"
              className="w-full text-gray-600 border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 px-0 py-2 outline-none resize-none"
              value={template.description}
              onChange={(e) => setTemplate({ ...template, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-6">
            {(template.fields || []).length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
                좌측 패널에서 도구를 클릭하여 양식을 추가하세요.
              </div>
            ) : (
              (template.fields || []).map((field, index) => (
                <div key={field.id} className="relative group border border-gray-200 rounded-lg p-4 bg-gray-50 hover:border-blue-400 transition-colors">
                  
                  {/* Field Actions */}
                  <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveField(index, 'up')} className="p-1 text-gray-500 hover:text-blue-600 bg-white rounded shadow-sm" disabled={index === 0}>
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => moveField(index, 'down')} className="p-1 text-gray-500 hover:text-blue-600 bg-white rounded shadow-sm" disabled={index === (template.fields?.length || 0) - 1}>
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeField(field.id)} className="p-1 text-gray-500 hover:text-red-600 bg-white rounded shadow-sm">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Field Editor */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">항목 이름</label>
                      <input 
                        type="text" 
                        value={field.label} 
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">설명 (선택)</label>
                      <input 
                        type="text" 
                        value={field.description || ''} 
                        onChange={(e) => updateField(field.id, { description: e.target.value })}
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="이 항목에 대한 설명..."
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-sm text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={field.required}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>필수 입력</span>
                    </label>
                    <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      타입: {FIELD_TYPES.find(t => t.type === field.type)?.label}
                    </span>
                  </div>

                  {/* Options Editor for Select/Radio/Checkbox */}
                  {['select', 'radio', 'checkbox'].includes(field.type) && (
                    <div className="mt-4 p-3 bg-white border rounded">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">선택지 관리</label>
                      <div className="space-y-2">
                        {field.options?.map((opt, i) => (
                          <div key={i} className="flex items-center space-x-2">
                            <input 
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...(field.options || [])];
                                newOpts[i] = e.target.value;
                                updateField(field.id, { options: newOpts });
                              }}
                              className="flex-1 p-1.5 text-sm border-b border-gray-200 focus:border-blue-500 outline-none"
                            />
                            <button 
                              onClick={() => {
                                const newOpts = field.options?.filter((_, idx) => idx !== i);
                                updateField(field.id, { options: newOpts });
                              }}
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            updateField(field.id, { options: [...(field.options || []), `옵션 ${(field.options?.length || 0) + 1}`] });
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center mt-2"
                        >
                          <Plus className="w-3 h-3 mr-1" /> 선택지 추가
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
