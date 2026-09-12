import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ORBIT BREAKER · 오비트 브레이커",
  description:
    "10웨이브 우주 슈팅게임. 5웨이브 중간 보스와 10웨이브 최종 보스에 도전하세요. 같은 키보드의 로컬 2인 협동과 모바일 멀티터치를 지원합니다.",
};

export default function OrbitBreakerPage() {
  return (
    <iframe
      title="ORBIT BREAKER · 오비트 브레이커 우주 슈팅게임"
      src="/play/orbit-breaker/index.html"
      allow="autoplay; fullscreen"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#0a0d0e]"
    />
  );
}
