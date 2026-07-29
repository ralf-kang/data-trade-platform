'use client';

import { useEffect, useState } from 'react';
import { UserCog, Save, CheckCircle2, Info } from 'lucide-react';

interface Me {
  id: string;
  email: string;
  name: string;
  department: string | null;
  position: string | null;
  employeeNo: string | null;
  source: 'LOCAL' | 'LDAP';
  roles: string[];
}

const ROLE_LABEL: Record<string, string> = {
  MEMBER: '임직원',
  AUTHOR: '양식 제작자',
  PLATFORM_ADMIN: '슈퍼관리자',
};

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Me | null) => {
        if (!j) return;
        setMe(j);
        setName(j.name);
        setDepartment(j.department ?? '');
        setPosition(j.position ?? '');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, department, position }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.message ?? '저장에 실패했습니다.');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-400 text-sm">불러오는 중...</div>;
  if (!me) return <div className="text-slate-500 text-sm">정보를 불러오지 못했습니다.</div>;

  const isLdap = me.source === 'LDAP';

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <UserCog className="w-6 h-6 text-indigo-600" /> 내 정보
        </h1>
      </div>

      {isLdap && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          인사시스템(LDAP)에서 동기화되는 계정입니다. 이름·부서는 인사시스템에서 변경해야 하며,
          여기서 수정하면 다음 동기화 때 되돌아갑니다.
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">이메일</label>
          <input
            type="text"
            value={me.email}
            readOnly
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 outline-none text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">
            계정 식별자이자 감사 로그의 기록 주체라 변경할 수 없습니다.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLdap}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">부서</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={isLdap}
              placeholder="예: 개발1팀"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">직위</label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              disabled={isLdap}
              placeholder="예: 선임연구원"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">보유 권한</label>
          <div className="flex flex-wrap gap-2">
            {me.roles.map((r) => (
              <span key={r} className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {ROLE_LABEL[r] ?? r}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            권한 변경은 슈퍼관리자만 할 수 있습니다. 양식 제작 자격은 <strong>제작 자격</strong> 메뉴에서 신청하세요.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || isLdap}
            className="flex items-center px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saved ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? '저장 중...' : saved ? '저장됨' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
