import Link from 'next/link';
import { LayoutDashboard, FileText, TrendingUp, Coins, LogOut } from 'lucide-react';

/**
 * 임직원 전용 레이아웃.
 *
 * 관리자 포털(짙은 좌측 사이드바)과 시각적으로 확실히 구분한다 — 같은 사람이 두 역할을
 * 오갈 수 있으므로, 지금 어느 공간에 있는지 한눈에 보여야 실수가 줄어든다.
 */
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const nav = [
    { href: '/me', label: '홈', icon: LayoutDashboard },
    { href: '/me/responses', label: '내 응답', icon: FileText },
    { href: '/me/points', label: '포인트', icon: Coins },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/me" className="font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              나의 응답 공간
            </Link>
            <nav className="flex items-center gap-1">
              {nav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Icon className="w-4 h-4" /> {label}
                </Link>
              ))}
            </nav>
          </div>
          <Link href="/login" className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <LogOut className="w-4 h-4" /> 로그아웃
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
