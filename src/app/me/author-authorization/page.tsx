'use client';

import { useEffect, useState } from 'react';
import {
  ShieldCheck, ArrowLeft, Clock, CheckCircle2, AlertTriangle, Ban, Send,
} from 'lucide-react';
import Link from 'next/link';

interface Authorization {
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
  purpose: string;
  plannedDataItems: string;
  trainingValidUntil: string | null;
  reauthorizeBy: string | null;
  reviewedBy: string | null;
  revokedReason: string | null;
  requestedAt: string;
}

const STATUS_COPY: Record<Authorization['status'], { title: string; tone: string; desc: string }> = {
  PENDING: {
    title: '심사 대기 중입니다',
    tone: 'bg-amber-50 border-amber-200 text-amber-900',
    desc: '슈퍼관리자가 목적과 수집 예정 항목을 검토한 뒤 승인 여부를 결정합니다.',
  },
  APPROVED: {
    title: '개인정보 취급자로 승인되었습니다',
    tone: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    desc: '이제 양식 빌더에서 개인정보 동의서 컴포넌트를 사용할 수 있습니다.',
  },
  SUSPENDED: {
    title: '교육 유효기간이 지나 자격이 일시 정지되었습니다',
    tone: 'bg-orange-50 border-orange-200 text-orange-900',
    desc: '신규 제작·배포는 제한되지만, 기존에 만든 양식지의 데이터 조회는 계속 가능합니다. 재교육 절차는 관리자에게 문의해주세요.',
  },
  EXPIRED: {
    title: '재승인 주기가 지났습니다',
    tone: 'bg-slate-100 border-slate-200 text-slate-700',
    desc: '자격을 계속 유지하려면 다시 신청해주세요.',
  },
  REVOKED: {
    title: '자격이 해제되었습니다',
    tone: 'bg-rose-50 border-rose-200 text-rose-900',
    desc: '필요하다면 다시 신청할 수 있습니다.',
  },
};

export default function AuthorAuthorizationApplyPage() {
  const [auth, setAuth] = useState<Authorization | null>(null);
  const [loading, setLoading] = useState(true);
  const [purpose, setPurpose] = useState('');
  const [plannedDataItems, setPlannedDataItems] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    fetch('/api/me/author-authorization')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setAuth(json?.authorization ?? null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!purpose.trim() || !plannedDataItems.trim()) {
      alert('수집 목적과 수집 예정 항목을 모두 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/me/author-authorization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, plannedDataItems }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { alert(json.message ?? '신청에 실패했습니다.'); return; }
      setPurpose('');
      setPlannedDataItems('');
      load();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;

  // 재신청은 REVOKED/EXPIRED 상태에서만 허용된다(서버와 동일한 규칙) —
  // SUSPENDED는 새 신청이 아니라 재교육으로 해결해야 하는 상태이기 때문이다.
  const canReapply = !auth || auth.status === 'REVOKED' || auth.status === 'EXPIRED';

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/me" className="text-sm text-slate-400 hover:text-slate-600 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> 홈으로
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600" /> 제작 자격 (개인정보 취급자 지정)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          양식지를 만들려면 별도 심사를 거쳐야 합니다. 제작자는 수집 항목을 정하고 응답
          데이터를 열람할 수 있어 사실상 개인정보 취급자가 되기 때문입니다.
          전 임직원이 신청할 수 있지만, 승인 전까지는 기본 자격이 없습니다.
        </p>
      </div>

      {auth && (
        <div className={`p-4 rounded-xl border ${STATUS_COPY[auth.status].tone}`}>
          <h2 className="font-bold flex items-center gap-2">
            {auth.status === 'APPROVED' && <CheckCircle2 className="w-4 h-4" />}
            {auth.status === 'PENDING' && <Clock className="w-4 h-4" />}
            {(auth.status === 'SUSPENDED' || auth.status === 'EXPIRED') && <AlertTriangle className="w-4 h-4" />}
            {auth.status === 'REVOKED' && <Ban className="w-4 h-4" />}
            {STATUS_COPY[auth.status].title}
          </h2>
          <p className="text-sm mt-1">{STATUS_COPY[auth.status].desc}</p>

          <div className="mt-3 text-xs space-y-1 opacity-80">
            <div>신청 목적: {auth.purpose}</div>
            <div>수집 예정 항목: {auth.plannedDataItems}</div>
            {auth.trainingValidUntil && <div>교육 유효기간: {auth.trainingValidUntil.slice(0, 10)}까지</div>}
            {auth.reauthorizeBy && <div>재승인 필요 시점: {auth.reauthorizeBy.slice(0, 10)}</div>}
            {auth.status === 'REVOKED' && auth.revokedReason && <div>해제 사유: {auth.revokedReason}</div>}
          </div>
        </div>
      )}

      {canReapply && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-bold text-slate-800">{auth ? '다시 신청하기' : '신청하기'}</h3>
          <label className="block text-sm">
            <span className="font-semibold text-slate-700">수집 목적</span>
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="예: 부서 만족도 정기 조사"
              className="w-full mt-1 p-2 border rounded text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-700">수집 예정 항목</span>
            <textarea
              value={plannedDataItems}
              onChange={(e) => setPlannedDataItems(e.target.value)}
              placeholder="예: 이름, 부서, 만족도 점수, 개선 의견"
              rows={3}
              className="w-full mt-1 p-2 border rounded text-sm"
            />
          </label>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500">
            신청서를 제출하면 아래 서약에 동의하는 것으로 간주됩니다: 수집한 개인정보는
            명시한 목적 범위 내에서만 사용하며, 목적 달성 후 보유기간이 지나면 파기합니다.
          </div>
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> {submitting ? '제출 중...' : '신청 제출'}
          </button>
        </div>
      )}
    </div>
  );
}
