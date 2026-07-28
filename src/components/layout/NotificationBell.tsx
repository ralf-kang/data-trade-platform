'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import type { NotificationItem } from '@/lib/apiTypes';

// 요구사항: "관리자는 관련 이상치 데이터에 대해서 보고/알림을 받을 수 있어야 함."
// 제출 데이터 이상치(DATA_ANOMALY) 등 AdminNotification을 폴링해 뱃지/드롭다운으로 보여준다.
export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = () => {
    fetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : { notifications: [] }))
      .then((json) => setItems(json.notifications ?? []))
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unreadCount = items.filter((i) => !i.read).length;

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        title="알림"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-bold text-gray-900 text-sm">알림</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-indigo-600 hover:underline">모두 읽음 처리</button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">알림이 없습니다.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((n) => (
                <li
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`p-3 text-sm cursor-pointer ${n.read ? 'bg-white text-gray-400' : 'bg-amber-50 text-gray-800 hover:bg-amber-100'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span>{n.message}</span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1" />}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{n.createdAt.slice(0, 16).replace('T', ' ')}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
