import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DASH / OVERDRIVE · CLASSIC",
  description: "새로 만든 맵과 노래로 달리는 리듬 러너. 큐브, 비행선, 공, UFO, 웨이브로 달리고, 스킨을 고르고, 맵 만들기로 나만의 맵도 만들 수 있어요.",
};
export default function DashOverdriveClassicPage() {
  return <iframe title="DASH / OVERDRIVE · CLASSIC" src="/play/dash-overdrive/classic/index.html?v=classic-original-14" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#0b1030]" />;
}
