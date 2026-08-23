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
  /** public/ 아래 경로. 영상 비율에 맞춰 잘라 둔 로컬 썸네일입니다. */
  thumbnail: string;
  aspect: "landscape" | "portrait";
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
    aspect: "landscape",
    publishedAt: "2026-02-12",
    duration: "41분",
    gameSlug: "modongsup",
  },
  {
    id: "wanna-die-gameplay-2025-08",
    outlet: "Inkeun Seo",
    outletUrl: "https://www.youtube.com/@kubony",
    title: "인혁이 만든 우주 슈팅게임 플레이",
    summary:
      "인혁이가 만든 우주 슈팅게임을 직접 플레이하며 웨이브, 퀘스트, 스킨 기능을 소개합니다.",
    url: "https://www.youtube.com/shorts/vBPSBdr_qc8",
    youtubeId: "vBPSBdr_qc8",
    thumbnail: "/media/wanna-die-gameplay-short-thumb.jpg",
    aspect: "portrait",
    publishedAt: "2025-08-15",
    duration: "1분 8초",
    gameSlug: "wanna-die-game",
  },
  {
    id: "wanna-die-prompt-2025-08",
    outlet: "Inkeun Seo",
    outletUrl: "https://www.youtube.com/@kubony",
    title: "게임을 만든 프롬프트 공개",
    summary:
      "Cursor에 말로 입력한 프롬프트를 보여 주며 게임에 기능을 더해 간 과정을 소개합니다.",
    url: "https://www.youtube.com/shorts/zyUbSb_cv7U",
    youtubeId: "zyUbSb_cv7U",
    thumbnail: "/media/wanna-die-prompt-short-thumb.jpg",
    aspect: "portrait",
    publishedAt: "2025-08-15",
    duration: "57초",
    gameSlug: "wanna-die-game",
  },
];

export function getMediaByGameSlug(slug: string): MediaAppearance[] {
  return mediaAppearances.filter((item) => item.gameSlug === slug);
}

export function formatMediaDate(publishedAt: string): string {
  const [year, month] = publishedAt.split("-");
  return `${year}년 ${Number(month)}월`;
}
