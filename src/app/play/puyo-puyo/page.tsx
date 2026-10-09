import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "뿌요뿌요 타워 · PUYO PUYO TOWER",
  description:
    "같은 색 뿌요 4개를 이어 터뜨리는 퍼즐 게임. 초급부터 졸업10까지 17단계 831가지 배우기와 이어 하기, 스킨 45종, 챌린지 251개.",
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
