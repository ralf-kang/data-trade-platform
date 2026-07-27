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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    alert(`${inviteEmail} 주소로 하위 관리자 초대 링크가 발송되었습니다.`);
    setInviteEmail('');
  };

  const handleStatusToggle = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setUsers(users.map(u => u.id === id ? { ...u, status: newStatus } : u));
    alert(`계정 상태가 [${newStatus}]로 변경되었습니다.`);
  };

  const handleDelete = (id: string, role: string) => {
    if (role === 'SUPER_ADMIN') {
      alert('최고 관리자 계정은 삭제할 수 없습니다.');
      return;
    }
    if (confirm('해당 관리자 계정을 완전히 삭제하시겠습니까?\n생성된 양식지 소유권 이전이 필요할 수 있습니다.')) {
      setUsers(users.filter(u => u.id !== id));
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
                        <td className="px-6 py-4 text-right space-x-3">
                          <button 
                            onClick={() => handleStatusToggle(user.id, user.status)}
                            disabled={user.role === 'SUPER_ADMIN'}
                            className={`text-sm font-medium ${user.status === 'ACTIVE' ? 'text-amber-600 hover:text-amber-800' : 'text-emerald-600 hover:text-emerald-800'} disabled:opacity-30`}
                          >
                            {user.status === 'ACTIVE' ? '계정 정지' : '정지 해제'}
                          </button>
                          <button 
                            onClick={() => handleDelete(user.id, user.role)}
                            disabled={user.role === 'SUPER_ADMIN'}
                            className="text-sm font-medium text-rose-600 hover:text-rose-800 disabled:opacity-30"
                          >
                            삭제
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
    </div>
  );
}
