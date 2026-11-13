import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DASH / OVERDRIVE · 대쉬 오버드라이브",
  description: "새로 만든 맵과 노래로 달리는 리듬 러너 CLASSIC. 큐브, 비행선, 공, UFO, 웨이브로 달리고, 스킨을 모으고, 맵 만들기와 같이 하기도 즐겨 보세요. 예전 HARD EDITION도 버튼 하나로 갈 수 있어요.",
};
// The newest version (CLASSIC) opens first; HARD EDITION stays at /play/dash-overdrive/index.html.
export default function DashOverdrivePage() {
  return <iframe title="DASH / OVERDRIVE · CLASSIC" src="/play/dash-overdrive/classic/index.html?v=classic-original-13" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#0b1030]" />;
}
