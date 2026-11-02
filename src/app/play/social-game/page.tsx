import type { Metadata } from 'next';
export const metadata: Metadata = { title: '사회적 게임 · 1인칭 3D 사회생활', description: '집에서 일어나 준비하고, 차 타고 회사 가서 일하고, 회식과 출장과 바다 여행도 가는 1인칭 3D 게임.' };
export default function SocialGamePage() { return <iframe title="사회적 게임" src="/play/social-game/index.html" allow="autoplay; fullscreen; pointer-lock" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#0e1016]" />; }
