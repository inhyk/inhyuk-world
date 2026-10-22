import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "인혁 노래방 · 인혁 월드로 와!",
  description: "인혁 월드 주제가를 노래방처럼 불러 보세요. 반주와 멜로디가 나오고 가사 색이 글자마다 채워집니다.",
};

export default function NoraebangPage() {
  return (
    <iframe
      title="인혁 노래방"
      src="/play/noraebang/index.html"
      allow="autoplay; fullscreen"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#0b0820]"
    />
  );
}
