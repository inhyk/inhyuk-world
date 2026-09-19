import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "BLOCKTOPIA · 작은 블록, 커다란 모험",
  description: "로블록스에서 영감을 받은 3D 블록 월드. 도시 탐험, 스카이 점프맵, 블록 건축과 아바타 꾸미기를 즐겨요.",
};
export default function BlocktopiaPage() {
  return <iframe title="블록토피아 3D 블록 모험" src="/play/blocktopia/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#b6dce5]" />;
}
