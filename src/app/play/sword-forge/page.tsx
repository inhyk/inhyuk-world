import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "검 강화하기 · 불멸의 대장간",
  description: "철검에서 창세의 검까지. 30단계 강화, 검 판매, 6개 사냥터와 도감을 즐기는 검 강화 게임.",
};

export default function SwordForgePage() {
  return <iframe title="검 강화하기 · 불멸의 대장간" src="/play/sword-forge/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#10100f]" />;
}
