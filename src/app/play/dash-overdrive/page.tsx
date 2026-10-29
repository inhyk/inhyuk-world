import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DASH / OVERDRIVE · 대쉬 오버드라이브",
  description: "점프하고 비행하며 하늘 도시를 돌파하는 새로운 리듬 액션. 세 코스와 변신 포털, 점프 패드, 연습 모드를 즐겨 보세요.",
};
export default function DashOverdrivePage() {
  return <iframe title="DASH / OVERDRIVE" src="/play/dash-overdrive/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#2559eb]" />;
}
