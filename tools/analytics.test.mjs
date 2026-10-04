import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

// Load the actual server modules with isolated credentials and a fake API.
function loadDashboard(env, fetch) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const exports = {};
    cache.set(filename, exports);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    runInNewContext(source, {
      exports,
      require(specifier) {
        if (specifier === "server-only") return {};
        if (specifier.startsWith("@/")) {
          return load(resolve(root, "src", specifier.slice(2) + ".ts"));
        }
        if (specifier.endsWith(".json")) {
          return require(resolve(filename, "..", specifier));
        }
        return require(specifier);
      },
      process: { env },
      fetch,
      URL,
      URLSearchParams,
    }, { filename });
    return exports;
  }
  return load(resolve(root, "src/lib/analytics/vercel.ts"));
}

test("all published games connect; internal games query only their play page", async () => {
  const calls = [];
  const dashboard = loadDashboard({
    DASHBOARD_VERCEL_TOKEN: "hub-token",
    DASHBOARD_VERCEL_TEAM_ID: "hub-team",
    DASHBOARD_MODONGSUP_VERCEL_TOKEN: "modongsup-token",
  }, async (input, options) => {
    const url = new URL(input);
    calls.push({ url, options });
    const pageviews = url.searchParams.has("filter") ? 7 : 100;
    return {
      ok: true,
      json: async () => ({ data: url.pathname.endsWith("/count")
        ? { visitors: 20, pageviews }
        : [{ timestamp: new Date().toISOString(), visitors: 2, pageviews }],
      }),
    };
  });
  const result = await dashboard.getAnalyticsDashboard();
  assert.ok(result.games.length >= 41);
  assert.ok(result.games.every((game) => game.status === "ready"));
  const embedded = result.games.filter((game) => game.pathname);
  assert.ok(embedded.length >= 12);
  assert.ok(embedded.every((game) => game.totalPageviews === 7));
  assert.equal(result.site.periodPageviews, 100);
  for (const game of embedded) {
    assert.equal(game.projectName, "inhyuk-world");
    const call = calls.find(({ url }) =>
      url.searchParams.get("filter") === `requestPath eq '${game.pathname}'`);
    assert.ok(call, `Missing path filter for ${game.slug}`);
    assert.equal(call.url.searchParams.get("teamId"), "hub-team");
    assert.equal(call.options.headers.Authorization, "Bearer hub-token");
  }
  assert.equal(embedded.find((game) => game.slug === "mettaton-ex-live").pathname, "/play/mettaton");
  assert.equal(embedded.find((game) => game.slug === "undertale-fan-game").pathname, "/play/undertale");
  const modongsup = calls.find(({ url }) => url.searchParams.get("projectId") === "modongsup");
  assert.equal(modongsup.url.searchParams.get("teamId"), "team_vtqKQtYcdLc1SLSGPcIvs2sT");
  assert.equal(modongsup.options.headers.Authorization, "Bearer modongsup-token");
  assert.equal(modongsup.url.searchParams.has("filter"), false);
});

test("failed access stays unavailable instead of showing fake zero traffic", async () => {
  const dashboard = loadDashboard({
    DASHBOARD_VERCEL_TOKEN: "hub-token",
    DASHBOARD_VERCEL_TEAM_ID: "hub-team",
  }, async (input) => {
    const url = new URL(input);
    if (url.searchParams.get("projectId") === "modongsup") {
      return { ok: false, status: 403 };
    }
    return { ok: true, json: async () => ({ data: url.pathname.endsWith("/count")
      ? { visitors: 0, pageviews: 0 } : [] }) };
  });
  const result = await dashboard.getAnalyticsDashboard();
  assert.equal(result.games.find((game) => game.slug === "modongsup").status, "unavailable");
  assert.ok(result.games.filter((game) => game.pathname).every((game) => game.status === "ready"));
  assert.ok(result.games.every((game) => game.daily.length === 30));
});

test("missing server credentials do not make API requests", async () => {
  const dashboard = loadDashboard({}, async () => {
    assert.fail("API must not be called without credentials");
  });
  const result = await dashboard.getAnalyticsDashboard();
  assert.equal(result.site.status, "not-configured");
  assert.ok(result.games.every((game) => game.status === "not-configured"));
});
