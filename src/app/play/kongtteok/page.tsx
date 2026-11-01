import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "콩떡이 햄찌 동영상",
  description: "진짜 햄스터가 말풍선으로 수다를 떠는 콩떡이와 친구들의 1~5화 동영상입니다.",
};

export default function KongtteokPage() {
  return (
    <iframe
      title="콩떡이 햄찌 동영상"
      src="/play/kongtteok/index.html"
      allow="autoplay; fullscreen"
      allowFullScreen
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#fff6e8]"
    />
  );
}
