import { Badge } from "@/components/ui/Badge";
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
    <div className="min-h-screen pt-28 pb-20">
      <div className="mx-auto max-w-4xl px-6">
        {/* 뒤로 가기 */}
        <AnimatedSection>
          <Link
            href="/#games"
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            모든 게임
          </Link>
        </AnimatedSection>

        {/* 헤더 */}
        <AnimatedSection delay={0.1} className="mt-6">
          <div className="flex items-center gap-3">
            <Badge>{game.category}</Badge>
            <span className="text-sm text-muted">{game.createdAt}</span>
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-dm-sans)] text-4xl font-black tracking-[-0.05em] md:text-5xl">
            {game.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {game.techStack.map((tech) => (
              <Badge key={tech}>{tech}</Badge>
            ))}
          </div>
        </AnimatedSection>

        {/* 스크린샷 갤러리 */}
        <AnimatedSection delay={0.2} className="mt-10">
          <ScreenshotGallery
            screenshots={game.screenshots}
            title={game.title}
          />
        </AnimatedSection>

        {/* 상세 설명 */}
        <AnimatedSection delay={0.3} className="mt-10">
          <h2 className="font-[family-name:var(--font-dm-sans)] text-xl font-bold tracking-[-0.03em]">
            게임 소개
          </h2>
          <p className="mt-4 leading-relaxed text-lavender">
            {game.longDescription}
          </p>
        </AnimatedSection>

        {/* CTA 버튼 */}
        <AnimatedSection delay={0.4} className="mt-8 flex flex-wrap gap-3">
          {game.playUrl && (
            <Button href={game.playUrl} external>
              🎮 게임 플레이하기
            </Button>
          )}
          {game.githubUrl && (
            <Button href={game.githubUrl} variant="outline" external>
              📂 소스코드 보기
            </Button>
          )}
        </AnimatedSection>

        {/* 이전/다음 네비게이션 */}
        <div className="mt-16 flex items-center justify-between border-t border-border pt-8">
          {prevGame ? (
            <Link
              href={`/games/${prevGame.slug}`}
              className="group flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>
                <span className="block text-xs text-muted">이전 게임</span>
                <span className="font-semibold">{prevGame.title}</span>
              </span>
            </Link>
          ) : (
            <div />
          )}
          {nextGame ? (
            <Link
              href={`/games/${nextGame.slug}`}
              className="group flex items-center gap-2 text-right text-sm text-muted transition-colors hover:text-foreground"
            >
              <span>
                <span className="block text-xs text-muted">다음 게임</span>
                <span className="font-semibold">{nextGame.title}</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}
