import type { Metadata } from "next";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { Badge } from "@/components/ui/Badge";

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

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="mx-auto max-w-3xl px-6">
        <AnimatedSection>
          <h1 className="font-[family-name:var(--font-dm-sans)] text-5xl font-black tracking-[-0.05em] md:text-6xl">
            About Me
          </h1>
          <p className="mt-4 text-lg text-muted">
            게임을 만들며 코딩을 배우고 있는 인혁이입니다
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.15} className="mt-16">
          <div className="rounded-2xl border border-border bg-card p-8">
            <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-card-hover text-5xl">
                🎮
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-dm-sans)] text-2xl font-bold tracking-[-0.03em]">
                  인혁
                </h2>
                <p className="mt-1 text-sm text-muted">Game Developer & Student</p>
                <p className="mt-4 leading-relaxed text-lavender">
                  안녕하세요! 저는 게임 만들기를 좋아하는 학생입니다.
                  JavaScript와 Python으로 다양한 게임을 만들고 있어요.
                  코딩은 제가 상상하는 것들을 직접 만들 수 있어서 좋아합니다.
                  앞으로 더 재미있고 멋진 게임을 많이 만들고 싶습니다!
                </p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.3} className="mt-12">
          <h2 className="font-[family-name:var(--font-dm-sans)] text-2xl font-bold tracking-[-0.03em]">
            코딩 여정
          </h2>
          <div className="mt-6 space-y-6">
            <div className="relative border-l-2 border-border pl-6">
              <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-lavender" />
              <h3 className="font-semibold">2025년 가을</h3>
              <p className="mt-1 text-sm text-muted">
                JavaScript와 HTML Canvas로 첫 번째 게임 프로젝트 시작
              </p>
            </div>
            <div className="relative border-l-2 border-border pl-6">
              <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-lavender" />
              <h3 className="font-semibold">2025년 겨울</h3>
              <p className="mt-1 text-sm text-muted">
                Python Pygame으로 영역 확장, 다양한 장르의 게임 개발
              </p>
            </div>
            <div className="relative border-l-2 border-border pl-6">
              <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-lavender" />
              <h3 className="font-semibold">2026년</h3>
              <p className="mt-1 text-sm text-muted">
                게임 포트폴리오 사이트 제작, 더 복잡한 게임 도전 중!
              </p>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.45} className="mt-12">
          <h2 className="font-[family-name:var(--font-dm-sans)] text-2xl font-bold tracking-[-0.03em]">
            사용 기술
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
