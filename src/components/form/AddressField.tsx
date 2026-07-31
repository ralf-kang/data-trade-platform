'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Search, X } from 'lucide-react';
import type { AddressValue } from '@/lib/addressValue';

// 카카오(다음) 우편번호 위젯은 외부 스크립트를 브라우저에서 로드하므로 SSR을 끈다.
// (docs/주소입력-지도분포-설계.md §2-4 — 목적지는 슈퍼관리자 설정의 '외부 연결'에 등재)
const DaumPostcodeEmbed = dynamic(() => import('react-daum-postcode'), { ssr: false });

interface Props {
  fieldId: string;
  label: string;
  required: boolean;
  requireDetail?: boolean;
  defaultValue?: AddressValue;
}

/**
 * 주소 입력 컴포넌트 (`map-address`).
 *
 * 검색 결과로 채워지는 우편번호·도로명·법정동코드는 **읽기 전용**이다 — 사람이 타이핑하지
 * 않으면 오타가 날 수 없고, 표기 흔들림("서울시" vs "서울특별시")이 원천 차단되어 지역
 * 집계가 깨지지 않는다. LDAP 자동 채움과 같은 논리다.
 *
 * 제출은 hidden input에 JSON으로 실어 보낸다 — FormClient가 FormData를 그대로 읽으므로
 * 별도 상태 연동 없이 구조화 값을 넘길 수 있다.
 */
export default function AddressField({ fieldId, label, required, requireDetail, defaultValue }: Props) {
  const [value, setValue] = useState<AddressValue | undefined>(defaultValue);
  const [detail, setDetail] = useState(defaultValue?.detail ?? '');
  const [open, setOpen] = useState(false);

  const merged: AddressValue | undefined = value ? { ...value, detail } : undefined;

  return (
    <div className="space-y-2">
      {/* 서버로 실제 전송되는 값 — 구조화 JSON */}
      <input type="hidden" name={fieldId} value={merged ? JSON.stringify(merged) : ''} />
      {/* 값이 없을 때 required 검증이 걸리도록 하는 보조 입력 */}
      {required && !merged && (
        <input
          tabIndex={-1}
          required
          aria-hidden
          className="sr-only h-0 w-0 border-0 p-0"
          style={{ position: 'absolute', opacity: 0 }}
          onChange={() => undefined}
          value=""
        />
      )}

      <div className="flex gap-2">
        <input
          readOnly
          value={value?.postcode ?? ''}
          placeholder="우편번호"
          className="w-28 p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5 shrink-0"
        >
          <Search className="w-4 h-4" /> 주소 검색
        </button>
      </div>

      <input
        readOnly
        value={value?.roadAddress ?? ''}
        placeholder={`${label} — 검색 버튼으로 선택하세요`}
        className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
      />

      {value?.jibunAddress && (
        <p className="text-xs text-gray-400 pl-1">지번: {value.jibunAddress}</p>
      )}

      <input
        type="text"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        required={required && !!requireDetail}
        placeholder="상세주소 (동/호수 등)"
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
      />

      {value?.sigungu && (
        <p className="text-[11px] text-gray-400 flex items-center gap-1 pl-1">
          <MapPin className="w-3 h-3" />
          {value.sido} {value.sigungu} {value.bname}
          {value.bcode ? ` · 법정동코드 ${value.bcode}` : ''}
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-xl overflow-hidden w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
            // 이 모달은 응답 <form> 안에 렌더링되므로, 주소 검색창에서 Enter를 누르면
            // 바깥 폼이 제출돼 버린다. 다른 필드가 모두 채워진 상태에서는 실제로 조기
            // 제출이 일어나므로 여기서 Enter의 전파를 끊는다.
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.stopPropagation();
            }}
          >
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm">주소 검색</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <DaumPostcodeEmbed
              style={{ height: 460 }}
              onComplete={(data) => {
                setValue({
                  postcode: data.zonecode,
                  roadAddress: data.roadAddress || data.address,
                  jibunAddress: data.jibunAddress || undefined,
                  detail: '',
                  bcode: data.bcode || undefined,
                  sido: data.sido || undefined,
                  sigungu: data.sigungu || undefined,
                  bname: data.bname || undefined,
                });
                setOpen(false);
              }}
            />
            <p className="px-4 py-2 text-[10px] text-gray-400 border-t">
              주소 검색은 외부 서비스(카카오 우편번호)를 이용하며, 입력한 검색어가 해당 서비스로
              전송됩니다. Powered by kakao
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
