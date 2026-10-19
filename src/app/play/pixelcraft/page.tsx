import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "2D마인크레프트",
  description: "두 배 넓어진 세계에서 친구와 마을·네더·엔드를 탐험하고 소환사 좀비를 물리치는 2D마인크레프트.",
};

export default function PixelcraftPage() {
  return (
    <iframe
      title="2D마인크레프트"
      src="/play/pixelcraft/index.html"
      allow="autoplay; fullscreen"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#1b1b1b]"
    />
  );
}
