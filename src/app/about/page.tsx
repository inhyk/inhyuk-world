import type { Metadata } from "next";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export const metadata: Metadata = {
  title: "About | 인혁이의 게임 월드",
  description: "인혁이의 코딩 여정과 사용 기술 소개",
};

const skills = [
  "JavaScript",
  "Python",
  "HTML Canvas",
  "Pygame",
  "CSS",
  "HTML",
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
    <div className="min-h-screen pt-32 pb-24">
      <div className="mx-auto max-w-5xl px-6">
        {/* Hero Intro */}
        <AnimatedSection>
          <p className="text-sm tracking-widest uppercase text-muted">
            소개
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-6xl font-bold leading-[1.05] tracking-tight md:text-8xl">
            만든 사람
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-strong">
            게임을 만들며 세상을 탐험하는 인혁이
          </p>
        </AnimatedSection>

        {/* Profile Section - Editorial Asymmetric Layout */}
        <AnimatedSection delay={0.15} className="mt-20">
          <div className="grid gap-10 md:grid-cols-5 md:items-center">
            {/* Left: Large Visual */}
            <div className="md:col-span-2">
              <div className="flex aspect-[4/5] items-center justify-center rounded-3xl bg-cream">
                <span className="text-8xl md:text-9xl">🎮</span>
              </div>
            </div>

            {/* Right: Text */}
            <div className="md:col-span-3 md:pl-6">
              <p className="text-sm tracking-widest uppercase text-muted">
                게임 개발자 &amp; 학생
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-4xl font-bold md:text-5xl">
                인혁
              </h2>
              <p className="mt-6 text-lg leading-[1.8] text-muted-strong">
                안녕하세요! 저는 게임 만들기를 좋아하는 학생입니다.
                JavaScript와 Python으로 다양한 게임을 만들고 있어요.
                앞으로 더 재미있고 멋진 게임을 많이 만들고 싶습니다!
              </p>
            </div>
          </div>
        </AnimatedSection>

        {/* Mission Statement */}
        <AnimatedSection delay={0.25} className="mt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-[family-name:var(--font-playfair)] text-3xl font-bold leading-snug md:text-5xl md:leading-snug">
              &ldquo;코딩은 제가 상상하는 것들을
              <br className="hidden md:block" />
              직접 만들 수 있어서 좋아합니다&rdquo;
            </p>
          </div>
        </AnimatedSection>

        {/* Coding Journey */}
        <AnimatedSection delay={0.35} className="mt-24">
          <p className="text-sm tracking-widest uppercase text-muted">
            여정
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl font-bold md:text-4xl">
            코딩 여정
          </h2>

          <div className="mt-12 space-y-16">
            {journey.map((item, i) => (
              <AnimatedSection key={i} delay={0.4 + i * 0.1}>
                <div className="grid gap-4 md:grid-cols-5 md:items-baseline">
                  <div className="md:col-span-2">
                    <span className="font-[family-name:var(--font-playfair)] text-5xl font-bold text-foreground/15 md:text-7xl">
                      {item.year}
                    </span>
                    <p className="mt-1 text-sm text-muted">{item.season}</p>
                  </div>
                  <div className="md:col-span-3">
                    <p className="text-lg leading-relaxed text-muted-strong">
                      {item.description}
                    </p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </AnimatedSection>

        {/* Skills */}
        <AnimatedSection delay={0.5} className="mt-24">
          <p className="text-sm tracking-widest uppercase text-muted">
            기술
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl font-bold md:text-4xl">
            사용 기술
          </h2>
          <p className="mt-8 text-2xl font-light leading-relaxed tracking-wide text-muted-strong md:text-3xl">
            {skills.join(" · ")}
          </p>
        </AnimatedSection>
      </div>
    </div>
  );
}
