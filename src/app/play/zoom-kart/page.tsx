import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '씽씽 카트 · 드리프트 레이싱',
  description: '드리프트로 부스터를 모으고 아이템으로 역전하는 3D 카트 레이싱! 트랙 6개에서 1등에 도전해요.',
};

export default function ZoomKartPage() {
  return <iframe title="씽씽 카트" src="/play/zoom-kart/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#8fd3ff]" />;
}
