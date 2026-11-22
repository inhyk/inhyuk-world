import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '모아몬 탐험대',
  description: '마을을 걸으며 몬스터를 찾고, 방울을 던져 잡고, 키워서 도장에 도전하는 3D 수집 모험!',
};

export default function MoamonPage() {
  return <iframe title="모아몬 탐험대" src="/play/moamon/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#3d9eff]" />;
}
