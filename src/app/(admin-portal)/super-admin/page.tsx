import { getDashboardStats } from '@/lib/services/dashboardStatsService';
import { prisma } from '@/lib/db';

export const metadata = {
  title: '최고관리자 대시보드 - Web Report Editor',
};

export default async function SuperAdminPage() {
  // 하드코딩된 표본 숫자 대신 실제 집계를 쓴다 — 대시보드에 가짜 숫자가 섞이면
  // 나머지 진짜 숫자까지 신뢰할 수 없게 된다.
  const [stats, activeAdmins] = await Promise.all([
    getDashboardStats(null),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
  ]);
  const pendingTotal =
    stats.actionItems.pendingShareRequests +
    stats.actionItems.pendingCorrections +
    stats.actionItems.pendingApprovals +
    stats.actionItems.pendingAuthorAuths;

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">최고관리자 (Super Admin) 대시보드</h1>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium">
            신규 테넌트(조직) 생성
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700">전체 양식지</h3>
            <p className="text-4xl font-bold text-indigo-600 mt-2">{stats.formCount}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700">활성 계정</h3>
            <p className="text-4xl font-bold text-blue-600 mt-2">{activeAdmins}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700">누적 폼 제출 건수</h3>
            <p className="text-4xl font-bold text-green-600 mt-2">{stats.submissionTotal.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-amber-200 bg-amber-50">
            <h3 className="text-lg font-semibold text-amber-900">조치 필요</h3>
            <p className="text-4xl font-bold text-amber-600 mt-2">{pendingTotal}건</p>
          </div>
        </div>

        {/* Data Trading CRM Section */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">데이터 거래 및 B2B 통계 (CRM)</h2>
            <span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">미구현 — 화면 예시</span>
          </div>
          <div className="p-6">
            <p className="text-gray-600 mb-2">각 부서(테넌트)에서 수집된 데이터를 취합·패키징해 타 기관에 제공하기 위한 관제 화면입니다.</p>
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <strong>아래는 아직 구현되지 않은 화면 예시입니다.</strong> 표시된 수치와 버튼은 실제 데이터·동작과
              연결되어 있지 않습니다. 설계는 <code className="font-mono text-xs">docs/테넌트-데이터거래-설계.md</code>에 있습니다.
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tenant A Box */}
              <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-2">
                  <h4 className="font-bold text-gray-900 text-lg">영업본부 - 2026 하반기 마케팅 설문조사</h4>
                  <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded">Live Data</span>
                </div>
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-600">누적 수집 데이터: <span className="font-bold text-gray-900">850건</span></p>
                  <p className="text-sm text-gray-600">최근 업데이트: <span className="font-bold text-gray-900">방금 전 (2026-07-27 15:42)</span></p>
                  <p className="text-sm text-gray-600">제공된 API (외부 연동): <span className="font-bold text-blue-600">1건 (Client: 외부 파트너사 A)</span></p>
                </div>
                
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                  <button className="text-sm bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 font-medium">패키징 생성 (JSON)</button>
                  <button className="text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 font-medium">B2B 거래용 엑셀 추출</button>
                  <button className="text-sm border border-red-200 text-red-600 bg-red-50 px-4 py-2 rounded hover:bg-red-100 font-medium ml-auto">외부 API 키 폐기</button>
                </div>
              </div>

              {/* Tenant B Box */}
              <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-2">
                  <h4 className="font-bold text-gray-900 text-lg">인사팀 - 사내 복지 수요조사</h4>
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">Closed</span>
                </div>
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-600">누적 수집 데이터: <span className="font-bold text-gray-900">1,204건</span></p>
                  <p className="text-sm text-gray-600">최근 업데이트: <span className="font-bold text-gray-900">3일 전</span></p>
                  <p className="text-sm text-gray-600">제공된 API (외부 연동): <span className="text-gray-400">없음</span></p>
                </div>
                
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                  <button className="text-sm bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 font-medium opacity-50 cursor-not-allowed">패키징 생성 (JSON)</button>
                  <button className="text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 font-medium">B2B 거래용 엑셀 추출</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-800">테넌트 및 관리자 계정 목록</h2>
          </div>
          <div className="p-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">조직 (Tenant)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">관리자 이메일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">생성일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">영업본부</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">sales_admin@example.com</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">2026-07-27</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">활성</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-indigo-600 hover:text-indigo-900 mr-4 border border-indigo-200 px-2 py-1 rounded">양식 무단 복제(데이터 포함)</button>
                    <a href="#" className="text-gray-600 hover:text-gray-900">권한 수정</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
