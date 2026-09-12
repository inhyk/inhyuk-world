import { games } from "@/data/games";

// 썸네일 사진이 아직 없는 게임에 쓰는 대체 배경입니다.
// 목록 순서대로 색을 돌려 쓰기 때문에 옆 카드와 색이 겹치지 않습니다.

const covers = [
  "radial-gradient(ellipse at 75% 10%, #8fae7066, transparent 65%), linear-gradient(145deg, #253c34, #101b18)",
  "radial-gradient(ellipse at 20% 80%, #b1a2be55, transparent 65%), linear-gradient(145deg, #383242, #16151e)",
  "radial-gradient(ellipse at 70% 20%, #d6a07055, transparent 65%), linear-gradient(145deg, #51382e, #221814)",
  "radial-gradient(ellipse at 30% 20%, #a6c96c66, transparent 65%), linear-gradient(145deg, #354a28, #141d11)",
  "radial-gradient(ellipse at 80% 15%, #87a9c066, transparent 65%), linear-gradient(145deg, #2d3c50, #131b27)",
  "radial-gradient(ellipse at 25% 15%, #b3e6d188, transparent 70%), linear-gradient(145deg, #345c5c, #152e34)",
];

export function getGameCover(slug: string): string {
  const index = games.findIndex((game) => game.slug === slug);
  return covers[(index < 0 ? 0 : index) % covers.length];
}
