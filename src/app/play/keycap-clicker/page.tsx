import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "키캡 누르기 · KEYCAP CLUB",
  description: "톡, 톡! 키캡을 눌러 돈을 모으고 소리와 디자인이 바뀌는 100단계 업그레이드로 궁극의 키캡을 완성하세요.",
};

export default function KeycapClickerPage() {
  return <iframe title="키캡 누르기 · KEYCAP CLUB" src="/play/keycap-clicker/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#f5f2e9]" />;
}
