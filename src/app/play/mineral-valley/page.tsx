import type { Metadata } from "next";
export const metadata: Metadata = { title: "미네랄 밸리 · MINERAL VALLEY", description: "1000×1000의 3D 계곡에서 14등급 광물을 발견하고 판매하세요. 힘과 속도를 키워 가장 희귀한 원석을 찾아보세요." };
export default function MineralValleyPage() {
  return <iframe title="미네랄 밸리 · 3D 광물 탐험" src="/play/mineral-valley/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#96bca5]" />;
}
