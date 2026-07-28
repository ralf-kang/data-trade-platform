import type { Metadata } from "next";
import "./globals.css";

// 온프레미스(외부 인터넷 차단) 환경 대응: `next/font/google`은 빌드 시점에 Google Fonts
// 서버에서 폰트 파일을 내려받으므로, 망분리된 곳에서 이미지를 빌드하면 실패한다.
// 대신 OS에 이미 존재하는 시스템 폰트 스택을 사용해 외부 의존성을 제거한다
// (한글 폰트도 macOS/Windows/Linux 기본 폰트로 커버).
export const metadata: Metadata = {
  title: "Web Report Editor",
  description: "동적 양식 빌더 및 데이터 수집 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
