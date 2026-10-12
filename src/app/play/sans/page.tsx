import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SANS · 심판의 회랑",
  description: "샌즈하고만 싸우는 단독 보스전. 뼈와 블래스터, 중력 내리꽂기를 피하고 마지막 선택을 하세요.",
};

export default function SansPage() {
  return (
    <iframe
      title="SANS · 심판의 회랑 보스전"
      src="/play/sans/index.html"
      allow="autoplay; fullscreen"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#07070c]"
    />
  );
}
