import { GameTrafficCharts } from "@/components/analytics/GameTrafficCharts";
import { TrafficChart } from "@/components/analytics/TrafficChart";
import { getAnalyticsDashboard } from "@/lib/analytics/vercel";

function formatNumber(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export async function AnalyticsDashboard() {
  const dashboard = await getAnalyticsDashboard();
  const connectedGames = dashboard.games.filter(
    (game) => game.status === "ready"
  ).length;
  const hasSiteData = dashboard.site.status === "ready";

  const summaryCards = [
    {
      label: "오늘 방문자",
      value: hasSiteData ? dashboard.site.todayVisitors : null,
      suffix: "명",
    },
    {
      label: "30일 방문자",
      value: dashboard.site.periodVisitors,
      suffix: "명",
    },
    {
      label: "30일 페이지뷰",
      value: hasSiteData ? dashboard.site.periodPageviews : null,
      suffix: "회",
    },
    {
      label: "집계 중인 게임",
      value: connectedGames,
      suffix: `/${dashboard.games.length}`,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 md:px-8">
      {!hasSiteData ? (
        <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-5 py-4 text-sm leading-relaxed text-amber-100/80">
          방문 데이터 연결을 준비하고 있습니다. 계측이 배포된 게임부터 수치가
          순서대로 표시됩니다.
        </div>
      ) : null}

      <section aria-label="통계 요약" className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border bg-surface p-5 md:p-6"
          >
            <p className="text-xs text-muted">{card.label}</p>
            <p className="mt-2 font-[family-name:var(--font-inter-tight)] text-[28px] font-extrabold tracking-[-0.035em] md:text-[34px]">
              {formatNumber(card.value)}
              <span className="ml-1 text-sm font-medium tracking-normal text-muted">
                {card.suffix}
              </span>
            </p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-surface p-5 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
              사이트 트래픽
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-inter-tight)] text-2xl font-bold tracking-[-0.025em]">
              일별 방문자 추이
            </h2>
          </div>
          <p className="text-xs text-muted">
            {dashboard.period.since} – {dashboard.period.until}
          </p>
        </div>

        <div className="mt-7">
          <TrafficChart data={dashboard.site.daily} />
        </div>
      </section>

      <div className="mt-6">
        <GameTrafficCharts games={dashboard.games} />
      </div>

      <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6 text-xs leading-relaxed text-muted md:flex-row md:items-center md:justify-between">
        <p>
          방문자는 Vercel이 쿠키 없이 하루 단위 익명값으로 계산합니다. 여러
          게임의 방문자 수는 서로 중복될 수 있으며 일별 경계는 UTC 기준입니다.
        </p>
        <p className="shrink-0">
          {formatGeneratedAt(dashboard.generatedAt)} 갱신 · 매시간 업데이트
        </p>
      </div>
    </div>
  );
}

export function AnalyticsDashboardFallback() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-5 pb-24 md:px-8">
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-28 rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
      <div className="mt-6 h-[420px] rounded-3xl border border-border bg-surface" />
    </div>
  );
}
