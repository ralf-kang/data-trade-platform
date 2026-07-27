'use client';

import { useState } from 'react';
import { Sparkles, FileUp, Loader2 } from 'lucide-react';
import { FormField } from './types';

interface AiAutoGeneratorProps {
  onGenerated: (fields: FormField[]) => void;
}

export default function AiAutoGenerator({ onGenerated }: AiAutoGeneratorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    // TODO: 1. Claude Session OAuth 연동 
    // TODO: 2. File Parsing (PDF, Excel, Word, HWPX)
    // TODO: 3. Agent에 컨텍스트 전달하여 JSON Form Field 구조로 응답받기 (screen-watcher 참고)
    
    setTimeout(() => {
      // Mock Response for Demonstration
      const mockGeneratedFields: FormField[] = [
        { id: crypto.randomUUID(), type: 'text', label: `[AI 추출] ${file.name} 제목`, required: true },
        { id: crypto.randomUUID(), type: 'textarea', label: '[AI 추출] 상세 내용', required: false },
        { id: crypto.randomUUID(), type: 'date', label: '[AI 추출] 마감일', required: true }
      ];
      onGenerated(mockGeneratedFields);
      setIsProcessing(false);
    }, 2500);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-100 mb-8 shadow-sm">
      <div className="flex items-center space-x-2 mb-4">
        <Sparkles className="w-6 h-6 text-indigo-600" />
        <h2 className="text-xl font-bold text-gray-800">AI 양식 자동 생성기 (마법사)</h2>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        기존에 사용하시던 엑셀, 워드, PDF, 한글(HWP) 문서를 업로드하면 AI가 구조를 분석하여 자동으로 디지털 양식을 만들어 줍니다.
      </p>

      <div 
        className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center transition-colors
          ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-indigo-400 hover:bg-gray-50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => !isProcessing && document.getElementById('ai-file-upload')?.click()}
      >
        <input 
          id="ai-file-upload" 
          type="file" 
          className="hidden" 
          accept=".pdf,.doc,.docx,.xls,.xlsx,.hwp,.hwpx"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />
        
        {isProcessing ? (
          <>
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-medium text-gray-600">AI(Claude)가 문서를 분석하여 양식을 구성 중입니다...</p>
          </>
        ) : (
          <>
            <FileUp className="w-10 h-10 text-indigo-400 mb-3" />
            <p className="text-sm font-medium text-gray-700">여기로 파일을 드래그하거나 클릭하여 업로드 하세요</p>
            <p className="text-xs text-gray-400 mt-1">지원 포맷: PDF, Word, Excel, HWPX</p>
          </>
        )}
      </div>
    </div>
  );
}
