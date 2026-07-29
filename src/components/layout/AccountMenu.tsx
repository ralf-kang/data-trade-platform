'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, LogOut, Settings, Shield, User as UserIcon, LayoutDashboard } from 'lucide-react';

interface Me {
  id: string;
  email: string;
  name: string;
  department: string | null;
  position: string | null;
  isPlatformAdmin: boolean;
  roles: string[];
}

/**
 * 계정 메뉴 — 어느 화면에서든 "지금 누구로 로그인했는지 / 어떻게 나가는지"가 보여야 한다.
 *
 * 기존에는 관리자 포털에 로그아웃 수단이 아예 없었고, 임직원 레이아웃의 로그아웃은
 * /login으로 이동만 할 뿐 쿠키를 지우지 않아 실제로는 로그아웃이 아니었다.
 *
 * variant: 관리자 포털(짙은 사이드바)과 임직원 헤더(밝은 배경)의 배색이 반대라 분리한다.
 */
export function AccountMenu({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleSwitchWorkspace = async (workspace: 'admin' | 'super-admin') => {
    const res = await fetch('/api/auth/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace }),
    });
    if (!res.ok) {
      alert('워크스페이스를 전환할 권한이 없습니다.');
      return;
    }
    router.push(workspace === 'super-admin' ? '/super-admin' : '/admin/dashboard');
    router.refresh();
  };

  if (!me) return null;

  const isDark = variant === 'dark';
  const initial = me.name.slice(0, 1).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
          isDark ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <span
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            isDark ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700'
          }`}
        >
          {initial}
        </span>
        <span className="text-sm font-medium max-w-[7rem] truncate">{me.name}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
      </button>

      {open && (
        // 관리자 포털에서는 이 메뉴가 사이드바 맨 아래에 있어 아래로 펼치면 화면 밖으로 나간다.
        <div
          className={`absolute w-64 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 overflow-hidden ${
            isDark ? 'left-0 bottom-full mb-2' : 'right-0 top-full mt-2'
          }`}
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="font-bold text-slate-900 text-sm truncate">{me.name}</div>
            <div className="text-xs text-slate-500 truncate">{me.email}</div>
            {(me.department || me.position) && (
              <div className="text-xs text-slate-400 mt-0.5 truncate">
                {[me.department, me.position].filter(Boolean).join(' · ')}
              </div>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {me.roles.map((r) => (
                <span key={r} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                  {r}
                </span>
              ))}
            </div>
          </div>

          <div className="py-1">
            <Link
              href="/me/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <UserIcon className="w-4 h-4 text-slate-400" /> 내 정보 수정
            </Link>
            <Link
              href="/me"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <LayoutDashboard className="w-4 h-4 text-slate-400" /> 나의 응답 공간
            </Link>
          </div>

          {/* 워크스페이스 전환 — 슈퍼관리자 권한이 실제로 있는 사람에게만 보인다.
              권한 없는 사람에게 메뉴를 띄우면 403만 반복해서 보게 된다. */}
          {me.isPlatformAdmin && (
            <div className="py-1 border-t border-slate-100">
              <div className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                워크스페이스 전환
              </div>
              <button
                onClick={() => handleSwitchWorkspace('admin')}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <LayoutDashboard className="w-4 h-4 text-slate-400" /> 일반 관리자 모드
              </button>
              <button
                onClick={() => handleSwitchWorkspace('super-admin')}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Shield className="w-4 h-4 text-indigo-500" /> 슈퍼관리자 모드
              </button>
              <Link
                href="/super-admin/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Settings className="w-4 h-4 text-slate-400" /> 시스템 환경 설정
              </Link>
            </div>
          )}

          <div className="py-1 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4" /> 로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
