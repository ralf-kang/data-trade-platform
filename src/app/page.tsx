import Link from 'next/link';
import {
  ArrowRight, BarChart3, CheckCircle2, ClipboardList, FileText, HelpCircle, Lock, LogIn,
  MousePointerClick, QrCode, Send, ShieldCheck, Sparkles, Users,
} from 'lucide-react';

/**
 * 메인(소개) 화면.
 *
 * 처음 오는 사람이 "이게 뭐 하는 곳인지 / 왜 쓰는지 / 나는 어디로 가면 되는지"를 한 화면에서
 * 알 수 있게 구성한다. 온프레미스(외부 인터넷 차단) 환경이라 외부 폰트·이미지·CDN 없이
 * Tailwind와 lucide-react 아이콘만 사용한다.
 */

const STEPS = [
  {
    icon: MousePointerClick,
    title: '양식 만들기',
    desc: '끌어다 놓기만 하면 됩니다. 단답·선택·서명·주소·파일 등 다양한 항목을 코딩 없이 조립하세요.',
  },
  {
    icon: QrCode,
    title: '링크·QR로 배포',
    desc: '완성된 양식은 주소(URL)와 QR 코드가 자동으로 만들어져요. 메일·메신저·게시물로 바로 공유하세요.',
  },
  {
    icon: Send,
    title: '응답 모으기',
    desc: '응답자는 PC·휴대폰 어디서든 링크를 열어 바로 작성합니다. 받은 링크로는 로그인도 필요 없어요.',
  },
  {
    icon: BarChart3,
    title: '결과 확인·보고서',
    desc: '모인 응답은 표·통계·추세·워드클라우드로 자동 정리되고, 엑셀·문서로 내려받을 수 있습니다.',
  },
];

const PURPOSES = [
  {
    icon: Sparkles,
    title: '종이·엑셀 취합을 끝내기 위해',
    desc: '부서마다 따로 돌던 서식과 메일 취합을 하나의 웹 양식으로 모아, 보고서 작성 시간을 줄입니다.',
  },
  {
    icon: ShieldCheck,
    title: '개인정보를 안전하게 다루기 위해',
    desc: '익명 응답, 민감 항목 마스킹, 접근 권한과 감사 기록으로 수집부터 활용까지 안전하게 관리합니다.',
  },
  {
    icon: ClipboardList,
    title: '쌓인 데이터를 다시 쓰기 위해',
    desc: '한 번 모은 데이터는 품질 점검과 부서 간 공유 절차를 거쳐 다음 업무에서도 믿고 활용할 수 있습니다.',
  },
];

const FAQ = [
  {
    q: '응답만 하려는데 로그인해야 하나요?',
    a: '아니요. 받은 응답 링크(또는 QR)를 열면 바로 작성할 수 있습니다. 로그인은 내 응답 이력과 포인트를 보고 싶을 때만 필요해요.',
  },
  {
    q: '양식을 직접 만들고 싶어요.',
    a: '로그인 후 "제작 자격" 메뉴에서 신청하거나 관리자에게 요청하세요. 승인되면 양식 만들기 화면이 열립니다.',
  },
];

