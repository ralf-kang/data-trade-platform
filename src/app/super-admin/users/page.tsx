'use client';

import { useState } from 'react';
import { Users, Mail, UserPlus, Ban, Trash2, Shield, ShieldAlert, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

// Mock Admin Users
const MOCK_USERS = [
  { id: 'usr-1', email: 'marketing@company.com', name: '김민수', role: 'ADMIN', status: 'ACTIVE', formsCount: 12, lastLogin: '2026-07-27 15:30' },
  { id: 'usr-2', email: 'hr@company.com', name: '이영희', role: 'ADMIN', status: 'ACTIVE', formsCount: 4, lastLogin: '2026-07-27 09:15' },
  { id: 'usr-3', email: 'sales@company.com', name: '박철수', role: 'ADMIN', status: 'SUSPENDED', formsCount: 2, lastLogin: '2026-07-15 11:20' },
  { id: 'usr-4', email: 'superadmin@company.com', name: '최고관리자', role: 'SUPER_ADMIN', status: 'ACTIVE', formsCount: 45, lastLogin: '2026-07-27 16:30' },
];

export default function AdminUsersManagementPage() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [inviteEmail, setInviteEmail] = useState('');
  const [editingUser, setEditingUser] = useState<typeof MOCK_USERS[0] | null>(null);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    alert(`${inviteEmail} 주소로 하위 관리자 초대 링크가 발송되었습니다.`);
    setInviteEmail('');
  };

  const handleStatusToggle = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setUsers(users.map(u => u.id === id ? { ...u, status: newStatus } : u));
    if (editingUser?.id === id) setEditingUser({ ...editingUser, status: newStatus });
    alert(`계정 상태가 [${newStatus}]로 변경되었습니다.`);
  };

  const handleResetPassword = (id: string, name: string) => {
    if (confirm(`[${name}] 관리자의 비밀번호를 초기화하시겠습니까?\n임시 비밀번호가 해당 이메일로 발송됩니다.`)) {
      alert('비밀번호가 초기화되었습니다.');
    }
  };

  const handleRoleChange = (id: string, currentRole: string, name: string) => {
    if (currentRole === 'SUPER_ADMIN') {
      alert('최고 관리자의 권한은 여기서 변경할 수 없습니다.');
      return;
    }
    if (confirm(`[${name}] 관리자를 최고 관리자(SUPER_ADMIN)로 승급하시겠습니까?`)) {
      setUsers(users.map(u => u.id === id ? { ...u, role: 'SUPER_ADMIN' } : u));
      if (editingUser?.id === id) setEditingUser({ ...editingUser, role: 'SUPER_ADMIN' });
      alert('승급이 완료되었습니다.');
    }
  };

  const handleDelete = (id: string, role: string) => {
    if (role === 'SUPER_ADMIN') {
      alert('최고 관리자 계정은 삭제할 수 없습니다.');
      return;
    }
    if (confirm('해당 관리자 계정을 완전히 삭제하시겠습니까?\n생성된 양식지 소유권 이전이 필요할 수 있습니다.')) {
      setUsers(users.filter(u => u.id !== id));
      setEditingUser(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-8">
      <div className="max-w-6xl mx-auto w-full">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <ShieldAlert className="w-8 h-8 mr-3 text-red-600" />
              조직 관리 (User Management)
            </h1>
            <p className="text-slate-500 mt-2">최고 관리자(Super Admin) 전용 메뉴입니다. 하위 관리자를 초대하고 권한을 제어합니다.</p>
          </div>
          <Link href="/super-admin" className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            슈퍼 어드민 대시보드
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Invite Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-8">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 mr-3">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">새로운 관리자 초대</h2>
              </div>
              <p className="text-sm text-slate-500 mb-6">초대받은 이메일로 가입 링크가 전송되며, 가입 즉시 하위 관리자(Admin) 권한이 부여됩니다.</p>
              
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">이메일 주소</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input 
                      type="email" 
                      required
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="admin@company.com" 
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                  초대 메일 발송
                </button>
              </form>
            </div>
          </div>

          {/* User List */}
          <div className="lg:col-span-2">
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
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase text-right">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
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
                              <div className="text-xs text-slate-400 mt-0.5">양식 {user.formsCount}개 운영 중</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {user.role === 'SUPER_ADMIN' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
                              <Shield className="w-3 h-3 mr-1" /> SUPER_ADMIN
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold">
                              ADMIN
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {user.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-emerald-700 bg-emerald-50 text-xs font-bold">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> 정상 (ACTIVE)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-rose-700 bg-rose-50 text-xs font-bold">
                              <Ban className="w-3 h-3 mr-1" /> 정지됨 (SUSPENDED)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setEditingUser(user)}
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

        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-indigo-600" />
                사용자 정보 수정
              </h2>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center space-x-4 mb-2">
                <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-2xl">
                  {editingUser.name[0]}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{editingUser.name}</h3>
                  <p className="text-slate-500">{editingUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-slate-800">계정 권한</h4>
                    <p className="text-xs text-slate-500 mt-1">현재: {editingUser.role === 'SUPER_ADMIN' ? '최고 관리자' : '일반 관리자'}</p>
                  </div>
                  <button 
                    onClick={() => handleRoleChange(editingUser.id, editingUser.role, editingUser.name)}
                    disabled={editingUser.role === 'SUPER_ADMIN'}
                    className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 text-sm font-bold rounded shadow-sm hover:bg-indigo-50 disabled:opacity-50"
                  >
                    최고 관리자로 승급
                  </button>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-slate-800">보안 설정</h4>
                    <p className="text-xs text-slate-500 mt-1">이메일로 임시 비밀번호를 발송합니다.</p>
                  </div>
                  <button 
                    onClick={() => handleResetPassword(editingUser.id, editingUser.name)}
                    disabled={editingUser.role === 'SUPER_ADMIN'}
                    className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded shadow-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    비밀번호 초기화
                  </button>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-amber-900">계정 상태</h4>
                    <p className="text-xs text-amber-700 mt-1">현재: {editingUser.status === 'ACTIVE' ? '정상 활동 중' : '정지됨'}</p>
                  </div>
                  <button 
                    onClick={() => handleStatusToggle(editingUser.id, editingUser.status)}
                    disabled={editingUser.role === 'SUPER_ADMIN'}
                    className={`px-3 py-1.5 bg-white border text-sm font-bold rounded shadow-sm disabled:opacity-50 ${editingUser.status === 'ACTIVE' ? 'border-amber-300 text-amber-600 hover:bg-amber-100' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-100'}`}
                  >
                    {editingUser.status === 'ACTIVE' ? '계정 정지하기' : '정지 해제하기'}
                  </button>
                </div>

                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-rose-900">계정 삭제</h4>
                    <p className="text-xs text-rose-700 mt-1">모든 데이터와 권한이 영구 삭제됩니다.</p>
                  </div>
                  <button 
                    onClick={() => handleDelete(editingUser.id, editingUser.role)}
                    disabled={editingUser.role === 'SUPER_ADMIN'}
                    className="px-3 py-1.5 bg-white border border-rose-300 text-rose-600 text-sm font-bold rounded shadow-sm hover:bg-rose-100 disabled:opacity-50"
                  >
                    영구 삭제
                  </button>
                </div>
              </div>
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
