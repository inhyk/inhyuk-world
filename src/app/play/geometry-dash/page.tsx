import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Geometry Dash · Neon Run",
  description: "클릭과 스페이스로 네온 장애물을 뛰어넘는 리듬 점프 게임. 천장 가시와 점프 높이 조절이 있는 HELL 난이도 3개 스테이지와 체크포인트 연습 모드에 도전하세요.",
};

export default function GeometryDashPage() {
  return <iframe title="Geometry Dash · Neon Run" src="/play/geometry-dash/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#080b16]" />;
}
