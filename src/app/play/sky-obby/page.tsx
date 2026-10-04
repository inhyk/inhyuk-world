import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "하늘 점프맵 · SKY OBBY",
  description: "구름 위 9개 스테이지를 점프로 넘어 트로피까지! 용암, 움직이는 발판, 사라지는 블록, 회전 막대, 점프대가 있는 3D 점프맵.",
};
export default function SkyObbyPage() {
  return <iframe title="하늘 점프맵 · SKY OBBY" src="/play/sky-obby/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#8fd3ff]" />;
}
