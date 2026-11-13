import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '뚱뚱해지기 · 먹방 타이쿤',
  description: '3D 먹방 타이쿤! 음식 50가지를 먹고, 업그레이드를 사고, 월드 5개의 기록에 도전해요.',
};

export default function FatTycoonPage() {
  return <iframe title="뚱뚱해지기" src="/play/fat-tycoon/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#8fd3ff]" />;
}
