import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "메타톤 EX · GLAMOUR / LIVE",
  description: "지하 세계 최고의 스타와 펼치는 화려한 탄막 보스전. 공격하고, 춤추고, 시청자의 마음을 사로잡으세요.",
};

export default function MettatonPage() {
  return (
    <iframe
      title="메타톤 EX · GLAMOUR / LIVE 보스전"
      src="/play/mettaton/index.html"
      allow="autoplay; fullscreen"
      className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#08060e]"
    />
  );
}
