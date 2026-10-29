import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Geometry Classics · Official Levels 1–15",
  description: "Geometry Dash 1~15단계의 원작 맵 배치와 YouTube 원곡 플레이어를 사용하는 비공식 웹 재현입니다.",
};
export default function GeometryClassicsPage() {
  return <iframe title="Geometry Classics · 1단계부터 15단계" src="/play/dash-overdrive/classic/index.html?v=solid-floor-platforms-20261029-2245" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#100a20]" />;
}
