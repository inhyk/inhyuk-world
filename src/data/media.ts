// 인혁이(그리고 아빠)가 출연한 영상·기사 목록입니다.
// 게임과 달리 자주 늘어나지 않아서 JSON 없이 여기서 바로 관리합니다.

export interface MediaAppearance {
  id: string;
  /** 매체 이름 (예: 요즘IT) */
  outlet: string;
  outletUrl: string;
  title: string;
  /** 사이트에 싣는 우리말 소개 (영상 설명을 그대로 옮기지 않습니다) */
  summary: string;
  url: string;
  youtubeId: string;
  /** public/ 아래 경로. 유튜브 썸네일을 16:9로 잘라 받아 둔 것입니다. */
  thumbnail: string;
  /** YYYY-MM-DD (한국 시간) */
  publishedAt: string;
  duration: string;
  /** 이 영상에서 다룬 게임 슬러그 — 게임 상세 페이지에 함께 보여 줍니다. */
  gameSlug?: string;
}

export const mediaAppearances: MediaAppearance[] = [
  {
    id: "yozmit-2026-02",
    outlet: "요즘IT",
    outletUrl: "https://www.youtube.com/@yozmit_official",
    title:
      "닌텐도 못 하게 했더니 클로드코드로 '모동숲' 만든 10살 아들(feat. 개발자 아빠)",
    summary:
      "인혁이가 아빠와 함께 요즘IT 채널에 나갔습니다. AI 스튜디오에서 클로드 코드로 넘어온 이야기, '숨어봐요 동물의 숲'을 만들면서 겪은 일, 그리고 게임을 직접 만들며 배운 것들을 이야기했어요.",
    url: "https://www.youtube.com/watch?v=twsx6DvIvBE",
    youtubeId: "twsx6DvIvBE",
    thumbnail: "/media/yozmit-interview-thumb.jpg",
    publishedAt: "2026-02-12",
    duration: "41분",
    gameSlug: "modongsup",
  },
];

export function getMediaByGameSlug(slug: string): MediaAppearance[] {
  return mediaAppearances.filter((item) => item.gameSlug === slug);
}

export function formatMediaDate(publishedAt: string): string {
  const [year, month] = publishedAt.split("-");
  return `${year}년 ${Number(month)}월`;
}
