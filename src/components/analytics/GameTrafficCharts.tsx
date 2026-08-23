import Link from "next/link";
import type {
  AnalyticsStatus,
  ProjectTraffic,
} from "@/lib/analytics/vercel";

interface GameTrafficChartsProps {
  games: ProjectTraffic[];
}

const statusLabels: Record<AnalyticsStatus, string> = {
  ready: "집계 중",
  "not-configured": "서버 연결 전",
  disabled: "Analytics 활성화 전",
  unavailable: "프로젝트 연결 필요",
  error: "갱신 실패",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function GameTrafficCharts({ games }: GameTrafficChartsProps) {
  const sortedGames = games.toSorted((a, b) => {
    if (a.status === "ready" && b.status !== "ready") return -1;
    if (a.status !== "ready" && b.status === "ready") return 1;
    if (b.totalPageviews !== a.totalPageviews) {
      return b.totalPageviews - a.totalPageviews;
    }
    return a.title.localeCompare(b.title, "ko");
  });
  const maxPageviews = Math.max(
    1,
    ...sortedGames.map((game) => game.totalPageviews)
  );
  const recentDates = games[0]?.daily.slice(-7).map((item) => item.date) ?? [];
  const maxDailyVisitors = Math.max(
    1,
    ...games.flatMap((game) =>
      game.daily.slice(-7).map((item) => item.visitors)
    )
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-border bg-surface p-5 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
              게임별 순위
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-inter-tight)] text-2xl font-bold tracking-[-0.025em]">
              최근 30일 페이지뷰
            </h2>
          </div>
          <p className="text-xs text-muted">오늘 방문자 · 누적 조회</p>
        </div>

        <div className="mt-7 space-y-3">
          {sortedGames.map((game) => (
            <div key={game.slug} className="group relative overflow-hidden rounded-2xl border border-border bg-background/45">
              {game.status === "ready" ? (
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500/16 to-fuchsia-500/8 transition-[width]"
                  style={{
                    width: `${Math.max(
                      game.totalPageviews > 0 ? 4 : 0,
                      (game.totalPageviews / maxPageviews) * 100
                    )}%`,
                  }}
                  aria-hidden="true"
                />
              ) : null}

              <Link
                href={`/games/${game.slug}`}
                className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="text-xl" aria-hidden="true">
                    {game.emoji}
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground/90 transition-colors group-hover:text-white">
                    {game.title}
                  </span>
                </span>

                {game.status === "ready" ? (
                  <span className="flex items-baseline gap-3 text-right">
                    <span className="text-xs text-muted">
                      오늘 {formatNumber(game.todayVisitors)}명
                    </span>
                    <span className="min-w-12 text-sm font-semibold tabular-nums">
                      {formatNumber(game.totalPageviews)}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-muted">
                    {statusLabels[game.status]}
                  </span>
                )}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-5 md:p-7">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
            일별 접속
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-inter-tight)] text-2xl font-bold tracking-[-0.025em]">
            게임별 최근 7일
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            색이 진할수록 그날 방문자가 많습니다.
          </p>
        </div>

        <div className="mt-7 overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-[minmax(150px,1fr)_repeat(7,36px)] gap-2 px-2 text-center text-[10px] text-muted">
              <span className="text-left">게임</span>
              {recentDates.map((date) => (
                <span key={date}>{formatShortDate(date)}</span>
              ))}
            </div>

            <div className="mt-3 space-y-1.5">
              {sortedGames.map((game) => (
                <div
                  key={game.slug}
                  className="grid grid-cols-[minmax(150px,1fr)_repeat(7,36px)] items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.03]"
                >
                  <span className="truncate text-xs text-muted-strong">
                    {game.emoji} {game.title}
                  </span>
                  {game.daily.slice(-7).map((item) => {
                    const intensity = item.visitors / maxDailyVisitors;
                    return (
                      <span
                        key={item.date}
                        className="flex h-8 items-center justify-center rounded-lg text-[11px] font-medium tabular-nums text-white/85"
                        style={{
                          backgroundColor:
                            game.status === "ready"
                              ? `rgba(129, 140, 248, ${0.08 + intensity * 0.82})`
                              : "rgba(255, 255, 255, 0.025)",
                        }}
                        title={`${game.title} ${formatShortDate(item.date)} 방문자 ${item.visitors}명`}
                      >
                        {game.status === "ready" ? item.visitors : "–"}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
