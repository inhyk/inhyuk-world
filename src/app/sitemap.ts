import type { MetadataRoute } from "next";
import { games } from "@/data/games";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    "/",
    "/games",
    "/stats",
    "/about",
  ].map((path) => ({ url: absoluteUrl(path) }));

  const gamePages: MetadataRoute.Sitemap = games.map((game) => ({
    url: absoluteUrl(`/games/${game.slug}`),
    ...(game.thumbnail
      ? { images: [absoluteUrl(game.thumbnail)] }
      : {}),
  }));

  return [...staticPages, ...gamePages];
}
