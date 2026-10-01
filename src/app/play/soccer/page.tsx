import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "인혁이의 3D 축구 · INHYUK SOCCER",
  description: "파란색 인혁 FC를 이끌고 5 대 5 축구! 드리블하고 패스하고, 길게 눌러 강슛으로 골망을 흔들어요.",
};
export default function SoccerPage() {
  return <iframe title="인혁이의 3D 축구" src="/play/soccer/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#101a36]" />;
}
