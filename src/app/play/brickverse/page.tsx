import type { Metadata } from 'next';
export const metadata: Metadata = { title: '브릭버스 · BRICKVERSE', description: '아바타를 꾸미고 광장의 문을 골라 점프 탑, 블록 공장 타이쿤, 바닥이 사라져요를 하는 3D 블록 놀이터. 방 코드로 친구랑 같이 놀아요.' };
export default function BrickversePage() { return <iframe title="브릭버스" src="/play/brickverse/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#3d8fff]" />; }
