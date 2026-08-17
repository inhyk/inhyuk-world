import type { Metadata } from "next";

export const siteConfig = {
  url: "https://seonn.dev",
  name: "인혁이의 게임 월드",
  shortName: "InHyuk.",
  title: "인혁이의 게임 월드 | 초등학생 게임 개발자 포트폴리오",
  description:
    "JavaScript와 Python으로 게임을 만드는 초등학생 게임 개발자 인혁의 포트폴리오입니다. 액션, 슈팅, 퍼즐, 비주얼 노벨 등 직접 만든 다양한 웹 게임을 소개하고 플레이할 수 있습니다.",
  creator: {
    name: "인혁",
    alternateName: "InHyuk",
    description: "JavaScript와 Python으로 게임을 만드는 초등학생 게임 개발자",
    githubUrl: "https://github.com/inhyk",
  },
  locale: "ko_KR",
  language: "ko-KR",
} as const;

export const searchRobots: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export function absoluteUrl(path = "/") {
  return new URL(path, `${siteConfig.url}/`).toString();
}
