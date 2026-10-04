import "server-only";

import { games } from "@/data/games";
import { siteConfig } from "@/lib/site";

export const SITE_PROJECT_NAME = "inhyuk-world";

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
  modongsup: "modongsup",
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
  pathname?: string;
  teamId?: string;
  tokenEnv?: string;
}

export const analyticsGameProjects: AnalyticsGameProject[] = games.map((game) => {
  const project: AnalyticsGameProject = {
    slug: game.slug,
    title: game.title,
    emoji: game.emoji,
    projectName: projectNamesByGame[game.slug] ?? null,
  };

  // Games hosted inside the hub share its project, but have their own pageviews.
  if (game.playUrl) {
    const playUrl = new URL(game.playUrl, siteConfig.url);
    if (
      playUrl.origin === new URL(siteConfig.url).origin &&
      playUrl.pathname.startsWith("/play/")
    ) {
      project.projectName = SITE_PROJECT_NAME;
      project.pathname = playUrl.pathname.replace(/\/$/, "");
    }
  }

  // Modongsup belongs to kubony's team, rather than the hub's team.
  if (game.slug === "modongsup") {
    project.teamId = "team_vtqKQtYcdLc1SLSGPcIvs2sT";
    project.tokenEnv = "DASHBOARD_MODONGSUP_VERCEL_TOKEN";
  }

  return project;
});
