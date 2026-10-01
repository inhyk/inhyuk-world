import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "패드 작업실 · 패드 팔기 게임",
  description:
    "손그림에서 시작한 3D 패드 작업실. 패드를 만들어 팔고, 알에서 행운 펫을 뽑고, 환생하고, 지붕 색을 찾아 배달해요. 곡괭이 20종과 패드 60종.",
};

export default function PadShopPage() {
  return (
    <iframe
      title="패드 작업실 · 패드 팔기 게임"
      src="/play/pad-shop/index.html"
      allow="autoplay; fullscreen"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#f5f3ed]"
    />
  );
}
