import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SNOWFLOW · 눈과 물의 흐름",
  description: "눈밭을 서핑하고 아홉 가지 물 마법을 펼치는 3D WebGPU 게임. 밤에는 체력을 지키며 얼음 그림자와 싸우고, 방 코드로 친구를 불러 최대 4명이 함께 놀 수 있습니다.",
};

export default function SnowflowPage() {
  return (
    <iframe
      title="SNOWFLOW · 눈과 물의 흐름"
      src="/play/snowflow/index.html"
      allow="fullscreen"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#070b12]"
    />
  );
}
