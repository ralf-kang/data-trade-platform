import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { resolveRespondent, satisfiesIdentityMode } from '@/lib/respondent';
import FormClient from './FormClient';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * 공개 응답 페이지 — 서버 컴포넌트에서 응답자 신원을 먼저 확정한다.
 *
 * 개인화 링크(?t=...)로 들어오면 토큰을 응답 세션 쿠키로 교환한 뒤,
 * **쿼리스트링 없는 URL로 리다이렉트**한다. 토큰이 URL에 남아 있으면
 * 브라우저 히스토리·Referer 헤더·웹서버 액세스 로그에 그대로 기록되어,
 * 그 로그를 볼 수 있는 사람이 타인의 응답 링크를 그대로 사용할 수 있다.
 */
export default async function PublicFormPage({ params, searchParams }: Props) {
  const { id: formId } = await params;
  const sp = await searchParams;

  // 구 형식 링크(/q/{id}?t=...) 호환 — 교환 전용 경로로 넘긴다.
  // 쿠키는 Route Handler에서만 심을 수 있으므로 여기서 직접 처리하지 않는다.
  const rawToken = typeof sp.t === 'string' ? sp.t : undefined;
  if (rawToken) {
    redirect(`/q/${formId}/enter?t=${encodeURIComponent(rawToken)}`);
  }

  const identity = await resolveRespondent(formId);
  const registry = await prisma.formRegistry.findUnique({
    where: { id: formId },
    select: { identityMode: true },
  });

  // 신원 요건 미충족 — 이 양식은 개인화 링크(또는 로그인)로만 응답할 수 있다.
  if (registry && !satisfiesIdentityMode(registry.identityMode, identity)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">개인화 링크가 필요합니다</h1>
          <p className="text-gray-600 text-sm">
            {registry.identityMode === 'AUTHENTICATED'
              ? '이 양식은 로그인 후 응답할 수 있습니다.'
              : '이 양식은 담당자가 발급한 개인화 링크로만 응답할 수 있습니다. 링크가 만료되었다면 재발급을 요청해 주세요.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <FormClient
      formId={formId}
      identified={identity.level !== 'ANONYMOUS'}
      respondentName={identity.user?.name ?? null}
    />
  );
}
