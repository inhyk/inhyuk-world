import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "구름 점프 · 2D 점프맵",
  description: "10개의 구름 코스를 뛰어넘는 2D 점프맵. 움직이는 발판, 별 수집, 체크포인트와 모바일 조작을 지원합니다.",
};

export default function JumpMap2DPage() {
  return <iframe title="구름 점프 · 2D 점프맵" src="/play/jump-map-2d/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#c9eaff]" />;
}
