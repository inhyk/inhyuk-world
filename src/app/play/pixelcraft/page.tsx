import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "픽셀크래프트 · 2D 마인크래프트",
  description: "나무를 캐고, 제작대에서 곡괭이를 만들고, 동굴 깊은 곳의 다이아몬드를 찾는 2D 마인크래프트.",
};

export default function PixelcraftPage() {
  return (
    <iframe
      title="픽셀크래프트 · 2D 마인크래프트"
      src="/play/pixelcraft/index.html"
      allow="autoplay; fullscreen"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#1b1b1b]"
    />
  );
}
