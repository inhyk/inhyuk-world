// 진짜 브라우저 여러 개로 snowflow 온라인을 net 서버에 붙여 보는 검사.
// node --test 로 돌지 않는다(파일 이름이 *.test.js 가 아님). 쓰는 법:
//   1) services/net 에서 로컬 서버: npx wrangler dev --port 8791 --ip 127.0.0.1 (README "로컬에서 돌리기")
//   2) npm run snowflow:dev (http://127.0.0.1:5173)
//   3) cd tools && npm ci, 그다음
//      SNOWFLOW_URL=http://127.0.0.1:5173/ NET=http://127.0.0.1:8791 PLAYERS=3 node games/snowflow/tests/online-check.mjs
//   NET 을 비우면 진짜 서버(wss://net.seonn.workers.dev)에 붙는다. 임시 방과 요청 횟수 제한 기록이 생기므로 로컬 검사를 기본으로 한다.
//   SHOTS=폴더 를 주면 그 폴더에 스크린숏을 남긴다.
import { chromium } from "../../../tools/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";

const base = process.env.SNOWFLOW_URL || "http://127.0.0.1:5173/";
const net = process.env.NET || "";
const players = Math.max(2, Math.min(4, Number(process.env.PLAYERS) || 3));
const shots = process.env.SHOTS || "";
const prefix = process.env.SHOT_PREFIX || "net-snowflow";
const url = net ? `${base}?net=${encodeURIComponent(net)}` : base;
const log = (...a) => console.log("[online-check]", ...a);

// 보낸 net 메시지를 시각과 함께 센다(핑은 서버 한도에 들지 않으므로 따로).
const countSends = () => {
    const sent = [];
    window.__netSent = sent;
    const original = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
        if (typeof data === "string" && data.startsWith('{"t":"send"')) sent.push([performance.now(), new TextEncoder().encode(data).length]);
        return original.call(this, data);
    };
};

