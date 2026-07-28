'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { DatabaseRightsInfo } from '@/lib/apiTypes';

export default function DatabaseRightsNoticePage() {
  const [info, setInfo] = useState<DatabaseRightsInfo | null | undefined>(undefined);

  useEffect(() => {
    fetch('/api/database-registration')
      .then((res) => (res.ok ? res.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="flex items-center mb-6 pb-6 border-b border-gray-200">
          <ShieldAlert className="w-8 h-8 mr-3 text-indigo-600 shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">데이터베이스제작자 권리 고지</h1>
            <p className="text-sm text-gray-500 mt-1">저작권법 제4장(제91조~제98조) 데이터베이스제작자의 보호</p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
          <p>
            본 웹서비스가 제공하는 양식(폼) 필드 구성 및 수집된 제출 데이터의 집합은
            「저작권법」 제2조 제19호의 데이터베이스에 해당하며, 아래 제작자는 그 소재의
            제작·갱신·검증·보충에 인적·물적으로 상당한 투자를 한 <strong>데이터베이스제작자</strong>
            (같은 조 제20호)로서 저작권법 제93조에 따른 권리를 보유합니다.
          </p>

          {info === undefined && <p className="text-gray-400">불러오는 중...</p>}
          {info === null && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
              등록된 데이터베이스제작자 정보가 없습니다. 관리자에게 문의해주세요.
            </p>
          )}

          {info && (
            <>
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden not-prose">
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3 bg-gray-50 font-semibold text-gray-600 w-48">데이터베이스제작자</td>
                    <td className="px-4 py-3 text-gray-900">{info.producerName}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 bg-gray-50 font-semibold text-gray-600">제작 완료일</td>
                    <td className="px-4 py-3 text-gray-900">{info.completedAt.slice(0, 10)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 bg-gray-50 font-semibold text-gray-600">최근 상당한 투자 갱신일</td>
                    <td className="px-4 py-3 text-gray-900">{info.lastSubstantialUpdate.slice(0, 10)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 bg-gray-50 font-semibold text-gray-600">투자 내역</td>
                    <td className="px-4 py-3 text-gray-900">{info.investmentDescription}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 bg-gray-50 font-semibold text-gray-600">보호기간 만료 예정일</td>
                    <td className="px-4 py-3 text-gray-900 font-bold">
                      {info.protectionExpiresAt.slice(0, 10)}
                      <span className="ml-2 font-normal text-gray-500 text-xs">
                        (제95조: 갱신일로부터 5년, 상당한 투자에 의한 갱신 시 그 부분에 한해 갱신일부터 재기산)
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <h2 className="text-base font-bold text-gray-900 pt-2">금지 행위 (저작권법 제93조)</h2>
              <p>
                누구든지 데이터베이스제작자의 동의 없이 데이터베이스의 전부 또는 상당한
                부분을 복제·배포·방송 또는 전송할 수 없습니다. 데이터베이스의 개별 소재는
                통상 상당한 부분으로 간주되지 않으나, <strong>반복적이거나 특정한 목적을
                위하여 체계적으로</strong> 소재의 상당한 부분에 준하는 부분을 복제 등 하는
                행위 또한 상당한 부분의 복제 등으로 간주되어 금지됩니다. 본 서비스는 이를
                억제하기 위해 관리자 인증, 요청 빈도 제한, 대량 추출 감사 로그 등의 기술적
                보호조치를 적용하고 있습니다.
              </p>

              {info.recentUpdates.length > 0 && (
                <>
                  <h2 className="text-base font-bold text-gray-900 pt-2">최근 갱신 이력</h2>
                  <ul className="not-prose divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden text-sm">
                    {info.recentUpdates.map((u, idx) => (
                      <li key={idx} className="px-4 py-3 flex justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{u.scope}</div>
                          <div className="text-gray-500">{u.description}</div>
                        </div>
                        <div className="text-right text-gray-400 shrink-0 ml-4">
                          <div>{u.occurredAt.slice(0, 10)}</div>
                          <div>{u.performedBy}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
