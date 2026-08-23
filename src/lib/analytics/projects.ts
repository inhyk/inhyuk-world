import "server-only";

import { games } from "@/data/games";

const projectNamesByGame: Record<string, string | null> = {
  ginginbam: "ginginbam-game-v2",
  "rhythm-game": "rhythm-game",
  "diep-io": "diep-io",
  "bean-dash-arena": "bean-dash-arena",
  "sans-boss-fight": "sans-boss-fight",
  "hotel-tycoon": "inh-hotel-tycoon",
  "inh-defense-game": "inh-defense-game",
  "inh-space-blaster": "inh-space-blaster",
  "voxel-survival": "voxel-survival",
  "find-the-ending": "find-the-ending",
  "lucky-machine": "lucky-machine",
  modongsup: null,
  "mtt-final-spotlight": "mtt-final-spotlight",
  "earthquake-drill-vn": "earthquake-drill-vn",
  "jump-map": "inh-jump-map",
  "jump-jump": "inh-jump-jump",
  "asgore-boss-fight": "asgore-boss-fight",
  "toriel-boss-fight": "toriel-boss-fight",
  "super-pokemon": "super-pokemon",
  "roblox-sandbox": "roblox-sandbox",
  "cookie-clicker": "inh-cookie-clicker",
  "color-match": "inh-color-match",
  "soul-battle": "soul-battle",
  "super-react-brothers": "super-react-brothers",
  "undertale-web": "undertale-web",
  "wanna-die-game": "wanna-die-game",
  "neon-bastion": "inh-neon-bastion",
  "pokemon-party-jamboree": "pokemon-party-jamboree",
  "inh-minecraft": "minecraft",
};

export interface AnalyticsGameProject {
  slug: string;
  title: string;
  emoji: string;
  projectName: string | null;
}

export const analyticsGameProjects: AnalyticsGameProject[] = games.map(
  (game) => ({
    slug: game.slug,
    title: game.title,
    emoji: game.emoji,
    projectName: projectNamesByGame[game.slug] ?? null,
  })
);
