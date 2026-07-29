'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Link as LinkIcon, QrCode, Power, Eye, Copy, ExternalLink, Settings2, BarChart2, Database, RefreshCw, CalendarRange } from 'lucide-react';
import Link from 'next/link';
import type { AdminUserItem, FormListItem, MeInfo } from '@/lib/apiTypes';

export default function UrlManagerPage() {
  const [urls, setUrls] = useState<FormListItem[]>([]);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [admins, setAdmins] = useState<AdminUserItem[]>([]);
  const [publicBaseUrl, setPublicBaseUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrRegenKey, setQrRegenKey] = useState(0);
  const [settingsFormId, setSettingsFormId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // 최초 마운트 시 loading 초기값이 이미 true이므로 effect 안에서 다시 설정하지 않는다.
    Promise.all([
      fetch('/api/forms').then((res) => res.json()),
      fetch('/api/me').then((res) => (res.ok ? res.json() : null)),
      fetch('/api/admin-users').then((res) => (res.ok ? res.json() : { users: [] })),
      fetch('/api/system-config').then((res) => (res.ok ? res.json() : { config: {} })),
    ])
      .then(([formsJson, meJson, adminsJson, configJson]) => {
        setUrls(formsJson.forms ?? []);
        setMe(meJson);
        setAdmins(adminsJson.users ?? []);
        setPublicBaseUrl(configJson.config?.publicBaseUrl ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const buildFullUrl = (item: FormListItem) => {
    const path = item.deployUrl ?? `/q/${item.id}`;
    const base = publicBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base}${path}`;
  };

  // 실제 스캔 가능한 QR 코드를 캔버스에 그린다 (qrcode 패키지 — 순수 로컬 렌더링,
  // 오프라인/온프레미스 환경에서도 외부 네트워크 호출 없이 동작).
  useEffect(() => {
    if (!qrModalUrl || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrModalUrl, { width: 220, margin: 1 }).catch(() => undefined);
  }, [qrModalUrl, qrRegenKey]);

  const toggleStatus = async (id: string, currentStatus: 'OPEN' | 'CLOSED') => {
    const newStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    const res = await fetch(`/api/forms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.message ?? '상태 변경에 실패했습니다.');
      return;
    }
    setUrls(urls.map(u => u.id === id ? { ...u, status: newStatus } : u));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('클립보드에 복사되었습니다.');
  };

  const settingsForm = urls.find((u) => u.id === settingsFormId) ?? null;
  const canManage = (form: FormListItem) => !!me?.isPlatformAdmin || form.ownerId === me?.id;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-8">
      <div className="max-w-6xl mx-auto w-full">

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <LinkIcon className="w-8 h-8 mr-3 text-indigo-600" />
              배포 URL 및 접속 관리
            </h1>
            <p className="text-slate-500 mt-2">생성된 양식지들의 외부 접속용 URL 리스트를 조회하고, 오픈 상태를 제어합니다.</p>
          </div>
          <Link href="/admin/dashboard" className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            대시보드로 돌아가기
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">양식지 정보</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">배포 URL</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">통계</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">배포 상태</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider text-right">관리</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">불러오는 중...</td>
                  </tr>
                )}
                {!loading && urls.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">등록된 양식이 없습니다.</td>
                  </tr>
                )}
                {urls.map(item => {
                  const fullUrl = buildFullUrl(item);
                  const manageable = canManage(item);
                  return (
                  <tr key={item.id} className={`transition-colors ${item.status === 'CLOSED' ? 'bg-slate-50/50 opacity-75' : 'hover:bg-indigo-50/30'}`}>

                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 mb-1">{item.title}</div>
                      <div className="text-xs text-slate-400">ID: {item.id} | 최종 수정: {item.updatedAt.slice(0, 16).replace('T', ' ')}</div>
                      {item.startsAt || item.expiresAt ? (
                        <div className="text-xs text-indigo-500 mt-0.5">
                          활성 기간: {item.startsAt ? item.startsAt.slice(0, 10) : '제한없음'} ~ {item.expiresAt ? item.expiresAt.slice(0, 10) : '제한없음'}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-indigo-600 underline font-mono truncate max-w-[200px]">{fullUrl}</span>
                        <button onClick={() => handleCopy(fullUrl)} className="text-slate-400 hover:text-indigo-600" title="URL 복사">
                          <Copy className="w-4 h-4" />
                        </button>
                        <a href={fullUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-600" title="새 탭에서 열기">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col text-sm">
                        <span className="text-slate-600 flex items-center mb-1">
                          <Eye className="w-4 h-4 mr-1.5 text-slate-400" /> 조회: {item.viewCount.toLocaleString()}
                        </span>
                        <span className="text-slate-900 font-bold flex items-center">
                          <BarChart2 className="w-4 h-4 mr-1.5 text-indigo-500" /> 제출: {item.submissionCount.toLocaleString()}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {item.status === 'OPEN' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-emerald-700 bg-emerald-50 text-xs font-bold border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span> 서비스 중
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-slate-600 bg-slate-100 text-xs font-bold border border-slate-200">
                          <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5"></span> 마감됨
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        href={`/admin/forms/${item.id}/campaigns`}
                        className="inline-block p-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded shadow-sm transition-colors"
                        title="수집 회차 관리 (반복 수집 / 개인화 링크 발송)"
                      >
                        <CalendarRange className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/admin/forms/${item.id}/api`}
                        className="inline-block p-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded shadow-sm transition-colors"
                        title="외부 연동 API 콘솔 (키 발급 / 계약 / 테스트)"
                      >
                        <Database className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => { setQrModalUrl(fullUrl); setQrRegenKey((k) => k + 1); }}
                        className="p-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded shadow-sm transition-colors"
                        title="QR 코드 생성"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => manageable ? setSettingsFormId(item.id) : alert('이 양식지의 소유자 또는 슈퍼관리자만 설정을 변경할 수 있습니다.')}
                        className={`p-2 bg-white border rounded shadow-sm transition-colors ${manageable ? 'text-slate-500 hover:text-indigo-600 border-slate-200' : 'text-slate-300 border-slate-100 cursor-not-allowed'}`}
                        title="설정"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => manageable ? toggleStatus(item.id, item.status) : alert('이 양식지의 소유자 또는 슈퍼관리자만 상태를 변경할 수 있습니다.')}
                        className={`p-2 bg-white border rounded shadow-sm transition-colors ${!manageable ? 'text-slate-300 border-slate-100 cursor-not-allowed' : item.status === 'OPEN' ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                        title={item.status === 'OPEN' ? '폼 접속 차단 (마감)' : '폼 접속 허용 (오픈)'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </td>

                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* QR Code Modal — 실제 스캔 가능한 QR 코드 (qrcode 패키지, 캔버스 로컬 렌더링) */}
        {qrModalUrl && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative">
              <button onClick={() => setQrModalUrl(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">✕</button>
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-indigo-50 rounded-full">
                  <QrCode className="w-8 h-8 text-indigo-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">QR 코드 접속</h2>
              <p className="text-sm text-slate-500 mb-6">모바일 카메라/QR 스캐너로 스캔하면 해당 양식으로 바로 이동합니다.</p>

              <div className="bg-white border-2 border-dashed border-slate-300 p-4 rounded-xl flex items-center justify-center mb-6">
                <canvas ref={canvasRef} />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 break-all">
                <p className="text-xs font-mono text-indigo-600">{qrModalUrl}</p>
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setQrRegenKey((k) => k + 1)}
                  className="flex-1 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition-colors flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> 재생성
                </button>
                <button
                  onClick={() => handleCopy(qrModalUrl)}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                >
                  URL 복사하기
                </button>
              </div>
              {!publicBaseUrl && (
                <p className="text-xs text-amber-600 mt-4">
                  ⚠ 슈퍼관리자 시스템 환경 설정에 운영 기본 URL이 등록되지 않아, 현재 브라우저 주소를 기준으로 생성되었습니다.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Settings Modal — 편집/활성화 기간/소유권 이전/직접 공유 */}
        {settingsForm && (
          <SettingsModal
            form={settingsForm}
            me={me}
            admins={admins}
            onClose={() => setSettingsFormId(null)}
            onSaved={(updated) => {
              setUrls((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
            }}
          />
        )}

      </div>
    </div>
  );
}

function SettingsModal({
  form,
  me,
  admins,
  onClose,
  onSaved,
}: {
  form: FormListItem;
  me: MeInfo | null;
  admins: AdminUserItem[];
  onClose: () => void;
  onSaved: (updated: FormListItem) => void;
}) {
  const [startsAt, setStartsAt] = useState(form.startsAt ? form.startsAt.slice(0, 10) : '');
  const [expiresAt, setExpiresAt] = useState(form.expiresAt ? form.expiresAt.slice(0, 10) : '');
  const [transferTo, setTransferTo] = useState('');
  const [shareTo, setShareTo] = useState('');
  const [saving, setSaving] = useState(false);
  const isSuperAdmin = !!me?.isPlatformAdmin;

  const handleSavePeriod = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/forms/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      if (!res.ok) {
        alert('활성화 기간 저장에 실패했습니다.');
        return;
      }
      const { form: updated } = await res.json();
      onSaved(updated);
      alert('활성화 기간이 저장되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleTransferOwner = async () => {
    if (!transferTo) return;
    if (!confirm('정말로 이 양식지의 소유권을 이전하시겠습니까?')) return;
    const res = await fetch(`/api/forms/${form.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: transferTo }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.message ?? '소유권 이전에 실패했습니다.');
      return;
    }
    const { form: updated } = await res.json();
    onSaved(updated);
    alert('소유권이 이전되었습니다.');
    onClose();
  };

  const handleDirectShare = async () => {
    if (!shareTo) return;
    const res = await fetch('/api/share-requests/direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formId: form.id, granteeUserId: shareTo }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? '공유에 실패했습니다.');
      return;
    }
    alert('제출 데이터 조회 권한을 부여했습니다.');
    setShareTo('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Settings2 className="w-5 h-5 mr-2 text-indigo-600" />
            양식지 설정 — {form.title}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
            <div>
              <h4 className="font-bold text-slate-800">양식 편집</h4>
              <p className="text-xs text-slate-500 mt-1">필드 구성/제목/설명을 수정합니다.</p>
            </div>
            <Link
              href={`/admin/builder?id=${form.id}`}
              className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 text-sm font-bold rounded shadow-sm hover:bg-indigo-50"
            >
              빌더로 이동
            </Link>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="font-bold text-slate-800 mb-1">기본 배포 URL</h4>
            <p className="text-xs text-slate-500 mb-2 font-mono">{form.deployUrl}</p>
            <p className="text-xs text-amber-600">운영 서버의 기본 URL은 보호되어 이 화면에서 수정/삭제할 수 없습니다.</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <h4 className="font-bold text-slate-800">활성화 기간</h4>
            <p className="text-xs text-slate-500">설정하지 않으면 배포 상태(오픈/마감)에 따라서만 접근이 제어됩니다.</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-500">시작일
                <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full mt-1 p-2 border rounded text-sm" />
              </label>
              <label className="text-xs font-semibold text-slate-500">종료일
                <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full mt-1 p-2 border rounded text-sm" />
              </label>
            </div>
            <button onClick={handleSavePeriod} disabled={saving} className="w-full py-2 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700 disabled:opacity-50">
              {saving ? '저장 중...' : '활성화 기간 저장'}
            </button>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
            <h4 className="font-bold text-emerald-900">다른 관리자에게 제출 데이터 조회 권한 공유</h4>
            <select value={shareTo} onChange={(e) => setShareTo(e.target.value)} className="w-full p-2 border border-emerald-300 rounded text-sm bg-white">
              <option value="">대상 선택...</option>
              {admins.filter((a) => a.id !== form.ownerId).map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
              ))}
            </select>
            <button onClick={handleDirectShare} disabled={!shareTo} className="w-full py-2 bg-emerald-600 text-white text-sm font-bold rounded hover:bg-emerald-700 disabled:opacity-50">
              조회 권한 부여
            </button>
          </div>

          {isSuperAdmin && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-3">
              <h4 className="font-bold text-rose-900">소유권 이전 (슈퍼관리자 전용)</h4>
              <p className="text-xs text-rose-700">현재 소유자: {form.ownerName ?? '없음'}</p>
              <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="w-full p-2 border border-rose-300 rounded text-sm bg-white">
                <option value="">이전 대상 선택...</option>
                {admins.filter((a) => a.id !== form.ownerId).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                ))}
              </select>
              <button onClick={handleTransferOwner} disabled={!transferTo} className="w-full py-2 bg-rose-600 text-white text-sm font-bold rounded hover:bg-rose-700 disabled:opacity-50">
                소유권 이전
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 text-right">
          <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
