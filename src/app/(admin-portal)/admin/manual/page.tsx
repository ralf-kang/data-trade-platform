import { Suspense } from 'react';
import ManualBrowser from '@/components/manual/ManualBrowser';

export const metadata = { title: '사용 매뉴얼 - Web Report Editor' };

export default async function AdminManualPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">사용 매뉴얼</h1>
        <p className="text-slate-500 mb-6">
          기능이 왜 그렇게 동작하는지까지 함께 설명합니다. 각 화면의 도움말 버튼을 누르면 해당 항목으로 바로 이동합니다.
        </p>
        <Suspense fallback={<div className="text-slate-400 text-sm">불러오는 중...</div>}>
          <ManualBrowser audience="admin" initialSectionId={s} />
        </Suspense>
      </div>
    </div>
  );
}
