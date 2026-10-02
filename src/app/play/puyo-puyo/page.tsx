import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "뿌요뿌요 타워 · PUYO PUYO TOWER",
  description:
    "혜성 너머 새 보스 노바, 2인용 맵 6개, 챌린지 151개와 새 스킨·터짐 효과가 있는 뿌요뿌요 팬 게임.",
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
