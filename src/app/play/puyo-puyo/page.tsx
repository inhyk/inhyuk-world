import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "뿌요뿌요 타워 · PUYO PUYO TOWER",
  description:
    "작은 뿌요부터 왕관까지 AI를 이기며 타워를 올라가는 뿌요뿌요. 2인·온라인 대전, 로그인, 레벨, 챌린지, 상점, 엔딩을 지원합니다.",
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
