export const metadata = {
  title: '보고서 제출 (게스트) - Web Report Editor',
};

export default function GuestPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full bg-white shadow rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">보고서 제출 (게스트 모드)</h1>
        <p className="text-gray-600 mb-8">
          관리자가 공유한 링크를 통해 접근하셨습니다. 별도의 로그인 없이 아래 양식을 작성하고 제출할 수 있습니다.
        </p>
        
        {/* Placeholder for rendered FormTemplate */}
        <div className="border border-dashed border-gray-300 rounded p-12 text-center text-gray-500 bg-gray-50">
          [여기에 관리자가 설정한 양식(FormTemplate)이 렌더링됩니다]
        </div>

        <div className="mt-8 flex justify-end">
          <button className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            제출하기
          </button>
        </div>
      </div>
    </div>
  );
}
