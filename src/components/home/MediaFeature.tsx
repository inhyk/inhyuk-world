import Link from "next/link";
import { VideoEmbed } from "@/components/media/VideoEmbed";
import { mediaAppearances, formatMediaDate } from "@/data/media";
import { getGameBySlug } from "@/data/games";

const [feature] = mediaAppearances;
const shorts = mediaAppearances.filter((item) => item.aspect === "portrait");
const shortsGameSlug = shorts.find((item) => item.gameSlug)?.gameSlug;
const shortsGame = shortsGameSlug ? getGameBySlug(shortsGameSlug) : undefined;

export function MediaFeature() {
  if (!feature) return null;

  const relatedGame = feature.gameSlug ? getGameBySlug(feature.gameSlug) : undefined;

  return (
    <section id="media" className="mx-auto max-w-7xl px-5 pb-20 md:px-8 md:pb-24">
      <div className="overflow-hidden rounded-3xl border border-border bg-surface p-5 md:p-8">
        <div className="grid gap-7 md:grid-cols-[1.25fr_1fr] md:items-center md:gap-10">
          <VideoEmbed
            youtubeId={feature.youtubeId}
            title={feature.title}
            thumbnail={feature.thumbnail}
            aspect={feature.aspect}
            sizes="(max-width: 768px) 100vw, 700px"
          />

          <div>
            <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">
              나온 곳
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-inter-tight)] text-[26px] leading-[1.2] font-bold tracking-[-0.025em] md:text-[32px]">
              인혁이가 인터뷰에 나왔어요
            </h2>

            <p className="mt-4 text-[15px] leading-[1.7] text-muted-strong">
              {feature.summary}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
              <a
                href={feature.outletUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-muted-strong transition-colors hover:text-foreground"
              >
                {feature.outlet}
              </a>
              <span aria-hidden="true">·</span>
              <span>{formatMediaDate(feature.publishedAt)}</span>
              <span aria-hidden="true">·</span>
              <span>{feature.duration}</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={feature.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-hover"
              >
                유튜브에서 보기
                <span aria-hidden="true">↗</span>
              </a>

              {relatedGame && (
                <Link
                  href={`/games/${relatedGame.slug}`}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-hover"
                >
                  {relatedGame.emoji} {relatedGame.title} 보러 가기
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {shorts.length > 0 ? (
        <div
          id="shorts"
          className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface p-5 md:p-8"
        >
          <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-10">
            <div>
              <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">
                개발 쇼츠
              </p>
              <h2
                id="shorts-title"
                className="mt-3 font-[family-name:var(--font-inter-tight)] text-[26px] leading-[1.2] font-bold tracking-[-0.025em] md:text-[32px]"
              >
                게임이 만들어지는 순간
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-[1.7] text-muted-strong">
                직접 만든 게임을 플레이하고, 말로 입력한 프롬프트로 기능을
                더해 가는 과정을 짧게 담았습니다.
              </p>

              {shortsGame ? (
                <Link
                  href={`/games/${shortsGame.slug}`}
                  className="mt-7 inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-hover"
                >
                  {shortsGame.emoji} {shortsGame.title} 보러 가기
                  <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </div>

            <div
              className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 lg:pb-0"
              aria-labelledby="shorts-title"
            >
              {shorts.map((item) => (
                <article
                  key={item.id}
                  className="w-[240px] shrink-0 snap-start lg:w-full lg:max-w-[280px] lg:justify-self-center"
                >
                  <VideoEmbed
                    youtubeId={item.youtubeId}
                    title={item.title}
                    thumbnail={item.thumbnail}
                    aspect={item.aspect}
                    sizes="(max-width: 1024px) 240px, 280px"
                  />
                  <h3 className="mt-4 font-[family-name:var(--font-inter-tight)] text-base leading-[1.4] font-semibold">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted">
                    {item.outlet} · {formatMediaDate(item.publishedAt)} ·{" "}
                    {item.duration}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
