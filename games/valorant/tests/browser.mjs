import assert from "node:assert/strict";
import { chromium } from "../../../tools/node_modules/playwright/index.mjs";
import { lineOfSight } from "../src/core.mjs";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const origin = process.env.PROTOCOL_TEST_URL || "http://localhost:3000";
function monitor(page) {
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
}
const snapshot = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, ms) => page.evaluate(ms => JSON.parse(window.advanceTime(ms)), ms);
async function lookAt(page, target) {
  const state = await snapshot(page), p = state.player;
  const yaw = Math.atan2(target.x - p.x, target.z - p.z);
  const pitch = -Math.atan2(1.73 - 1.65 - p.y, Math.hypot(target.x - p.x, target.z - p.z));
  await page.evaluate(({ x, y }) => document.dispatchEvent(new MouseEvent("mousemove", { movementX: x, movementY: y, bubbles: true })), { x: (yaw - p.yaw) / 0.0021, y: (pitch - p.pitch) / 0.0021 });
}
try {
  if (process.argv.includes("--plant")) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); monitor(page);
    await page.goto(`${origin}/play/valorant/index.html`);
    await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).ready);
    await page.locator("#difficulty").selectOption("rookie");
    await page.locator("#start").click();
    await page.waitForFunction(() => document.pointerLockElement !== null);
    await page.evaluate(() => document.getElementById("sound-button").click());
    await advance(page, 5100);
    await page.keyboard.down("KeyW"); await advance(page, 5650); await page.keyboard.up("KeyW");
    await page.keyboard.down("KeyD"); await advance(page, 620); await page.keyboard.up("KeyD");
    console.log("site corner before F", JSON.stringify(await snapshot(page)));
    assert.equal((await snapshot(page)).canPlant, true, "the marked site corner must allow planting");
    await page.keyboard.press("KeyC");
    await page.keyboard.press("KeyF"); await advance(page, 2700);
    console.log("site corner after F", JSON.stringify(await snapshot(page)));
    await page.screenshot({ path: "/tmp/protocol-plant-corner.png" });
    if (!(await snapshot(page)).spike) {
      await page.keyboard.down("KeyA"); await advance(page, 620); await page.keyboard.up("KeyA");
      await page.keyboard.down("KeyW"); await advance(page, 580); await page.keyboard.up("KeyW");
      console.log("site center before F", JSON.stringify(await snapshot(page)));
      await page.keyboard.down("KeyF"); await advance(page, 2700); await page.keyboard.up("KeyF");
      console.log("site center after F", JSON.stringify(await snapshot(page)));
      await page.screenshot({ path: "/tmp/protocol-plant-center.png" });
    }
    assert.ok((await snapshot(page)).spike, "physical F key plants the spike inside A site");
    await page.close();
    assert.deepEqual(errors, []);
  } else {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); monitor(page);
  await page.goto(`${origin}/play/valorant/index.html`);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/tmp/protocol-lobby.png" });
  await page.locator("#guide-button").click();
  assert.equal(await page.locator("#guide").isVisible(), true);
  await page.locator("#guide-done").click();
  await page.locator("#difficulty").selectOption("rookie");
  await page.locator("#start").click();
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.evaluate(() => document.getElementById("sound-button").click());
  await advance(page, 5200);
  assert.equal((await snapshot(page)).mode, "active");
  await page.keyboard.down("KeyW"); await advance(page, 700); await page.keyboard.up("KeyW");
  assert.ok((await snapshot(page)).player.z > -15);
  await page.screenshot({ path: "/tmp/protocol-arena.png" });
  await page.keyboard.press("KeyQ");
  assert.ok((await snapshot(page)).player.dash > 11);
  await page.keyboard.press("KeyE");
  assert.equal((await snapshot(page)).smokes.length, 1);
  await page.keyboard.press("Digit2");
  assert.equal((await snapshot(page)).player.weapon, "CLASSIC");
  await page.keyboard.press("Digit1");
  await advance(page, 300);
  await page.evaluate(() => document.getElementById("world").dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true })));
  await advance(page, 330);
  await page.evaluate(() => document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true })));
  assert.ok((await snapshot(page)).player.ammo < 25);
  await page.keyboard.press("KeyR"); await advance(page, 2200);
  assert.equal((await snapshot(page)).player.ammo, 25);
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === "paused");
  const paused = await snapshot(page);
  await advance(page, 4000);
  const stillPaused = await snapshot(page);
  assert.deepEqual(stillPaused.player, paused.player);
  assert.equal(stillPaused.time, paused.time);
  await page.locator("#resume").click();
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await advance(page, 300);
  await page.screenshot({ path: "/tmp/protocol-gameplay.png" });
  let capturedCombat = false;
  for (let i = 0; i < 430; i++) {
    let state = await snapshot(page);
    if (state.mode === "finished") break;
    if (state.mode === "buy" || state.mode === "roundEnd") { await advance(page, 500); continue; }
    if (state.mode === "paused") throw new Error("unexpected pause during combat");
    const visible = state.enemies.filter(b => b.hp > 0 && lineOfSight(state.player, b));
    if (visible.length) {
      visible.sort((a, b) => Math.hypot(a.x - state.player.x, a.z - state.player.z) - Math.hypot(b.x - state.player.x, b.z - state.player.z));
      await lookAt(page, visible[0]);
      await page.evaluate(() => document.getElementById("world").dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true })));
      await advance(page, 190);
      await page.evaluate(() => document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true })));
      state = await snapshot(page);
      if (!capturedCombat && state.kills > 0) { await page.screenshot({ path: "/tmp/protocol-combat.png" }); capturedCombat = true; }
    } else await advance(page, 300);
    if ((await snapshot(page)).player.ammo < 3) { await page.keyboard.press("KeyR"); await advance(page, 2200); }
  }
  const final = await snapshot(page);
  console.log("desktop result", JSON.stringify(final));
  assert.equal(final.mode, "finished");
  assert.equal(final.score[0], 3);
  assert.ok(final.kills >= 9);
  assert.ok(final.headshots >= 3);
  assert.equal(await page.locator("#results").isVisible(), true);
  await page.screenshot({ path: "/tmp/protocol-results.png" });
  await page.locator("#replay").click();
  assert.equal((await snapshot(page)).score[0], 0);
  assert.equal((await snapshot(page)).round, 1);
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === "paused");
  await page.locator("#quit").click();
  assert.equal((await snapshot(page)).mode, "lobby");
  console.log("desktop controls, full match, restart, and pause passed");
  await page.close();

  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const mobile = await context.newPage(); monitor(mobile);
  await mobile.goto(`${origin}/play/valorant/index.html`);
  await mobile.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).ready);
  await mobile.screenshot({ path: "/tmp/protocol-mobile-lobby.png" });
  await mobile.locator("#difficulty").selectOption("rookie");
  await mobile.locator("#start").tap();
  await mobile.evaluate(() => document.getElementById("sound-button").click());
  await advance(mobile, 5200);
  assert.equal(await mobile.locator("#touch-controls").isVisible(), true);
  const cdp = await context.newCDPSession(mobile);
  const stick = await mobile.locator("#joystick").boundingBox(), fire = await mobile.locator("#touch-fire").boundingBox();
  const touches = [
    { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2 - 25, id: 1 },
    { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 2 },
  ];
  const beforeMove = await snapshot(mobile);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touches });
  await advance(mobile, 600);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const moved = await snapshot(mobile);
  assert.ok(moved.player.z > beforeMove.player.z + 1);
  assert.ok(moved.shots > 0);
  await advance(mobile, 100);
  assert.equal((await snapshot(mobile)).player.z, moved.player.z);
  const look = await mobile.locator("#look-pad").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: look.x + 80, y: look.y + 30, id: 3 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: look.x + 120, y: look.y + 35, id: 3 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.ok((await snapshot(mobile)).player.yaw > moved.player.yaw + 0.1);
  await mobile.locator("[data-ability='smoke']").tap();
  assert.equal((await snapshot(mobile)).player.smoke, 1);
  await mobile.screenshot({ path: "/tmp/protocol-mobile-gameplay.png" });
  await mobile.locator("#pause-button").tap();
  assert.equal((await snapshot(mobile)).mode, "paused");
  await mobile.locator("#quit").tap();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.screenshot({ path: "/tmp/protocol-mobile-portrait.png" });
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log("mobile multitouch movement, firing, look, ability, pause, and responsive layout passed");
  await context.close();

  const wrapper = await browser.newPage(); monitor(wrapper);
  const response = await wrapper.goto(`${origin}/play/valorant`);
  assert.equal(response.status(), 200);
  const frame = wrapper.frameLocator("iframe[title*='PROTOCOL']");
  await frame.locator("#start").waitFor();
  await frame.locator("#start").click();
  const gameFrame = wrapper.frames().find(f => f.url().includes("index.html"));
  assert.ok(gameFrame);
  await gameFrame.waitForFunction(() => document.pointerLockElement !== null);
  assert.equal(await frame.locator("#hud").isVisible(), true);
  console.log("Next.js route and iframe pointer lock passed");
  await wrapper.close();
  assert.deepEqual(errors, []);
  console.log("No browser console or runtime errors.");
  }
} finally {
  await browser.close();
}
