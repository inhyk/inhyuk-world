export interface Game {
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  emoji: string;
  thumbnail: string;
  screenshots: string[];
  techStack: string[];
  category: string;
  playUrl?: string;
  githubUrl?: string;
  createdAt: string;
  featured: boolean;
  order: number;
}

export const games: Game[] = [
  {
    slug: "ginginbam",
    title: "긴긴밤",
    description: "선택이 운명을 바꾸는 인터랙티브 비주얼 노벨",
    longDescription:
      "긴긴밤(The Long, Long Night)은 텍스트 기반의 인터랙티브 스토리 게임입니다. 플레이어의 선택에 따라 이야기가 달라지며, 희망 게이지를 관리하면서 긴 밤을 헤쳐 나가야 합니다. 5가지 테마 스킨(밤, 황혼, 겨울, 벚꽃, 오래된 책), 인벤토리 시스템, 숨겨진 이스터에그, 그리고 PeerJS 기반 멀티플레이어까지 지원합니다. 순수 HTML, CSS, JavaScript만으로 만들었습니다.",
    emoji: "🌙",
    thumbnail: "/images/games/ginginbam-thumb.png",
    screenshots: [
      "/images/games/ginginbam-1.png",
      "/images/games/ginginbam-2.png",
      "/images/games/ginginbam-3.png",
    ],
    techStack: ["JavaScript", "HTML", "CSS", "PeerJS"],
    category: "비주얼 노벨",
    playUrl: "https://ginginbam-game-v2.vercel.app",
    githubUrl: "https://github.com/inhyk/ginginbam-game-v2",
    createdAt: "2026-02",
    featured: true,
    order: 1,
  },
  {
    slug: "rhythm-game",
    title: "Rhythm Game",
    description: "떨어지는 노트에 맞춰 키를 누르는 리듬 게임",
    longDescription:
      "4키 낙하형 리듬 게임입니다. 화면 위에서 떨어지는 노트에 맞춰 타이밍에 키를 눌러 점수를 얻으세요. EDM Demo, First Step(EASY)부터 EDM NIGHTMARE(Lv.12)까지 6개의 곡이 준비되어 있고, 롱노트도 지원합니다. 스페이스바로 시작/일시정지, 좌우 화살표로 곡을 변경할 수 있습니다. TypeScript와 PixiJS로 렌더링하고, Vite로 빌드했습니다.",
    emoji: "🎵",
    thumbnail: "/images/games/rhythm-game-thumb.png",
    screenshots: [
      "/images/games/rhythm-game-1.png",
      "/images/games/rhythm-game-2.png",
      "/images/games/rhythm-game-3.png",
    ],
    techStack: ["TypeScript", "PixiJS", "Vite"],
    category: "리듬",
    playUrl: "https://rhythm-game-olive.vercel.app",
    githubUrl: "https://github.com/inhyk/rhythm-game",
    createdAt: "2026-01",
    featured: true,
    order: 2,
  },
];

export function getGameBySlug(slug: string): Game | undefined {
  return games.find((game) => game.slug === slug);
}

export function getAdjacentGames(slug: string): { prev: Game | null; next: Game | null } {
  const sorted = [...games].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((game) => game.slug === slug);
  return {
    prev: index > 0 ? sorted[index - 1] : null,
    next: index < sorted.length - 1 ? sorted[index + 1] : null,
  };
}
