import type { Metadata } from 'next';
export const metadata: Metadata = {title:'자유도로 · 자동차 자유주행',description:'내 차와 떠나는 작은 여행. 도시, 숲, 해변을 달리고 숨겨진 자동차를 찾아보세요.'};
export default function FreeDrivePage(){return <iframe title="자유도로 자동차 게임" src="/play/free-drive/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#172d30]"/>;}
