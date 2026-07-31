'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, MapPin, Info, EyeOff, ShieldCheck } from 'lucide-react';
import { lookupSidoCoordinate } from '@/lib/sidoCoordinates';
import HelpLink from '@/components/manual/HelpLink';
import type { MapPoint } from '@/components/map/RegionClusterMap';

// Leaflet은 window에 의존하므로 SSR을 끈다.
const RegionClusterMap = dynamic(() => import('@/components/map/RegionClusterMap'), {
  ssr: false,
  loading: () => <div className="h-[520px] flex items-center justify-center text-slate-400 text-sm">지도를 불러오는 중...</div>,
});

interface RegionBucket {
  name: string;
  code: string;
  count: number;
}

interface MapResult {
  fieldId: string;
  label: string;
  totalWithAddress: number;
  regions: RegionBucket[];
  suppressedRegions: number;
  suppressedCount: number;
  threshold: number;
  geocodingEnabled: boolean;
  tileTemplate: string | null;
}

export default function AddressMapPage() {
  const params = useParams();
  const formId = (params?.formId as string) || '';

  const [fields, setFields] = useState<Array<{ fieldId: string; label: string }>>([]);
  const [selected, setSelected] = useState<string>('');
  const [level, setLevel] = useState<'sido' | 'sigungu'>('sido');
  const [result, setResult] = useState<MapResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!formId) return;
    const qs = new URLSearchParams();
    if (selected) qs.set('fieldId', selected);
    qs.set('level', level);
    fetch(`/api/forms/${formId}/address-map?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : { fields: [], result: null }))
      .then((j) => {
        setFields(j.fields ?? []);
        setResult(j.result ?? null);
        if (!selected && j.fields?.[0]) setSelected(j.fields[0].fieldId);
      })
      .finally(() => setLoading(false));
  }, [formId, selected, level]);

  // 시·도 단위일 때만 좌표를 알고 있다(§4-1). 시·군·구 핀은 지오코딩 설정 후 열린다.
  const points: MapPoint[] =
    level === 'sido' && result
      ? result.regions
          .map((r) => {
            const c = lookupSidoCoordinate(r.code);
            return c ? { code: r.code, name: c.name, count: r.count, lat: c.lat, lon: c.lon } : null;
          })
          .filter((p): p is MapPoint => p !== null)
      : [];

  const canShowMap = !!result?.tileTemplate && points.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center sticky top-0 z-[500]">
        <Link href={`/admin/data/${formId}`} className="text-gray-400 hover:text-gray-600 mr-4">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-emerald-600" />
            주소 분포 (Form: {formId})
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            개인이 특정되지 않도록 <strong>응답 {result?.threshold ?? 5}건 미만인 지역은 표시되지 않습니다.</strong>{' '}
            개별 응답 위치는 어떤 확대 수준에서도 표시되지 않습니다.
          </p>
        </div>
        <div className="ml-auto"><HelpLink /></div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-4">
          {loading && <div className="text-slate-400 text-sm">불러오는 중...</div>}

          {!loading && fields.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
              지도 분석 대상 주소 문항이 없습니다.
              <div className="text-xs text-slate-400 mt-2">
                양식 편집기에서 주소 문항의 상세 설정을 열고 <strong>&ldquo;지도 분포 분석 대상으로 사용&rdquo;</strong>을
                켜면 이 화면에 나타납니다. (마스킹 대상 양식지·익명 문항·개인식별자 문항은 제외됩니다)
              </div>
            </div>
          )}

          {!loading && fields.length > 0 && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3 text-sm">
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg"
                >
                  {fields.map((f) => (
                    <option key={f.fieldId} value={f.fieldId}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                  {(['sido', 'sigungu'] as const).map((lv) => (
                    <button
                      key={lv}
                      onClick={() => setLevel(lv)}
                      className={`px-3 py-1.5 text-xs font-medium ${
                        level === lv ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {lv === 'sido' ? '시·도' : '시·군·구'}
                    </button>
                  ))}
                </div>

                {result && (
                  <span className="text-xs text-slate-400 ml-auto">
                    주소가 입력된 응답 {result.totalWithAddress.toLocaleString()}건
                  </span>
                )}
              </div>

              {result && result.suppressedRegions > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                  <EyeOff className="w-4 h-4 mt-0.5 shrink-0" />
                  응답 {result.threshold}건 미만인 지역 {result.suppressedRegions}곳({result.suppressedCount}건)은
                  개인 식별 위험 때문에 표시하지 않았습니다. 데이터가 없는 것이 아니라 가려진 것입니다.
                </div>
              )}

              {canShowMap ? (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <RegionClusterMap points={points} tileTemplate={result!.tileTemplate!} />
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500 flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                  <span>
                    {!result?.tileTemplate
                      ? '지도 타일 연결이 설정되어 있지 않아 지도를 표시할 수 없습니다. 슈퍼관리자 설정의 "외부 연결"에서 지도 타일을 설정하세요.'
                      : level === 'sigungu' && !result.geocodingEnabled
                        ? '시·군·구 단위 핀은 지오코딩 엔드포인트가 설정된 뒤에 열립니다. 아래 표는 지오코딩 없이도 정확합니다.'
                        : '표시할 지역이 없습니다.'}
                  </span>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 text-sm">
                  지역별 응답 수
                </div>
                {result && result.regions.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {result.regions.map((r) => {
                      const max = result.regions[0].count || 1;
                      return (
                        <li key={r.code} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                          <span className="w-40 shrink-0 text-slate-700">{r.name}</span>
                          <div className="flex-1 h-3 bg-slate-100 rounded overflow-hidden">
                            <div className="h-full bg-emerald-400" style={{ width: `${(r.count / max) * 100}%` }} />
                          </div>
                          <span className="w-16 text-right text-slate-500 shrink-0">{r.count.toLocaleString()}건</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    표시할 수 있는 지역이 없습니다 (모두 최소 응답 수 미만이거나 주소 데이터가 없습니다).
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-400 flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  이 화면은 지역 단위 집계만 보여줍니다. 개별 응답의 주소·상세주소(동/호수)는 지도와
                  집계 어디에도 사용되지 않으며, 조회 이력은 감사 로그에 기록됩니다.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
