'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle } from 'lucide-react';
import { sectionsForRoute, type ManualAudience } from '@/lib/manual';

/**
 * 화면별 도움말 버튼.
 *
 * 매뉴얼 첫 페이지가 아니라 **지금 보고 있는 화면에 해당하는 항목**으로 바로 보낸다 —
 * 목차에서 다시 찾게 하면 대부분은 그냥 닫아버린다.
 * 해당 화면에 걸린 매뉴얼 항목이 없으면 아무것도 렌더링하지 않는다(빈 도움말 버튼이
 * 있는 것이 없는 것보다 나쁘다).
 */
export default function HelpLink({
  audience = 'admin',
  label = '도움말',
}: {
  audience?: ManualAudience;
  label?: string;
}) {
  const pathname = usePathname() || '';
  const matches = sectionsForRoute(pathname, audience);
  if (matches.length === 0) return null;

  const base = audience === 'admin' ? '/admin/manual' : '/me/manual';
  return (
    <Link
      href={`${base}?s=${matches[0].id}`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shrink-0"
      title={matches[0].summary}
    >
      <HelpCircle className="w-3.5 h-3.5" />
      {label}
    </Link>
  );
}
