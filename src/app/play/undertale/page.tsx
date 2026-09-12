import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNDERTALE · 세 갈래의 결말",
  description: "아무도 죽이지 않거나, 모두를 죽이거나. 폐허부터 왕좌의 방까지, 선택이 결말을 바꾸는 언더테일 팬 게임.",
};

export default function UndertalePage() {
  return (
    <iframe
      title="UNDERTALE · 세 갈래의 결말 팬 게임"
      src="/play/undertale/index.html"
      allow="autoplay; fullscreen"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#000]"
    />
  );
}