export default function Home() {
  return (
    <div className="flex-1 bg-white text-gray-900">
      {/* ── 상단 바 ── */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <span className="p-1.5 bg-indigo-600 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </span>
            Web Report Editor
          </div>
          <Link
            href="/login"
            className="inline-flex items-center px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            로그인
          </Link>
        </div>
      </header>

      {/* ── 히어로 ── */}
      <section className="bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 mb-6 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">
            <Sparkles className="w-3.5 h-3.5" /> 우리 회사 업무 양식·보고서 플랫폼
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-gray-900">
            양식은 쉽게 만들고,
            <br className="sm:hidden" /> <span className="text-indigo-600">보고서는 자동으로.</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-gray-600 leading-relaxed">
            Web Report Editor는 설문·신청서·점검표 같은 업무 양식을 웹으로 만들어 배포하고,
            모인 응답을 보고서로 정리해 주는 서비스입니다.
            <br className="hidden sm:block" />
            복잡한 설치나 교육 없이, <strong className="text-gray-900">클릭 몇 번이면 누구나</strong> 시작할 수 있어요.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-7 py-3.5 text-[15px] font-bold text-white bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-colors"
            >
              <LogIn className="w-5 h-5 mr-2" /> 로그인하고 시작하기
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center px-7 py-3.5 text-[15px] font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              어떻게 쓰나요? <ArrowRight className="w-4 h-4 ml-2" />
            </a>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            응답 링크를 받으셨나요? 링크를 열면 <strong className="text-gray-700">로그인 없이 바로</strong> 작성할 수 있어요.
          </p>
        </div>
      </section>

      {/* ── 취지와 목적 ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">왜 만들었나요?</h2>
          <p className="mt-3 text-gray-600">흩어진 서식과 반복되는 취합 업무를 덜어 드리기 위해서입니다.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {PURPOSES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-indigo-50 mb-4">
                <Icon className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 사용 방법 4단계 ── */}
      <section id="how" className="bg-slate-50 border-y border-slate-100 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">딱 4단계면 충분해요</h2>
            <p className="mt-3 text-gray-600">처음이어도 걱정 마세요. 화면이 순서대로 안내해 드립니다.</p>
          </div>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="relative p-6 rounded-2xl bg-white border border-slate-200">
                <span className="absolute top-5 right-5 text-3xl font-extrabold text-slate-100 select-none">
                  {i + 1}
                </span>
                <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-indigo-600 mb-4">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">
                  <span className="text-indigo-600 mr-1">{i + 1}.</span>
                  {title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 나는 누구? 역할별 안내 ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">어디서부터 시작할까요?</h2>
          <p className="mt-3 text-gray-600">내 상황에 맞는 곳을 골라 주세요.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="flex flex-col p-6 rounded-2xl border border-gray-200">
            <Send className="w-7 h-7 text-emerald-600 mb-4" />
            <h3 className="font-bold text-gray-900 mb-1">응답만 하면 돼요</h3>
            <p className="text-sm text-gray-600 leading-relaxed flex-1">
              메일이나 메신저로 받은 <strong>응답 링크·QR</strong>을 열어 바로 작성하세요. 로그인할 필요가 없습니다.
            </p>
            <p className="mt-5 inline-flex items-center text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> 받은 링크로 바로 시작
            </p>
          </div>
          <div className="flex flex-col p-6 rounded-2xl border border-gray-200">
            <Users className="w-7 h-7 text-indigo-600 mb-4" />
            <h3 className="font-bold text-gray-900 mb-1">임직원 · 양식 담당자예요</h3>
            <p className="text-sm text-gray-600 leading-relaxed flex-1">
              내 응답 이력·포인트를 확인하거나, 양식을 만들고 결과를 관리하세요.
            </p>
            <Link href="/login" className="mt-5 inline-flex items-center text-sm font-bold text-indigo-700 hover:text-indigo-900">
              로그인 <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="flex flex-col p-6 rounded-2xl border border-gray-200">
            <Lock className="w-7 h-7 text-slate-700 mb-4" />
            <h3 className="font-bold text-gray-900 mb-1">시스템 관리자예요</h3>
            <p className="text-sm text-gray-600 leading-relaxed flex-1">
              계정·권한, 로그인 연동, 감사 기록 등 플랫폼 전체를 관리합니다.
              등록된 관리자 메일로 받은 <strong>인증번호</strong>로 로그인하세요.
            </p>
            <Link href="/login?tab=super" className="mt-5 inline-flex items-center text-sm font-bold text-slate-800 hover:text-black">
              최고 관리자 로그인 <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 자주 묻는 질문 ── */}
      <section className="bg-slate-50 border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-10">자주 묻는 질문</h2>
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group p-5 rounded-xl bg-white border border-slate-200">
                <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-gray-900">
                  <span className="flex items-center">
                    <HelpCircle className="w-5 h-5 mr-2 text-indigo-500 shrink-0" />
                    {q}
                  </span>
                  <span className="ml-4 text-gray-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 pl-7 text-sm text-gray-600 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>Web Report Editor · 업무 양식·데이터 수집 플랫폼</span>
          <Link href="/legal/database-rights" className="hover:text-gray-600">
            데이터베이스제작자 권리 고지
          </Link>
        </div>
      </footer>
    </div>
  );
}
