import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "그린 체스 · 컴퓨터 대전·퍼즐·게임 리뷰",
  description: "컴퓨터 또는 친구와 즐기는 체스와 전술 퍼즐 100,000개. 캐슬링, 앙파상, 승격과 수별 분석, 추천 수, 평가 그래프를 지원합니다.",
};
export default function ChessPage() {
  return <iframe title="그린 체스" src="/play/chess/index.html" allow="autoplay; fullscreen" className="fixed inset-0 z-[100] h-dvh w-screen border-0 bg-[#242723]" />;
}
