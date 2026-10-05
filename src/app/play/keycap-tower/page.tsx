import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "키캡 타워 · KEYCAP TOWER",
  description: "키캡을 밟을 때마다 스피드 +1! 트로피로 아이템·스킨·트레일을 사고 50개 월드의 3D 키캡 타워를 올라가요.",
};

export default function KeycapTowerPage() {
  return <iframe title="키캡 타워 · KEYCAP TOWER" src="/play/keycap-tower/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#ffc9de]" />;
}
