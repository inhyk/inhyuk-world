import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { JsonLd } from "@/components/seo/JsonLd";
import { searchRobots, siteConfig } from "@/lib/site";
import { profilePageJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: { absolute: "인혁 소개 | 초등학생 게임 개발자와 코딩 여정" },
  description:
    "JavaScript와 Python으로 게임을 만드는 초등학생 게임 개발자 인혁의 소개, 2025년부터 이어진 코딩 여정과 사용 기술을 확인하세요.",
  robots: searchRobots,
  alternates: { canonical: "/about" },
  openGraph: {
    title: `인혁 소개 | ${siteConfig.name}`,
    description:
      "JavaScript와 Python으로 게임을 만드는 초등학생 게임 개발자 인혁의 코딩 여정과 사용 기술을 소개합니다.",
    url: "/about",
    type: "profile",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "초등학생 게임 개발자 인혁 소개",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `인혁 소개 | ${siteConfig.name}`,
    description:
      "JavaScript와 Python으로 게임을 만드는 초등학생 게임 개발자 인혁의 코딩 여정과 사용 기술을 소개합니다.",
    images: [
      {
        url: "/twitter-image",
        alt: "초등학생 게임 개발자 인혁 소개",
      },
    ],
  },
};

const skills = [
  "JavaScript",
  "TypeScript",
  "Python",
  "HTML Canvas",
  "Three.js",
  "PixiJS",
  "Node.js",
  "Git",
];

const journey = [
  {
    year: "2025",
    season: "가을",
    description: "JavaScript와 HTML Canvas로 첫 번째 게임 프로젝트 시작",
  },
  {
    year: "2025",
    season: "겨울",
    description: "Python Pygame으로 영역 확장, 다양한 장르의 게임 개발",
  },
  {
    year: "2026",
    season: "현재",
    description: "게임 포트폴리오 사이트 제작, 더 복잡한 게임 도전 중!",
  },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={profilePageJsonLd} />
      <div className="min-h-screen pb-24">
        {/* 히어로 */}
        <div className="relative overflow-hidden border-b border-border">
          <div className="mesh absolute inset-0 opacity-80" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />

          <div className="relative mx-auto max-w-5xl px-5 pt-24 pb-14 md:px-8 md:pt-28 md:pb-16">
            <p className="text-xs font-medium tracking-[0.14em] text-white/75 uppercase">
              소개
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-inter-tight)] text-[34px] leading-[1.1] font-extrabold tracking-[-0.03em] text-white md:text-[48px]">
              게임을 만드는 사람, 인혁
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-[1.7] text-white/85">
              안녕하세요! JavaScript와 Python으로 게임을 만드는 초등학생 게임
              개발자 인혁입니다. 아이디어를 직접 플레이할 수 있는 게임으로
              만드는 걸 좋아합니다.
            </p>
            <div className="mt-8">
              <Button href="/games">만든 게임 보기</Button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-5 md:px-8">
          {/* 한마디 */}
          <div className="mt-16 rounded-3xl border border-border bg-surface p-8 md:p-12">
            <p className="font-[family-name:var(--font-inter-tight)] text-[24px] leading-[1.35] font-bold tracking-[-0.02em] md:text-[34px]">
              &ldquo;코딩은 제가 상상하는 것들을
              <br className="hidden md:block" /> 직접 만들 수 있어서
              좋아합니다&rdquo;
            </p>
          </div>

          {/* 여정 */}
          <div className="mt-16">
            <h2 className="font-[family-name:var(--font-inter-tight)] text-[26px] font-bold tracking-[-0.025em] md:text-[32px]">
              코딩 여정
            </h2>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {journey.map((item) => (
                <div
                  key={`${item.year}-${item.season}`}
                  className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-border-strong"
                >
                  <p className="font-[family-name:var(--font-inter-tight)] text-3xl font-extrabold tracking-[-0.03em] text-foreground/25">
                    {item.year}
                  </p>
                  <p className="mt-1 text-xs text-muted">{item.season}</p>
                  <p className="mt-4 text-[15px] leading-[1.7] text-muted-strong">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 기술 */}
          <div className="mt-16">
            <h2 className="font-[family-name:var(--font-inter-tight)] text-[26px] font-bold tracking-[-0.025em] md:text-[32px]">
              사용 기술
            </h2>
            <div className="mt-6 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-strong"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
