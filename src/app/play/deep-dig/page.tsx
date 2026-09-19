import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DEEP DIG · 땅파기 게임",
  description: "3D 블록을 꾹 눌러 금을 내고 8종의 광물을 발견하세요. 힘·삽·속도·배낭 업그레이드로 100억 원에 도전하는 채굴 게임.",
};
export default function DeepDigPage() {
  return <iframe title="DEEP DIG · 땅파기 게임" src="/play/deep-dig/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#10221e]" />;
}
