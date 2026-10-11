import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PULSE RUSH · 펄스 러시",
  description: "10개의 오리지널 곡에 맞춰 타일을 누르는 4키 리듬게임. 퍼펙트, 그레잇, 굿, 배드, 미스 판정과 콤보에 도전하세요.",
};

export default function PulseRushPage() {
  return (
    <iframe
      title="PULSE RUSH · 펄스 러시 리듬게임"
      src="/play/pulse-rush/index.html"
      allow="autoplay; fullscreen"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#101314]"
    />
  );
}
