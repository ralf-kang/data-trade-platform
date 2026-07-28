import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 이미지에 node_modules 전체를 담지 않고, 실행에 필요한 파일만 추려
  // .next/standalone 으로 뽑아내기 위한 옵션 (WAS 컨테이너 이미지 경량화).
  output: "standalone",
};

export default nextConfig;