const browser = await chromium.launch({
    channel: "chrome", headless: true,
    args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=metal", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
});
const errors = [];
const pages = [];
try {
    for (let i = 0; i < players; i++) {
        const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
        await context.addInitScript(countSends);
        const page = await context.newPage();
        page.on("pageerror", (e) => errors.push(`${i}: ${e.message}`));
        page.on("console", (m) => {
            if (m.type() === "error" || m.text().includes("[snowflow net]")) errors.push(`${i}: ${m.text()}`);
        });
        await page.goto(url);
        pages.push(page);
    }
    for (const page of pages) await page.waitForFunction(() => globalThis.SNOWFLOW?.room, null, { timeout: 90000 });
    log(`${players} pages booted`);

    const [host, ...guests] = pages;
    const room = (page, fn) => page.evaluate(fn);

    // 방장: 이름 적고 방 만들기
    await host.fill("#room-name", "방장");
    await host.click("#room-create");
    await host.waitForFunction(() => SNOWFLOW.room.active && SNOWFLOW.room.code.length === 6, null, { timeout: 20000 });
    const code = await room(host, () => SNOWFLOW.room.code);
    assert.equal(await host.textContent("#room-code-value"), code);
    log("room", code);

    // 친구들: 코드로 참가
    for (const [i, guest] of guests.entries()) {
        await guest.fill("#room-name", `친구${i + 1}`);
        await guest.fill("#room-code", code.toLowerCase());
        await guest.click("#room-join");
    }
    for (const page of pages) {
        await page.waitForFunction((n) => SNOWFLOW.room.active && SNOWFLOW.room.count === n, players, { timeout: 20000 });
    }
    const names = await room(guests[0], () => [...SNOWFLOW.room.players.values()].map((p) => p.name));
    assert.deepEqual(names.sort(), ["방장", ...guests.map((_, i) => `친구${i + 1}`)].sort());
    log("everyone joined:", names.join(", "));

    // 모두 설원에 들어가 앞으로 걷는다(시간이 흐르고 몸이 움직인다)
    const pos = (page) => page.evaluate(() => [SNOWFLOW.character.position.x, SNOWFLOW.character.position.z]);
    const before = await Promise.all(pages.map(pos));
    for (const page of pages) {
        await page.click("#start-button");
        await page.keyboard.down("KeyW");
    }
    await host.waitForTimeout(3000);

    // 방장의 대전 모드가 모두에게 간다
    await host.click("#room-duel", { force: true }).catch(() => host.evaluate(() => SNOWFLOW.room.setDuel(true)));
    if (!(await room(host, () => SNOWFLOW.room.duel))) await host.evaluate(() => SNOWFLOW.room.setDuel(true));
    for (const guest of guests) await guest.waitForFunction(() => SNOWFLOW.room.duel === true, null, { timeout: 5000 });
    log("duel mode reached every guest");

    // 사건: 친구1의 마법과 눈덩이가 다른 모두에게, 몬스터 명중 보고는 방장에게
    for (const page of pages) {
        await page.evaluate(() => {
            const r = SNOWFLOW.room;
            window.__got = { cast: 0, ball: 0, hit: 0, hurt: 0 };
            for (const [hook, key] of [["onCast", "cast"], ["onBall", "ball"], ["onMonsterHit", "hit"], ["onHurt", "hurt"]]) {
                const inner = r.hooks[hook];
                r.hooks[hook] = (...a) => { window.__got[key]++; return inner?.(...a); };
            }
        });
    }
    const caster = guests[0];
    const target = guests[1] ?? host;
    const targetId = await room(target, () => SNOWFLOW.room.selfId);
    await caster.evaluate((id) => {
        const r = SNOWFLOW.room;
        for (let i = 0; i < 25; i++) { r.castSpell(1, [0.6, 0, 0.8]); r.throwBall([0, 3, 0, 1, 4, 1]); r.reportMonsterHit(0, 1, "m"); }
        r.sendPlayerDamage(id, 1);
    }, targetId);
    await host.waitForTimeout(1500);
    const got = await Promise.all(pages.map((p) => p.evaluate(() => window.__got)));
    log("events received per page:", JSON.stringify(got));
    for (const [i, g] of got.entries()) {
        if (pages[i] === caster) { assert.equal(g.cast, 0); continue; }
        assert.equal(g.cast, 25, `page ${i} casts`);
        assert.equal(g.ball, 25, `page ${i} balls`);
    }
    assert.equal(got[0].hit, 25, "host got every hit report");
    assert.equal(got[pages.indexOf(target)].hurt, 1, "duel damage reached its target");

    // 몸 상태: 방장이 본 친구 위치 = 친구 자신의 위치, 친구가 본 방장 위치 = 방장 위치
    await host.waitForTimeout(500);
    const where = (page) => page.evaluate(() => ({
        id: SNOWFLOW.room.selfId,
        me: [SNOWFLOW.character.position.x, SNOWFLOW.character.position.z],
        clock: SNOWFLOW.cycle.elapsedSeconds,
        seen: Object.fromEntries(SNOWFLOW.room.others.filter((o) => o.hasState).map((o) => [o.id, [o.state[0], o.state[2]]])),
    }));
    const views = await Promise.all(pages.map(where));
    for (const a of views) {
        for (const b of views) {
            if (a === b) continue;
            const seen = a.seen[b.id];
            assert.ok(seen, `${a.id} sees ${b.id}`);
            const d = Math.hypot(seen[0] - b.me[0], seen[1] - b.me[1]);
            assert.ok(d < 3, `${a.id} sees ${b.id} within 3m (off by ${d.toFixed(2)})`);
        }
    }
    for (const g of views.slice(1)) assert.ok(Math.abs(g.clock - views[0].clock) < 2, `clock ${g.clock} vs host ${views[0].clock}`);
    const moved = views.map((v, i) => Math.hypot(v.me[0] - before[i][0], v.me[1] - before[i][1]));
    for (const m of moved) assert.ok(m > 1, `walked ${m.toFixed(2)}m`);
    log("positions agree; walked (m):", moved.map((m) => m.toFixed(1)).join(", "), "; clocks:", views.map((v) => v.clock.toFixed(1)).join(", "));

    if (shots) {
        await host.screenshot({ path: `${shots}/${prefix}-host.png` });
        await guests[0].screenshot({ path: `${shots}/${prefix}-guest.png` });
    }

    // 보낸 횟수: 1초 창에서 가장 많이 보낸 순간
    await host.waitForTimeout(4000);
    const rates = await Promise.all(pages.map((p) => p.evaluate(() => {
        const t = window.__netSent.map((s) => s[0]);
        let peak = 0;
        for (let i = 0, j = 0; i < t.length; i++) { while (t[i] - t[j] > 1000) j++; peak = Math.max(peak, i - j + 1); }
        const span = (t.at(-1) - t[0]) / 1000 || 1;
        const biggest = Math.max(...window.__netSent.map((s) => s[1]));
        return { total: t.length, avg: +(t.length / span).toFixed(1), peak, biggest };
    })));
    log("send rate per page:", JSON.stringify(rates));
    for (const r of rates) {
        assert.ok(r.total > 0 && Number.isFinite(r.biggest), "rate check must observe actual game packets");
        assert.ok(r.peak < 30, `peak ${r.peak}/s`);
        assert.ok(r.biggest < 16 * 1024, `biggest ${r.biggest} bytes`);
    }

    for (const page of pages) await page.keyboard.up("KeyW");

    // 나가기: 마지막 친구가 나가면 모두의 명단에서 빠진다
    if (guests.length >= 2) {
        const leaver = guests.at(-1);
        await leaver.click("#room-leave", { force: true }).catch(() => leaver.evaluate(() => SNOWFLOW.room.leave()));
        if (await room(leaver, () => SNOWFLOW.room.active)) await leaver.evaluate(() => SNOWFLOW.room.leave());
        for (const page of pages.slice(0, -1)) {
            await page.waitForFunction((n) => SNOWFLOW.room.count === n, players - 1, { timeout: 5000 });
        }
        log("a guest left; everyone else's roster shrank to", players - 1);
    }

    // 방장이 창을 닫으면 남은 친구에게 방이 끝났다고 알린다
    await host.close();
    await guests[0].waitForFunction(() => !SNOWFLOW.room.active, null, { timeout: 40000 });
    const status = await guests[0].textContent("#room-status");
    log("after host closed the tab, guest sees:", status);
    assert.match(status, /방장이 나가서/);
    if (shots) await guests[0].screenshot({ path: `${shots}/${prefix}-host-left.png` });

    const real = errors.filter((e) => !/favicon|WebGPU timestamp|GPU stall/i.test(e));
    if (real.length) log("page errors:", real);
    assert.equal(real.filter((e) => e.includes("[snowflow net]")).length, 0, "server dropped nothing");
    log("PASS");
} finally {
    await browser.close();
}
