'use client';

import { useState } from 'react';
import { Activity, Search, Filter, ShieldAlert, Edit2, FileText, Database } from 'lucide-react';
import Link from 'next/link';

// Mock Audit Logs
const MOCK_AUDIT_LOGS = [
  { id: 'AL-1001', time: '2026-07-27 16:35:12', user: 'admin@company.com', action: 'DATA_UPDATE', target: 'Form [f-101] Data [SUB-004]', details: '수동 재가공 (이상치 연락처 수정)', severity: 'warning' },
  { id: 'AL-1002', time: '2026-07-27 15:20:05', user: 'marketing@company.com', action: 'FORM_UPDATE', target: 'Form [f-101]', details: '필드 속성 변경 (필수값 추가)', severity: 'info' },
  { id: 'AL-1003', time: '2026-07-27 14:10:44', user: 'admin@company.com', action: 'FORM_CREATE', target: 'Form [f-104]', details: '신규 양식지 생성', severity: 'info' },
  { id: 'AL-1004', time: '2026-07-27 11:05:22', user: 'hr@company.com', action: 'DATA_DELETE', target: 'Form [f-102] Data [SUB-111]', details: '제출 데이터 삭제', severity: 'critical' },
  { id: 'AL-1005', time: '2026-07-27 09:30:00', user: 'superadmin@company.com', action: 'LOGIN_MFA', target: 'System', details: '최고 관리자 권한 에스컬레이션 로그인', severity: 'critical' },
];

export default function AuditLogsPage() {
  const [logs] = useState(MOCK_AUDIT_LOGS);

  const getActionIcon = (action: string) => {
    if (action.includes('DATA')) return <Database className="w-4 h-4" />;
    if (action.includes('FORM')) return <FileText className="w-4 h-4" />;
    if (action.includes('LOGIN')) return <ShieldAlert className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  const getSeverityStyle = (severity: string) => {
    switch(severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-8">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Activity className="w-8 h-8 mr-3 text-indigo-600" />
              시스템 행동 로그 (Audit Logs)
            </h1>
            <p className="text-gray-500 mt-2">관리자 및 시스템 사용자의 폼 수정, 데이터 변조 등 모든 활동 기록을 추적합니다.</p>
          </div>
          <Link href="/admin/dashboard" className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            대시보드로 돌아가기
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
            <div className="flex space-x-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input type="text" placeholder="로그 검색 (유저, 액션 등)" className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-600 outline-none bg-white" />
              </div>
              <button className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
                <Filter className="w-4 h-4 mr-2" /> 필터링 옵션
              </button>
            </div>
            <div className="text-sm text-gray-500">
              최근 30일 간의 로그만 표시됩니다.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-24">로그 ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-48">발생 일시</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">사용자 (계정)</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">액션 종류</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">대상(Target)</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-64">상세 내용</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 text-sm">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-mono text-xs">{log.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{log.time}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{log.user}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getSeverityStyle(log.severity)}`}>
                        <span className="mr-1.5">{getActionIcon(log.action)}</span>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 font-medium">{log.target}</td>
                    <td className="px-6 py-4 text-gray-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
