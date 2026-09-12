import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VALORANT // PROTOCOL · 전술 슈팅",
  description:
    "발로란트 스타일의 1인칭 3D 팬 게임. AI 수비팀과 3선승제 전투, 헤드샷, 대시, 연막, 스파이크 설치를 브라우저에서 즐기세요.",
};

export default function ValorantPage() {
  return (
    <iframe
      title="VALORANT // PROTOCOL · 1인칭 전술 슈팅 팬 게임"
      src="/play/valorant/index.html"
      allow="autoplay; fullscreen"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#101b27]"
    />
  );
}
