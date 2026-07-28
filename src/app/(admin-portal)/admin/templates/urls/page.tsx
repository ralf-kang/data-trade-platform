'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link as LinkIcon, QrCode, Power, Eye, Copy, ExternalLink, Settings2, BarChart2, Database, Key } from 'lucide-react';
import Link from 'next/link';
import type { FormListItem } from '@/lib/apiTypes';

export default function UrlManagerPage() {
  const [urls, setUrls] = useState<FormListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [apiModalFormId, setApiModalFormId] = useState<string | null>(null);
  const [generatedApis, setGeneratedApis] = useState<{ url: string, key: string }[]>([]);

  useEffect(() => {
    fetch('/api/forms')
      .then((res) => res.json())
      .then((json) => setUrls(json.forms ?? []))
      .finally(() => setLoading(false));
  }, []);

  // 렌더링 중 Math.random()을 직접 호출하지 않도록, 선택된 URL 기반의 결정적 패턴을 미리 계산
  const qrPattern = useMemo(() => {
    const seed = qrModalUrl || '';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return Array.from({ length: 36 }).map((_, i) => {
      hash = (hash * 1103515245 + 12345 + i) >>> 0;
      return hash % 2 === 0;
    });
  }, [qrModalUrl]);

  const toggleStatus = async (id: string, currentStatus: 'OPEN' | 'CLOSED') => {
    const newStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    const res = await fetch(`/api/forms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      alert('상태 변경에 실패했습니다.');
      return;
    }
    setUrls(urls.map(u => u.id === id ? { ...u, status: newStatus } : u));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('클립보드에 복사되었습니다.');
  };

  const handleGenerateMultipleApis = () => {
    // 다중 API 자동 생성 로직 (대용량 대응)
    setGeneratedApis([
      { url: `https://api.company.com/v1/forms/${apiModalFormId}/submit/node-a`, key: 'sk_live_x8F2j9aKd2' },
      { url: `https://api.company.com/v1/forms/${apiModalFormId}/submit/node-b`, key: 'sk_live_v9N3m4pLq1' },
      { url: `https://api.company.com/v1/forms/${apiModalFormId}/submit/node-c`, key: 'sk_live_z1C4b7vMw8' },
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-8">
      <div className="max-w-6xl mx-auto w-full">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <LinkIcon className="w-8 h-8 mr-3 text-indigo-600" />
              배포 URL 및 접속 관리
            </h1>
            <p className="text-slate-500 mt-2">생성된 양식지들의 외부 접속용 URL 리스트를 조회하고, 오픈 상태를 제어합니다.</p>
          </div>
          <Link href="/admin/dashboard" className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            대시보드로 돌아가기
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">양식지 정보</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">배포 URL</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">통계</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">배포 상태</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider text-right">관리</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">불러오는 중...</td>
                  </tr>
                )}
                {!loading && urls.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">등록된 양식이 없습니다.</td>
                  </tr>
                )}
                {urls.map(item => {
                  const fullUrl = typeof window !== 'undefined'
                    ? `${window.location.origin}${item.deployUrl ?? `/q/${item.id}`}`
                    : (item.deployUrl ?? `/q/${item.id}`);
                  return (
                  <tr key={item.id} className={`transition-colors ${item.status === 'CLOSED' ? 'bg-slate-50/50 opacity-75' : 'hover:bg-indigo-50/30'}`}>

                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 mb-1">{item.title}</div>
                      <div className="text-xs text-slate-400">ID: {item.id} | 최종 수정: {item.updatedAt.slice(0, 16).replace('T', ' ')}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-indigo-600 underline font-mono truncate max-w-[200px]">{fullUrl}</span>
                        <button onClick={() => handleCopy(fullUrl)} className="text-slate-400 hover:text-indigo-600" title="URL 복사">
                          <Copy className="w-4 h-4" />
                        </button>
                        <a href={fullUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-600" title="새 탭에서 열기">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col text-sm">
                        <span className="text-slate-600 flex items-center mb-1">
                          <Eye className="w-4 h-4 mr-1.5 text-slate-400" /> 조회: {item.viewCount.toLocaleString()}
                        </span>
                        <span className="text-slate-900 font-bold flex items-center">
                          <BarChart2 className="w-4 h-4 mr-1.5 text-indigo-500" /> 제출: {item.submissionCount.toLocaleString()}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {item.status === 'OPEN' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-emerald-700 bg-emerald-50 text-xs font-bold border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span> 서비스 중
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-slate-600 bg-slate-100 text-xs font-bold border border-slate-200">
                          <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5"></span> 마감됨
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => {
                          setApiModalFormId(item.id);
                          setGeneratedApis([{ url: `https://api.company.com/v1/forms/${item.id}/submit`, key: 'sk_live_a1b2c3d4e5' }]);
                        }}
                        className="p-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded shadow-sm transition-colors"
                        title="외부 연계 API 생성"
                      >
                        <Database className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setQrModalUrl(fullUrl)}
                        className="p-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded shadow-sm transition-colors"
                        title="QR 코드 생성"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded shadow-sm transition-colors"
                        title="설정"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => toggleStatus(item.id, item.status)}
                        className={`p-2 bg-white border rounded shadow-sm transition-colors ${item.status === 'OPEN' ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                        title={item.status === 'OPEN' ? '폼 접속 차단 (마감)' : '폼 접속 허용 (오픈)'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </td>

                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* QR Code Modal */}
        {qrModalUrl && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative">
              <button onClick={() => setQrModalUrl(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">✕</button>
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-indigo-50 rounded-full">
                  <QrCode className="w-8 h-8 text-indigo-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">QR 코드 접속</h2>
              <p className="text-sm text-slate-500 mb-6">아래 QR 코드를 스캔하면 해당 양식으로 이동합니다.</p>
              
              <div className="bg-slate-100 border-2 border-dashed border-slate-300 p-8 rounded-xl flex items-center justify-center mb-6">
                {/* Mock QR Code visualization */}
                <div className="grid grid-cols-6 grid-rows-6 gap-1">
                  {qrPattern.map((filled, i) => (
                    <div key={i} className={`w-4 h-4 ${filled ? 'bg-slate-900' : 'bg-transparent'}`}></div>
                  ))}
                </div>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 break-all">
                <p className="text-xs font-mono text-indigo-600">{qrModalUrl}</p>
              </div>
              
              <button 
                onClick={() => handleCopy(qrModalUrl)}
                className="mt-6 w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
              >
                URL 복사하기
              </button>
            </div>
          </div>
        )}

        {/* API Generation Modal */}
        {apiModalFormId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => { setApiModalFormId(null); setGeneratedApis([]); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">✕</button>
              
              <div className="flex items-center mb-6">
                <div className="p-3 bg-indigo-50 rounded-xl mr-4">
                  <Database className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">외부 연계 API 발급</h2>
                  <p className="text-sm text-slate-500">양식지({apiModalFormId})의 컴포넌트 규격에 맞춰 데이터를 삽입할 수 있는 POST 엔드포인트를 제공합니다.</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center">
                    <Key className="w-4 h-4 mr-2 text-slate-500" /> 생성된 API 엔드포인트
                  </h3>
                  {generatedApis.length === 1 && (
                    <button 
                      onClick={handleGenerateMultipleApis}
                      className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      대용량 분산처리 API 다중 생성
                    </button>
                  )}
                </div>
                
                <div className="space-y-4">
                  {generatedApis.map((api, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 p-4 rounded-lg relative group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded">POST</span>
                        <button onClick={() => handleCopy(api.url)} className="text-slate-400 hover:text-indigo-600"><Copy className="w-4 h-4" /></button>
                      </div>
                      <div className="text-sm font-mono text-slate-800 break-all mb-2">{api.url}</div>
                      <div className="flex items-center text-xs text-slate-500 mt-2 border-t pt-2">
                        <span className="mr-2 font-semibold">API Key:</span>
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded blur-sm hover:blur-none cursor-pointer transition-all">
                          {api.key}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-6 text-slate-300">
                <h4 className="text-white font-bold mb-3 text-sm flex items-center">CURL 요청 예시 (JSON Payload)</h4>
                <pre className="text-xs font-mono overflow-x-auto">
                  {`curl -X POST ${generatedApis[0]?.url || 'https://api.company.com/v1/forms/.../submit'} \\
  -H "Authorization: Bearer ${generatedApis[0]?.key || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "col1": "John Doe",
    "col2": "010-1234-5678"
  }'`}
                </pre>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
