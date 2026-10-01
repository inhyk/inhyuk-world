import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "뿌요뿌요 타워 · PUYO PUYO TOWER",
  description:
    "타워와 혜성에 도전! 제작자 모드, 무료 스핀·출석·시간 보상과 두 가지 엔딩이 있는 뿌요뿌요 팬 게임.",
};

export default function PuyoPuyoPage() {
  return (
    <iframe
      title="뿌요뿌요 타워 · 뿌요 퍼즐 대전"
      src="/play/puyo-puyo/index.html"
      allow="autoplay; fullscreen; clipboard-write"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#b9a6ff]"
    />
  );
}
