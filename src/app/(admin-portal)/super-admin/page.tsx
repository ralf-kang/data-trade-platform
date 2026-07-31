export const metadata = {
  title: '최고관리자 대시보드 - Web Report Editor',
};

export default function SuperAdminPage() {
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
            <h3 className="text-lg font-semibold text-gray-700">전체 테넌트</h3>
            <p className="text-4xl font-bold text-indigo-600 mt-2">12</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700">활성 관리자 (Admin)</h3>
            <p className="text-4xl font-bold text-blue-600 mt-2">45</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700">누적 폼 제출 건수</h3>
            <p className="text-4xl font-bold text-green-600 mt-2">1,284</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-amber-200 bg-amber-50">
            <h3 className="text-lg font-semibold text-amber-900">데이터 패키징(추출) 대기</h3>
            <p className="text-4xl font-bold text-amber-600 mt-2">3건</p>
          </div>
        </div>

        {/* Data Trading CRM Section */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">데이터 거래 및 B2B 통계 (CRM)</h2>
            <span className="text-sm font-medium text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full">Super Admin Only</span>
          </div>
          <div className="p-6">
            <p className="text-gray-600 mb-6">각 테넌트(기관)에서 수집된 방대한 데이터를 취합하여 패키징하고, 타 기관에 제공/판매(API 또는 다운로드)하기 위한 관제 대시보드입니다.</p>
            
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
