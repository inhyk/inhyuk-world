import "server-only";

import {
  analyticsGameProjects,
  type AnalyticsGameProject,
} from "@/lib/analytics/projects";

const ANALYTICS_API_URL =
  "https://api.vercel.com/v1/query/web-analytics/visits";
const SITE_PROJECT_NAME = "inhyuk-world";
const REPORTING_DAYS = 30;
const CACHE_SECONDS = 60 * 60;

export type AnalyticsStatus =
  | "ready"
  | "not-configured"
  | "disabled"
  | "unavailable"
  | "error";

export interface DailyTraffic {
  date: string;
  visitors: number;
  pageviews: number;
}

export interface ProjectTraffic extends AnalyticsGameProject {
  status: AnalyticsStatus;
  daily: DailyTraffic[];
  todayVisitors: number;
  todayPageviews: number;
  totalPageviews: number;
  visitorDays: number;
}

export interface SiteTraffic {
  status: AnalyticsStatus;
  daily: DailyTraffic[];
  todayVisitors: number;
  todayPageviews: number;
  periodVisitors: number | null;
  periodPageviews: number;
}

export interface AnalyticsDashboardData {
  generatedAt: string;
  period: {
    since: string;
    until: string;
    days: number;
  };
  site: SiteTraffic;
  games: ProjectTraffic[];
}

interface AnalyticsAggregateResponse {
  data: Array<{
    timestamp: string;
    visitors: number;
    pageviews: number;
  }>;
}

interface AnalyticsCountResponse {
  data: {
    visitors: number;
    pageviews: number;
  };
}

class AnalyticsRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Vercel Analytics request failed with status ${status}`);
  }
}

function createReportingPeriod(now = new Date()) {
  const until = new Date(now);
  until.setUTCHours(23, 59, 59, 999);

  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - (REPORTING_DAYS - 1));
  since.setUTCHours(0, 0, 0, 0);

  const dates = Array.from({ length: REPORTING_DAYS }, (_, index) => {
    const date = new Date(since);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });

  return { since, until, dates };
}

function getStatus(error: unknown): AnalyticsStatus {
  if (!(error instanceof AnalyticsRequestError)) return "error";
  if (error.status === 400 || error.status === 402) return "disabled";
  if (error.status === 401 || error.status === 403 || error.status === 404) {
    return "unavailable";
  }
  return "error";
}

function emptyDailyTraffic(dates: string[]): DailyTraffic[] {
  return dates.map((date) => ({ date, visitors: 0, pageviews: 0 }));
}

function normalizeDailyTraffic(
  data: AnalyticsAggregateResponse["data"],
  dates: string[]
): DailyTraffic[] {
  const valuesByDate = new Map(
    data.map((item) => [
      item.timestamp.slice(0, 10),
      {
        visitors: Number.isFinite(item.visitors) ? item.visitors : 0,
        pageviews: Number.isFinite(item.pageviews) ? item.pageviews : 0,
      },
    ])
  );

  return dates.map((date) => ({
    date,
    visitors: valuesByDate.get(date)?.visitors ?? 0,
    pageviews: valuesByDate.get(date)?.pageviews ?? 0,
  }));
}

async function requestAnalytics<T>(
  path: "aggregate" | "count",
  projectName: string,
  since: Date,
  until: Date
): Promise<T> {
  const token = process.env.DASHBOARD_VERCEL_TOKEN;
  const teamId = process.env.DASHBOARD_VERCEL_TEAM_ID;
  if (!token || !teamId) throw new AnalyticsRequestError(401);

  const params = new URLSearchParams({
    projectId: projectName,
    since: since.toISOString(),
    until: until.toISOString(),
    teamId,
  });

  if (path === "aggregate") {
    params.set("by", "day");
    params.set("limit", String(REPORTING_DAYS));
  }

  const response = await fetch(`${ANALYTICS_API_URL}/${path}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: {
      revalidate: CACHE_SECONDS,
      tags: [`analytics:${projectName}:${path}`],
    },
  });

  if (!response.ok) throw new AnalyticsRequestError(response.status);
  return (await response.json()) as T;
}

