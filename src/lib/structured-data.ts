import type { Game } from "@/data/games";
import { absoluteUrl, siteConfig } from "@/lib/site";

const personId = `${siteConfig.url}/#person`;
const websiteId = `${siteConfig.url}/#website`;

export const globalJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": personId,
      name: siteConfig.creator.name,
      alternateName: siteConfig.creator.alternateName,
      url: absoluteUrl("/about"),
      description: siteConfig.creator.description,
      jobTitle: "초등학생 게임 개발자",
      sameAs: [siteConfig.creator.githubUrl],
      knowsAbout: [
        "JavaScript",
        "Python",
        "TypeScript",
        "HTML",
        "CSS",
        "HTML Canvas",
        "Three.js",
        "Phaser",
        "PixiJS",
        "Supabase",
        "OpenAI",
        "Git",
      ],
    },
    {
      "@type": "WebSite",
      "@id": websiteId,
      url: absoluteUrl("/"),
      name: siteConfig.name,
      alternateName: siteConfig.shortName,
      description: siteConfig.description,
      inLanguage: siteConfig.language,
      creator: { "@id": personId },
      publisher: { "@id": personId },
    },
  ],
};

export const profilePageJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": `${absoluteUrl("/about")}#profile-page`,
  url: absoluteUrl("/about"),
  name: "인혁 소개 | 초등학생 게임 개발자와 코딩 여정",
  description:
    "JavaScript와 Python으로 게임을 만드는 초등학생 게임 개발자 인혁의 소개, 코딩 여정과 사용 기술을 확인하세요.",
  inLanguage: siteConfig.language,
  isPartOf: { "@id": websiteId },
  mainEntity: { "@id": personId },
};

export function createGamesCollectionJsonLd(games: Game[]) {
  const sortedGames = [...games].sort((a, b) => a.order - b.order);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl("/games")}#collection-page`,
    url: absoluteUrl("/games"),
    name: "인혁의 웹 게임 작품",
    description:
      "초등학생 게임 개발자 인혁이 만든 액션, 슈팅, 퍼즐, 비주얼 노벨 등 다양한 장르의 웹 게임 모음입니다.",
    inLanguage: siteConfig.language,
    isPartOf: { "@id": websiteId },
    about: { "@id": personId },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: sortedGames.length,
      itemListElement: sortedGames.map((game, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: game.title,
        url: absoluteUrl(`/games/${game.slug}`),
      })),
    },
  };
}

export function createGameJsonLd(game: Game) {
  const pageUrl = absoluteUrl(`/games/${game.slug}`);
  const image = game.thumbnail ? absoluteUrl(game.thumbnail) : undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "홈",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "모든 작품",
            item: absoluteUrl("/games"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: game.title,
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "VideoGame",
        "@id": `${pageUrl}#game`,
        url: pageUrl,
        name: game.title,
        description: game.longDescription,
        ...(image ? { image } : {}),
        genre: game.category,
        applicationCategory: "GameApplication",
        gamePlatform: "Web browser",
        inLanguage: siteConfig.language,
        creator: { "@id": personId },
        isPartOf: { "@id": websiteId },
        keywords: game.techStack,
        ...(game.playUrl
          ? {
              potentialAction: {
                "@type": "PlayAction",
                target: game.playUrl,
              },
            }
          : {}),
      },
    ],
  };
}
