import { Button } from "@/components/ui/Button";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { ScreenshotGallery } from "@/components/games/ScreenshotGallery";
import type { Game } from "@/data/games";
import Link from "next/link";

interface GameDetailProps {
  game: Game;
  prevGame: Game | null;
  nextGame: Game | null;
}

export function GameDetail({ game, prevGame, nextGame }: GameDetailProps) {
  return (
    <div className="min-h-screen pt-28 pb-24">
      <div className="mx-auto max-w-5xl px-6">
        {/* Back Link */}
        <AnimatedSection>
          <Link
            href="/#games"
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            <span aria-hidden="true">&larr;</span>
            모든 게임
          </Link>
        </AnimatedSection>

        {/* Hero Section */}
        <AnimatedSection delay={0.1} className="mt-10">
          <div className="relative flex items-center justify-center overflow-hidden rounded-3xl bg-cream py-20 md:py-28">
            <span className="text-8xl md:text-[10rem]">{game.emoji}</span>
          </div>
        </AnimatedSection>

        {/* Title & Meta */}
        <AnimatedSection delay={0.2} className="mt-10">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <span>{game.category}</span>
            <span aria-hidden="true">/</span>
            <span>{game.createdAt}</span>
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-5xl font-bold tracking-tight md:text-7xl">
            {game.title}
          </h1>
        </AnimatedSection>

        {/* Description - Editorial */}
        <AnimatedSection delay={0.3} className="mt-8">
          <p className="max-w-2xl text-xl leading-[1.8] text-muted-strong md:text-2xl md:leading-[1.8]">
            {game.description}
          </p>
        </AnimatedSection>

        {/* CTA Buttons */}
        <AnimatedSection delay={0.35} className="mt-8 flex flex-wrap gap-3">
          {game.playUrl && (
            <Button href={game.playUrl} external>
              게임 플레이
            </Button>
          )}
          {game.githubUrl && (
            <Button href={game.githubUrl} variant="outline" external>
              소스 코드
            </Button>
          )}
        </AnimatedSection>

        {/* Long Description */}
        <AnimatedSection delay={0.4} className="mt-16">
          <p className="text-sm tracking-widest uppercase text-muted">
            게임 소개
          </p>
          <p className="mt-4 max-w-3xl text-lg leading-[1.9] text-muted-strong">
            {game.longDescription}
          </p>
        </AnimatedSection>

        {/* Screenshot Gallery */}
        <AnimatedSection delay={0.45} className="mt-16">
          <p className="mb-6 text-sm tracking-widest uppercase text-muted">
            스크린샷
          </p>
          <ScreenshotGallery
            screenshots={game.screenshots}
            title={game.title}
          />
        </AnimatedSection>

        {/* Tech Stack */}
        <AnimatedSection delay={0.5} className="mt-16">
          <p className="text-sm tracking-widest uppercase text-muted">
            사용 기술
          </p>
          <p className="mt-4 text-xl font-light tracking-wide text-muted-strong md:text-2xl">
            {game.techStack.join(" · ")}
          </p>
        </AnimatedSection>

        {/* Prev / Next Navigation */}
        <div className="mt-20 border-t border-border pt-10">
          <div className="flex items-center justify-between">
            {prevGame ? (
              <Link
                href={`/games/${prevGame.slug}`}
                className="group flex items-center gap-3 text-muted transition-colors hover:text-foreground"
              >
                <span className="text-xl" aria-hidden="true">&larr;</span>
                <span>
                  <span className="block text-xs uppercase tracking-widest text-muted">
                    이전
                  </span>
                  <span className="mt-0.5 block font-[family-name:var(--font-playfair)] text-lg font-semibold text-foreground">
                    {prevGame.title}
                  </span>
                </span>
              </Link>
            ) : (
              <div />
            )}
            {nextGame ? (
              <Link
                href={`/games/${nextGame.slug}`}
                className="group flex items-center gap-3 text-right text-muted transition-colors hover:text-foreground"
              >
                <span>
                  <span className="block text-xs uppercase tracking-widest text-muted">
                    다음
                  </span>
                  <span className="mt-0.5 block font-[family-name:var(--font-playfair)] text-lg font-semibold text-foreground">
                    {nextGame.title}
                  </span>
                </span>
                <span className="text-xl" aria-hidden="true">&rarr;</span>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