function hasAnalyticsCredentials() {
  return Boolean(
    process.env.DASHBOARD_VERCEL_TOKEN &&
      process.env.DASHBOARD_VERCEL_TEAM_ID
  );
}

async function getDailyTraffic(
  projectName: string,
  since: Date,
  until: Date,
  dates: string[]
) {
  const response = await requestAnalytics<AnalyticsAggregateResponse>(
    "aggregate",
    projectName,
    since,
    until
  );

  if (!Array.isArray(response.data)) throw new AnalyticsRequestError(502);
  return normalizeDailyTraffic(response.data, dates);
}

async function getSiteTraffic(
  since: Date,
  until: Date,
  dates: string[]
): Promise<SiteTraffic> {
  try {
    const countUntil = new Date(until);
    countUntil.setUTCDate(countUntil.getUTCDate() + 1);
    countUntil.setUTCHours(0, 0, 0, 0);

    const [dailyResult, countResult] = await Promise.allSettled([
      getDailyTraffic(SITE_PROJECT_NAME, since, until, dates),
      requestAnalytics<AnalyticsCountResponse>(
        "count",
        SITE_PROJECT_NAME,
        since,
        countUntil
      ),
    ]);
    if (dailyResult.status === "rejected") throw dailyResult.reason;

    const daily = dailyResult.value;
    const today = daily.at(-1);
    const periodPageviews = daily.reduce(
      (sum, item) => sum + item.pageviews,
      0
    );

    return {
      status: "ready",
      daily,
      todayVisitors: today?.visitors ?? 0,
      todayPageviews: today?.pageviews ?? 0,
      periodVisitors:
        countResult.status === "fulfilled"
          ? countResult.value.data.visitors
          : null,
      periodPageviews:
        countResult.status === "fulfilled"
          ? countResult.value.data.pageviews
          : periodPageviews,
    };
  } catch (error) {
    const daily = emptyDailyTraffic(dates);
    return {
      status: hasAnalyticsCredentials() ? getStatus(error) : "not-configured",
      daily,
      todayVisitors: 0,
      todayPageviews: 0,
      periodVisitors: null,
      periodPageviews: 0,
    };
  }
}

async function getGameTraffic(
  project: AnalyticsGameProject,
  since: Date,
  until: Date,
  dates: string[]
): Promise<ProjectTraffic> {
  if (!project.projectName) {
    return {
      ...project,
      status: "unavailable",
      daily: emptyDailyTraffic(dates),
      todayVisitors: 0,
      todayPageviews: 0,
      totalPageviews: 0,
      visitorDays: 0,
    };
  }

  try {
    const daily = await getDailyTraffic(
      project.projectName,
      since,
      until,
      dates
    );
    const today = daily.at(-1);
    const totals = daily.reduce(
      (sum, item) => ({
        pageviews: sum.pageviews + item.pageviews,
        visitorDays: sum.visitorDays + item.visitors,
      }),
      { pageviews: 0, visitorDays: 0 }
    );

    return {
      ...project,
      status: "ready",
      daily,
      todayVisitors: today?.visitors ?? 0,
      todayPageviews: today?.pageviews ?? 0,
      totalPageviews: totals.pageviews,
      visitorDays: totals.visitorDays,
    };
  } catch (error) {
    return {
      ...project,
      status: hasAnalyticsCredentials() ? getStatus(error) : "not-configured",
      daily: emptyDailyTraffic(dates),
      todayVisitors: 0,
      todayPageviews: 0,
      totalPageviews: 0,
      visitorDays: 0,
    };
  }
}

export async function getAnalyticsDashboard(): Promise<AnalyticsDashboardData> {
  const { since, until, dates } = createReportingPeriod();

  const sitePromise = getSiteTraffic(since, until, dates);
  const gamesPromise = Promise.all(
    analyticsGameProjects.map((project) =>
      getGameTraffic(project, since, until, dates)
    )
  );
  const [site, games] = await Promise.all([sitePromise, gamesPromise]);

  return {
    generatedAt: new Date().toISOString(),
    period: {
      since: dates[0],
      until: dates.at(-1) ?? dates[0],
      days: REPORTING_DAYS,
    },
    site,
    games,
  };
}
