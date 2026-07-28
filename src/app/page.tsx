import Link from 'next/link';
import { FileText, Shield } from 'lucide-react';

// 온프레미스(오프라인) 대응 및 실서비스 전환: 기존 create-next-app 보일러플레이트 랜딩
// (vercel.com / nextjs.org 외부 링크 포함)을 제거하고, 자체 진입 안내 화면으로 교체.
export default function Home() {
  return (
    <div className="min-h-screen flex-1 bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-indigo-50 rounded-2xl">
            <FileText className="w-10 h-10 text-indigo-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Web Report Editor</h1>
        <p className="text-gray-500 mb-8">
          동적 양식(폼)을 생성하고 URL·QR로 배포하여 데이터를 수집하는 플랫폼입니다.
        </p>

        <Link
          href="/login"
          className="w-full flex items-center justify-center py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
        >
          <Shield className="w-5 h-5 mr-2" />
          관리자 로그인
        </Link>

        <Link
          href="/legal/database-rights"
          className="block mt-6 text-xs text-gray-400 hover:text-gray-600"
        >
          데이터베이스제작자 권리 고지
        </Link>
      </div>
    </div>
  );
}
