'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// 제출 데이터 뷰어의 "워드클라우드" 바로가기 — 실제 화면은 /admin/wordcloud
// 하나로 통합되어 있고(§4-1), 여기서는 이 양식지가 미리 선택된 채로 넘겨준다.
export default function WordCloudShortcutRedirect() {
  const params = useParams();
  const router = useRouter();
  const formId = (params?.formId as string) || '';

  useEffect(() => {
    if (!formId) return;
    router.replace(`/admin/wordcloud?formId=${encodeURIComponent(formId)}`);
  }, [formId, router]);

  return <div className="p-8 text-slate-400 text-sm">이동 중...</div>;
}
