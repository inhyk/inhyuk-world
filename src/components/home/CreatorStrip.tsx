import Link from "next/link";
import { games } from "@/data/games";

export function CreatorStrip() {
  const techCount = new Set(games.flatMap((g) => g.techStack)).size;
  const genreCount = new Set(games.map((g) => g.category)).size;

  const stats = [
    { value: `${games.length}개`, label: "만든 게임" },
    { value: `${genreCount}개`, label: "도전한 장르" },
    { value: `${techCount}개`, label: "써 본 기술" },
  ];

  return (
    <section
      className="mx-auto max-w-7xl px-5 pb-24 md:px-8"
      aria-label="만든 사람"
    >
      <div className="overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="grid gap-0 md:grid-cols-2">
          {/* 비주얼 */}
          <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden md:min-h-[300px]">
            <div className="mesh absolute inset-0 opacity-90" />
            <div className="relative flex flex-wrap items-center justify-center gap-4 px-6 text-5xl md:text-6xl">
              <span
                className="drop-shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
                aria-hidden="true"
              >
                🎮
              </span>
              <span
                className="drop-shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
                aria-hidden="true"
              >
                🕹️
              </span>
              <span
                className="drop-shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
                aria-hidden="true"
              >
                🚀
              </span>
            </div>
          </div>

          {/* 텍스트 */}
          <div className="flex flex-col justify-center p-7 md:p-10">
            <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">
              만든 사람
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-inter-tight)] text-[26px] font-bold tracking-[-0.025em] md:text-[32px]">
              상상한 걸 직접 만듭니다
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-[1.7] text-muted-strong">
              JavaScript와 Python으로 게임을 만드는 초등학생 게임 개발자
              인혁입니다. 떠오른 아이디어를 바로 플레이할 수 있는 게임으로
              옮기는 걸 좋아합니다.
            </p>

            <div className="mt-7 flex flex-wrap gap-8">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="font-[family-name:var(--font-inter-tight)] text-2xl font-bold tracking-[-0.02em]">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{stat.label}</p>
                </div>
              ))}
            </div>

            <Link
              href="/about"
              className="mt-8 inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-hover"
            >
              더 알아보기
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
