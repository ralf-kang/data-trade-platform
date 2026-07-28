import { cookies } from 'next/headers';
import { AdminSidebar } from '@/components/layout/AdminSidebar';

// admin/super-admin 라우트가 이 레이아웃을 공유하므로, 두 워크스페이스 사이를 이동해도
// 사이드바(AdminSidebar)가 언마운트/재마운트되지 않고 그대로 유지된다.
export default async function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value as 'admin' | 'super-admin' | undefined;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar role={role || 'admin'} />
      <div className="flex-1 overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
