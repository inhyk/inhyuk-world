import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { ScreenshotGallery } from "@/components/games/ScreenshotGallery";
import { VideoEmbed } from "@/components/media/VideoEmbed";
import { getGameCover } from "@/lib/gameVisual";
import { getMediaByGameSlug, formatMediaDate } from "@/data/media";
import type { Game } from "@/data/games";

interface GameDetailProps {
  game: Game;
  prevGame: Game | null;
  nextGame: Game | null;
}

export function GameDetail({ game, prevGame, nextGame }: GameDetailProps) {
  const mediaItems = getMediaByGameSlug(game.slug);

  return (
    <div className="min-h-screen pb-20">
      {/* ---------- 히어로: 스크롤 없이 커버 + 플레이 버튼까지 보입니다 ---------- */}
      <div className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 opacity-45 blur-2xl"
          style={{ backgroundImage: getGameCover(game.slug) }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background" />

        <div className="relative mx-auto max-w-6xl px-5 pt-20 pb-10 md:px-8 md:pt-24 md:pb-14">
          <nav aria-label="현재 위치">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <li>
                <Link
                  href="/"
                  className="transition-colors hover:text-foreground"
                >
                  홈
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href="/games"
                  className="transition-colors hover:text-foreground"
                >
                  모든 게임
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-muted-strong">
                {game.title}
              </li>
            </ol>
          </nav>

          <div className="mt-6 grid gap-8 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-10">
            {/* 커버 */}
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-surface">
              {game.thumbnail ? (
                <Image
                  src={game.thumbnail}
                  alt={`${game.title} 웹 게임 대표 화면`}
                  fill
                  sizes="(max-width: 768px) 100vw, 620px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ backgroundImage: getGameCover(game.slug) }}
                >
                  <span
                    className="text-7xl drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] md:text-8xl"
                    role="img"
                    aria-label={`${game.title} 웹 게임 대표 화면`}
                  >
                    {game.emoji}
                  </span>
                </div>
              )}
            </div>

            {/* 정보 */}
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full border border-border px-2.5 py-1 font-medium text-muted-strong">
                  {game.category}
                </span>
                <span>{game.createdAt}</span>
              </div>

              <h1 className="mt-4 font-[family-name:var(--font-inter-tight)] text-[34px] leading-[1.1] font-extrabold tracking-[-0.03em] md:text-[46px]">
                {game.title}
              </h1>

              <p className="mt-4 text-[15px] leading-[1.7] text-muted-strong md:text-base">
                {game.description}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                {game.playUrl && (
                  <Button href={game.playUrl} external>
                    게임 플레이 →
                  </Button>
                )}
                {game.githubUrl && (
                  <Button href={game.githubUrl} variant="outline" external>
                    소스 코드
                  </Button>
                )}
              </div>

              <div className="mt-7 flex flex-wrap gap-2">
                {game.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-muted-strong"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- 상세 ---------- */}
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="mt-14 grid gap-10 md:grid-cols-[1fr_1.4fr] md:gap-14">
          <div>
            <h2 className="font-[family-name:var(--font-inter-tight)] text-xl font-bold tracking-[-0.02em]">
              게임 소개
            </h2>
          </div>
          <p className="text-[15px] leading-[1.9] text-muted-strong">
            {game.longDescription}
          </p>
        </div>

        {game.screenshots.length > 0 && (
          <div className="mt-16">
            <h2 className="mb-5 font-[family-name:var(--font-inter-tight)] text-xl font-bold tracking-[-0.02em]">
              스크린샷
            </h2>
            <ScreenshotGallery
              screenshots={game.screenshots}
              title={game.title}
              emoji={game.emoji}
            />
          </div>
        )}

        {mediaItems.length > 0 && (
          <div className="mt-16">
            <h2 className="mb-5 font-[family-name:var(--font-inter-tight)] text-xl font-bold tracking-[-0.02em]">
              이 게임이 나온 영상
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              {mediaItems.map((item) => (
                <div key={item.id}>
                  <VideoEmbed
                    youtubeId={item.youtubeId}
                    title={item.title}
                    thumbnail={item.thumbnail}
                    sizes="(max-width: 768px) 100vw, 520px"
                  />
                  <p className="mt-4 font-[family-name:var(--font-inter-tight)] text-base leading-[1.4] font-semibold">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-sm text-muted">
                    {item.outlet} · {formatMediaDate(item.publishedAt)} ·{" "}
                    {item.duration}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 이전 / 다음 */}
        <div className="mt-16 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
          {prevGame ? (
            <Link
              href={`/games/${prevGame.slug}`}
              className="group rounded-2xl border border-border p-5 transition-colors hover:border-border-strong hover:bg-surface"
            >
              <span className="text-xs text-muted">← 이전 게임</span>
              <span className="mt-1.5 block font-[family-name:var(--font-inter-tight)] text-lg font-semibold">
                {prevGame.title}
              </span>
            </Link>
          ) : (
            <div className="hidden sm:block" />
          )}

          {nextGame && (
            <Link
              href={`/games/${nextGame.slug}`}
              className="group rounded-2xl border border-border p-5 text-right transition-colors hover:border-border-strong hover:bg-surface"
            >
              <span className="text-xs text-muted">다음 게임 →</span>
              <span className="mt-1.5 block font-[family-name:var(--font-inter-tight)] text-lg font-semibold">
                {nextGame.title}
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
