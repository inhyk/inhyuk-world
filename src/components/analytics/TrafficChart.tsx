import type { DailyTraffic } from "@/lib/analytics/vercel";

interface TrafficChartProps {
  data: DailyTraffic[];
}

const WIDTH = 920;
const HEIGHT = 300;
const MARGIN = { top: 24, right: 24, bottom: 42, left: 48 };
const INNER_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function createPath(
  data: DailyTraffic[],
  key: "visitors" | "pageviews",
  maxValue: number
) {
  if (data.length === 0) return "";

  return data
    .map((item, index) => {
      const x =
        MARGIN.left +
        (data.length === 1 ? 0 : (index / (data.length - 1)) * INNER_WIDTH);
      const y =
        MARGIN.top + INNER_HEIGHT - (item[key] / maxValue) * INNER_HEIGHT;
      return `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`;
    })
    .join(" ");
}

export function TrafficChart({ data }: TrafficChartProps) {
  const hasTraffic = data.some(
    (item) => item.visitors > 0 || item.pageviews > 0
  );
  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => [item.visitors, item.pageviews])
  );
  const visitorPath = createPath(data, "visitors", maxValue);
  const pageviewPath = createPath(data, "pageviews", maxValue);
  const tickCount = Math.min(5, Math.max(2, Math.floor(maxValue) + 1));
  const tickValues = Array.from({ length: tickCount }, (_, index) =>
    Math.round((maxValue * (tickCount - 1 - index)) / (tickCount - 1))
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-5 text-xs text-muted-strong">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#a78bfa]" />
          방문자
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#38bdf8]" />
          페이지뷰
        </span>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="min-w-[680px]"
          role="img"
          aria-labelledby="traffic-chart-title traffic-chart-description"
        >
          <title id="traffic-chart-title">최근 30일 사이트 방문 추이</title>
          <desc id="traffic-chart-description">
            날짜별 방문자 수와 페이지 조회 수를 나타낸 선 그래프
          </desc>
          <defs>
            <linearGradient id="visitor-line" x1="0" x2="1">
              <stop offset="0" stopColor="#818cf8" />
              <stop offset="1" stopColor="#f472b6" />
            </linearGradient>
          </defs>

          {tickValues.map((value, index) => {
            const y =
              MARGIN.top + (index / (tickValues.length - 1)) * INNER_HEIGHT;
            return (
              <g key={`${value}-${index}`}>
                <line
                  x1={MARGIN.left}
                  x2={WIDTH - MARGIN.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                />
                <text
                  x={MARGIN.left - 12}
                  y={y + 4}
                  fill="rgba(245,245,247,0.42)"
                  fontSize="11"
                  textAnchor="end"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {data.map((item, index) => {
            if (index % 5 !== 0 && index !== data.length - 1) return null;
            const x =
              MARGIN.left +
              (data.length === 1
                ? 0
                : (index / (data.length - 1)) * INNER_WIDTH);
            return (
              <text
                key={item.date}
                x={x}
                y={HEIGHT - 12}
                fill="rgba(245,245,247,0.42)"
                fontSize="11"
                textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
              >
                {formatDate(item.date)}
              </text>
            );
          })}

          <path
            d={pageviewPath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={visitorPath}
            fill="none"
            stroke="url(#visitor-line)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {data.map((item, index) => {
            const x =
              MARGIN.left +
              (data.length === 1
                ? 0
                : (index / (data.length - 1)) * INNER_WIDTH);
            const y =
              MARGIN.top +
              INNER_HEIGHT -
              (item.visitors / maxValue) * INNER_HEIGHT;
            return (
              <circle
                key={item.date}
                cx={x}
                cy={y}
                r="3.5"
                fill="#a78bfa"
                stroke="#101015"
                strokeWidth="2"
              >
                <title>{`${formatDate(item.date)} 방문자 ${item.visitors}명, 페이지뷰 ${item.pageviews}회`}</title>
              </circle>
            );
          })}
        </svg>
        {!hasTraffic ? (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted">
            계측을 시작했습니다. 방문 데이터가 들어오면 그래프가 채워집니다.
          </p>
        ) : null}
      </div>

      <table className="sr-only">
        <caption>최근 30일 사이트 방문 통계</caption>
        <thead>
          <tr>
            <th>날짜</th>
            <th>방문자</th>
            <th>페이지뷰</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.date}>
              <td>{item.date}</td>
              <td>{item.visitors}</td>
              <td>{item.pageviews}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
