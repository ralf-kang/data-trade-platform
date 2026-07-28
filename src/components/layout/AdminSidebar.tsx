'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  Globe, 
  Users, 
  Activity, 
  ShieldAlert, 
  Shield, 
  CreditCard,
  Settings,
  Database
} from 'lucide-react';

interface AdminSidebarProps {
  role?: 'admin' | 'super-admin';
}

export function AdminSidebar({ role = 'admin' }: AdminSidebarProps) {
  const pathname = usePathname() || '';

  const commonMenus = [
    { name: '대시보드 메인', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: '내 양식 관리', href: '/admin/templates', icon: FileText },
    { name: '배포 URL 관리', href: '/admin/templates/urls', icon: Globe },
    { name: '제출 데이터 조회', href: '/admin/data', icon: Database },
    { name: '공유 신청 및 승인함', href: '/admin/share-requests', icon: Users },
  ];

  const superAdminMenus = [
    { name: '슈퍼 어드민 대시보드', href: '/super-admin', icon: CreditCard },
    { name: '조직 및 관리자 제어', href: '/super-admin/users', icon: ShieldAlert },
    { name: '전체 행동 감사 (Audit)', href: '/admin/audit', icon: Activity },
    { name: '시스템 환경 설정', href: '/super-admin/settings', icon: Settings },
  ];

  const renderLinks = (menus: typeof commonMenus) => {
    return menus.map(menu => {
      const isActive = pathname === menu.href;
      const Icon = menu.icon;
      return (
        <Link 
          key={menu.href} 
          href={menu.href} 
          className={`flex items-center px-6 py-3 transition-colors ${
            isActive 
              ? 'bg-indigo-600 border-l-4 border-indigo-400 text-white font-medium' 
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Icon className="w-5 h-5 mr-3" /> 
          {menu.name}
        </Link>
      );
    });
  };

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex shrink-0 min-h-screen">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-xl font-bold flex items-center">
          <Shield className="w-6 h-6 mr-2 text-indigo-400" />
          Admin Portal
        </h2>
        <p className="text-xs text-slate-400 mt-2">
          {role === 'super-admin' ? '최고 관리자 워크스페이스' : '일반 관리자 워크스페이스'}
        </p>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        
        {role === 'super-admin' && (
          <div className="mb-6">
            <div className="px-6 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Super Admin</div>
            {renderLinks(superAdminMenus)}
          </div>
        )}
        
        <div>
          <div className="px-6 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">General Admin</div>
          {renderLinks(commonMenus)}
        </div>

      </nav>
      <div className="p-4 border-t border-slate-800">
        <Link href="/legal/database-rights" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          데이터베이스제작자 권리 고지
        </Link>
      </div>
    </div>
  );
}
