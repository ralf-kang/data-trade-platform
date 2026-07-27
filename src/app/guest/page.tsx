'use client';

import { useState, useRef, useEffect } from 'react';
import { Maximize, Minimize } from 'lucide-react';

export default function GuestPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen bg-gray-50 flex flex-col items-center p-4 md:p-8 transition-all duration-300 ${isFullscreen ? 'justify-start overflow-y-auto' : 'justify-center'}`}
    >
      <div className={`w-full bg-white shadow rounded-lg relative transition-all duration-300 ${isFullscreen ? 'max-w-full min-h-screen rounded-none shadow-none' : 'max-w-3xl p-8'}`}>
        
        {/* Header and Controls */}
        <div className={`flex justify-between items-start mb-6 ${isFullscreen ? 'p-6 border-b border-gray-100 sticky top-0 bg-white z-10 shadow-sm' : ''}`}>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">보고서 제출 (게스트 모드)</h1>
            <p className="text-sm md:text-base text-gray-600">
              관리자가 공유한 링크를 통해 접근하셨습니다. 별도의 로그인 없이 아래 양식을 작성하고 제출할 수 있습니다.
            </p>
          </div>
          
          <button 
            onClick={toggleFullscreen}
            className="flex flex-col items-center justify-center p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors ml-4 shrink-0"
            title={isFullscreen ? "전체화면 종료" : "전체화면으로 보기"}
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold">화면 축소</span>
              </>
            ) : (
              <>
                <Maximize className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold">전체 화면</span>
              </>
            )}
          </button>
        </div>
        
        <div className={isFullscreen ? 'p-6 max-w-4xl mx-auto' : ''}>
          {/* Placeholder for rendered FormTemplate */}
          <div className="border border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-500 bg-gray-50 min-h-[400px] flex items-center justify-center">
            [여기에 관리자가 설정한 양식(FormTemplate)이 렌더링됩니다]
          </div>

          <div className="mt-8 flex justify-end">
            <button className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all active:scale-95">
              제출하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
