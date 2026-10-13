import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ASRIEL · 마지막 별빛",
  description: "아스리엘 드리무르와의 단독 보스전. 별과 검, 번개를 피하고 마지막까지 결의를 지키세요.",
};

export default function AsrielPage() {
  return (
    <iframe
      title="아스리엘 · 마지막 별빛 보스전"
      src="/play/asriel/index.html"
      allow="autoplay; fullscreen"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#080910]"
    />
  );
}
