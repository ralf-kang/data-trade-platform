import { cookies } from 'next/headers';
import { AdminSidebar } from '@/components/layout/AdminSidebar';

export default async function AdminLayout({
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
