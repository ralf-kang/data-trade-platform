'use client';

import { useEffect, useState } from 'react';
import { Users, Ban, Trash2, Shield, ShieldAlert, CheckCircle2, DownloadCloud } from 'lucide-react';
import Link from 'next/link';
import { hasGlobalRole, type AdminUserItem, type RoleType } from '@/lib/apiTypes';

export default function AdminUsersManagementPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [form, setForm] = useState({ name: '', email: '', department: '', position: '' });
  const [saving, setSaving] = useState(false);
  const [reassignOwnerId, setReassignOwnerId] = useState('');

  useEffect(() => {
    // 최초 마운트 시 loading 초기값이 이미 true이므로 effect 안에서 다시 설정하지 않는다.
    fetch('/api/admin-users')
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((json) => setUsers(json.users ?? []))
      .finally(() => setLoading(false));
  }, []);

  const openEdit = (user: AdminUserItem) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, department: user.department ?? '', position: user.position ?? '' });
    setReassignOwnerId('');
  };

  const patchUser = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin-users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? '수정에 실패했습니다.');
      return null;
    }
    const { user } = await res.json();
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...user } : u)));
    if (editingUser?.id === id) setEditingUser((prev) => (prev ? { ...prev, ...user } : prev));
    return user;
  };

  // 요구사항: "슈퍼관리자는 관리자의 모든 속성을 수정할 수 있어야 함" — 이름/이메일/소속.
  const handleSaveProfile = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await patchUser(editingUser.id, { name: form.name, email: form.email, department: form.department || null, position: form.position || null });
    } finally {
      setSaving(false);
    }
  };

  // 역할은 이제 다중이다. 여기서는 전역 역할 목록을 통째로 교체한다.
  const handleRoleChange = async (user: AdminUserItem) => {
    const isAdmin = hasGlobalRole(user, 'PLATFORM_ADMIN');
    const nextRoles: RoleType[] = isAdmin
      ? ['AUTHOR', 'MEMBER']
      : ['PLATFORM_ADMIN', 'AUTHOR', 'MEMBER'];
    const label = isAdmin ? '일반 관리자로 강등' : '슈퍼관리자로 승격';
    if (!confirm(`[${user.name}] 님을 ${label}하시겠습니까?`)) return;
    await patchUser(user.id, { roles: nextRoles });
  };

  const handleActiveToggle = async (user: AdminUserItem) => {
    await patchUser(user.id, { status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' });
  };

  const handleBulkExportToggle = async (user: AdminUserItem) => {
    await patchUser(user.id, { canBulkExport: !user.canBulkExport });
  };

  const handleDelete = async (user: AdminUserItem) => {
    if (!reassignOwnerId) {
      alert('먼저 양식지 소유권을 위임할 대상을 선택해주세요.');
      return;
    }
    if (!confirm(`[${user.name}] 계정을 삭제하고, 소유한 양식지 ${user._count.formsOwned}건을 선택한 대상에게 위임하시겠습니까?`)) return;

    const res = await fetch(`/api/admin-users/${user.id}?reassignOwnerId=${reassignOwnerId}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? '삭제에 실패했습니다.');
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    setEditingUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-8">
      <div className="max-w-6xl mx-auto w-full">

        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <ShieldAlert className="w-8 h-8 mr-3 text-red-600" />
              조직 관리 (User Management)
            </h1>
            <p className="text-slate-500 mt-2">최고 관리자(Super Admin) 전용 메뉴입니다. 관리자 계정 속성, 권한, 대량 추출 허용 여부를 제어합니다.</p>
          </div>
          <Link href="/super-admin" className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shrink-0 whitespace-nowrap">
            슈퍼 어드민 대시보드
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center">
              <Users className="w-5 h-5 mr-2 text-slate-500" /> 가입된 관리자 목록 ({users.length}명)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">사용자</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">권한 (Role)</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">상태</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">대량 추출</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">불러오는 중...</td></tr>
                )}
                {!loading && users.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">등록된 관리자가 없습니다.</td></tr>
                )}
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg mr-3">
                          {user.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{user.name}</div>
                          <div className="text-sm text-slate-500">{user.email}</div>
                          <div className="text-xs text-slate-400 mt-0.5">양식 {user._count.formsOwned}개 소유 중</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {hasGlobalRole(user, 'PLATFORM_ADMIN') ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
                          <Shield className="w-3 h-3 mr-1" /> PLATFORM_ADMIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold">
                          ADMIN
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {(user.status === 'ACTIVE') ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-emerald-700 bg-emerald-50 text-xs font-bold">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> 정상
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-rose-700 bg-rose-50 text-xs font-bold">
                          <Ban className="w-3 h-3 mr-1" /> 정지됨
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.canBulkExport ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-slate-600 bg-slate-100 text-xs font-bold">허용</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-amber-700 bg-amber-50 text-xs font-bold">
                          <DownloadCloud className="w-3 h-3 mr-1" /> 제한됨
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEdit(user)}
                        className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-sm font-bold transition-colors"
                      >
                        정보 수정
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-indigo-600" />
                사용자 정보 수정
              </h2>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <h4 className="font-bold text-slate-800 text-sm">기본 속성</h4>
                <label className="text-xs font-semibold text-slate-500">이름
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mt-1 p-2 border rounded text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-500">이메일
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full mt-1 p-2 border rounded text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-500">소속(선택)
                  <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full mt-1 p-2 border rounded text-sm" />
                </label>
                <button onClick={handleSaveProfile} disabled={saving} className="mt-2 py-2 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? '저장 중...' : '속성 저장'}
                </button>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-800">계정 권한</h4>
                  <p className="text-xs text-slate-500 mt-1">현재: {hasGlobalRole(editingUser, 'PLATFORM_ADMIN') ? '최고 관리자' : '일반 관리자'}</p>
                </div>
                <button
                  onClick={() => handleRoleChange(editingUser)}
                  className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 text-sm font-bold rounded shadow-sm hover:bg-indigo-50"
                >
                  {hasGlobalRole(editingUser, 'PLATFORM_ADMIN') ? '일반 관리자로 강등' : '슈퍼관리자로 승급'}
                </button>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-amber-900">계정 상태 (제재)</h4>
                  <p className="text-xs text-amber-700 mt-1">현재: {(editingUser.status === 'ACTIVE') ? '정상 활동 중' : '정지됨'}</p>
                </div>
                <button
                  onClick={() => handleActiveToggle(editingUser)}
                  className={`px-3 py-1.5 bg-white border text-sm font-bold rounded shadow-sm ${(editingUser.status === 'ACTIVE') ? 'border-amber-300 text-amber-600 hover:bg-amber-100' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-100'}`}
                >
                  {(editingUser.status === 'ACTIVE') ? '계정 정지하기' : '정지 해제하기'}
                </button>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-blue-900">대량 추출(CSV) 제약</h4>
                  <p className="text-xs text-blue-700 mt-1">개인정보 무단 대량 추출 방지 — 현재: {editingUser.canBulkExport ? '허용' : '제한됨'}</p>
                </div>
                <button
                  onClick={() => handleBulkExportToggle(editingUser)}
                  className="px-3 py-1.5 bg-white border border-blue-300 text-blue-600 text-sm font-bold rounded shadow-sm hover:bg-blue-100"
                >
                  {editingUser.canBulkExport ? '제한하기' : '허용하기'}
                </button>
              </div>

              {!hasGlobalRole(editingUser, 'PLATFORM_ADMIN') && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-3">
                  <div>
                    <h4 className="font-bold text-rose-900">계정 삭제</h4>
                    <p className="text-xs text-rose-700 mt-1">
                      소유 중인 양식지 {editingUser._count.formsOwned}건을 아래 대상에게 위임한 뒤 삭제됩니다.
                    </p>
                  </div>
                  <select
                    value={reassignOwnerId}
                    onChange={(e) => setReassignOwnerId(e.target.value)}
                    className="w-full p-2 border border-rose-300 rounded text-sm bg-white"
                  >
                    <option value="">양식지 위임 대상 선택...</option>
                    {users.filter((u) => u.id !== editingUser.id).map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email}){hasGlobalRole(u, 'PLATFORM_ADMIN') ? ' — 슈퍼관리자 귀속' : ''}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDelete(editingUser)}
                    className="w-full px-3 py-1.5 bg-white border border-rose-300 text-rose-600 text-sm font-bold rounded shadow-sm hover:bg-rose-100 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> 계정 삭제 및 소유권 위임
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 text-right">
              <button
                onClick={() => setEditingUser(null)}
                className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
