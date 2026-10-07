import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "뿌요뿌요 타워 · PUYO PUYO TOWER",
  description:
    "같은 색 뿌요 4개를 이어 터뜨리는 퍼즐 게임. 연습하기, 타워와 혜성 너머 노바, 2인용 맵 6개, 챌린지 151개.",
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
