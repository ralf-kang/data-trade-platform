export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Super Admin Navigator (Sidebar) */}
      <aside className="w-64 bg-gray-900 text-white flex-shrink-0 flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold tracking-tight text-indigo-400">Super Admin</h2>
          <p className="text-xs text-gray-400 mt-1">Web Report Editor</p>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2">
          <a href="/super-admin" className="block px-4 py-2 rounded bg-indigo-800 text-white font-medium">대시보드 홈</a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-gray-800 text-gray-300">테넌트 관리</a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-gray-800 text-gray-300">계정 관리</a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-gray-800 text-gray-300">B2B 데이터 거래/추출</a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-gray-800 text-gray-300">템플릿 무단 강제 조회</a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-gray-800 text-gray-300">시스템 모니터링</a>
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white">로그아웃</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
