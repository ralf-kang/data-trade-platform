import { Suspense } from 'react';
import ManualBrowser from '@/components/manual/ManualBrowser';

export const metadata = { title: '이용 안내 - Web Report Editor' };

export default async function MemberManualPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">이용 안내</h1>
      <p className="text-slate-500 mb-6 text-sm">
        응답하실 때 알아두면 좋은 내용을 모았습니다.
      </p>
      <Suspense fallback={<div className="text-slate-400 text-sm">불러오는 중...</div>}>
        <ManualBrowser audience="member" initialSectionId={s} />
      </Suspense>
    </div>
  );
}
