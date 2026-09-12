import { Match, WALLS, SITE } from "./core.mjs";
import { createWorld } from "./scene.js";
import { GameAudio } from "./audio.js";

const $ = id => document.getElementById(id);
const canvas = $("world");
const touch = matchMedia("(pointer: coarse)").matches;
if (touch) canvas.classList.add("touch-mode");
const sound = new GameAudio();
const keys = new Set();
const pointer = { fire: false, aim: false, dragging: false };
const joystick = { x: 0, y: 0, id: null };
let match = null, world = null, lastFrame = performance.now(), lastUI = 0;
let damageFlash = 0, hitTime = 0, killTime = 0, toastTime = 0, announceTime = 0;
let sensitivity = 1, stepClock = 0, beepClock = 0;
let feed = [], previousPhase = null, lastBest = null;
let plantRequested = false;

function notify(message) {
  $("toast").textContent = message;
  toastTime = 2.3;
  $("toast").classList.add("visible");
}
function announce(kicker, title, description, duration = 0) {
  $("announcement").hidden = false;
  $("announcement-kicker").textContent = kicker;
  $("announcement-title").textContent = title;
  $("announcement-sub").textContent = description;
  announceTime = duration;
}
function inputState() {
  return {
    forward: (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - joystick.y,
    strafe: (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) + joystick.x,
    fire: pointer.fire, walk: keys.has("ShiftLeft") || keys.has("ShiftRight") || pointer.aim,
    jump: keys.has("Space"), plant: keys.has("KeyF") || plantRequested,
  };
}
function clearInput() {
  keys.clear();
  plantRequested = false;
  pointer.fire = false; pointer.aim = false; pointer.dragging = false;
  joystick.x = 0; joystick.y = 0; joystick.id = null;
  $("joystick").querySelector("i").style.transform = "";
}
function lockPointer() {
  if (touch || document.pointerLockElement === canvas) return;
  try {
    const promise = canvas.requestPointerLock();
    promise?.catch(() => notify("화면을 누른 채 마우스를 움직여 조준하세요."));
  } catch { notify("화면을 누른 채 마우스를 움직여 조준하세요."); }
}
function exitLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}
function setPaused(paused) {
  if (!match || match.phase === "finished") return;
  match.paused = paused;
  $("pause").hidden = !paused;
  clearInput();
  if (paused) exitLock();
  else { sound.unlock(); lastFrame = performance.now(); lockPointer(); }
}
function startMatch() {
  if (!world) return;
  sound.unlock();
  world.clearActors();
  match = new Match({ difficulty: $("difficulty").value, weapon: $("weapon").value });
  clearInput();
  feed = []; damageFlash = 0; previousPhase = null;
  $("killfeed").replaceChildren();
  for (const id of ["lobby", "results", "pause", "guide", "hitmarker", "kill-confirm"]) $(id).hidden = true;
  $("hud").hidden = false;
  document.body.classList.add("playing");
  lastFrame = performance.now();
  stepClock = 0; beepClock = 0;
  lockPointer();
  processEvents();
  updateHUD();
}
function backToLobby() {
  match = null;
  clearInput(); exitLock(); world.clearActors();
  for (const id of ["results", "pause", "hud"]) $(id).hidden = true;
  $("lobby").hidden = false;
  $("damage-flash").style.opacity = 0;
  $("smoke-veil").style.opacity = 0;
  document.body.classList.remove("playing");
}
function useAbility(name) {
  if (!match || match.paused) return;
  sound.unlock();
  if (!match.ability(name, inputState())) {
    const p = match.player;
    if (match.phase === "buy") notify("준비 시간이 끝나면 스킬을 사용할 수 있어요.");
    else if (name === "heal" && p.hp >= 100) notify("체력이 가득 찼습니다.");
    else if (name === "dash" && p.dash > 0) notify(`대시 재사용까지 ${Math.ceil(p.dash)}초`);
    else notify("지금은 사용할 수 없습니다.");
  }
  processEvents();
}
function beginPlant() {
  if (!match || match.paused || match.phase !== "active") return;
  if (match.spike) { notify("이미 설치했습니다. 스파이크를 지키세요."); return; }
  if (!match.canPlant) { notify("A 지점의 초록색 사각형 안에서 설치할 수 있어요."); return; }
  const input = inputState();
  if (input.forward || input.strafe || match.player.y > 0.1) { notify("이동을 멈춘 뒤 F를 눌러 설치하세요."); return; }
  plantRequested = true;
  sound.unlock();
}
function addKill(event) {
  const row = document.createElement("div");
  row.className = "feed-row";
  const killer = document.createElement("span"); killer.textContent = "YOU";
  const weapon = document.createElement("b"); weapon.textContent = `${event.weapon} ━╾`;
  const victim = document.createElement("em"); victim.textContent = `DEFENDER ${String(event.id + 1).padStart(2, "0")}`;
  row.append(killer, weapon, victim);
  if (event.head) { const head = document.createElement("small"); head.textContent = "⌖"; row.append(head); }
  $("killfeed").prepend(row);
  feed.push({ element: row, life: 5 });
  if (feed.length > 4) feed.shift().element.remove();
}
function showResults() {
  clearInput(); exitLock();
  const won = match.score[0] >= 3;
  $("results").hidden = false;
  $("result-title").textContent = won ? "VICTORY" : "DEFEAT";
  $("result-title").style.color = won ? "var(--mint)" : "var(--red)";
  $("result-description").textContent = won ? "임무 완수. 이 전장의 주인공은 당신입니다." : "한 번의 패배도 경험이 됩니다. 다시 도전하세요.";
  $("result-score").replaceChildren(document.createTextNode(String(match.score[0])));
  const separator = document.createElement("span"); separator.textContent = ":";
  $("result-score").append(separator, document.createTextNode(String(match.score[1])));
  $("result-kills").textContent = match.kills;
  $("result-headshots").textContent = match.headshots;
  $("result-accuracy").textContent = `${Math.round(match.hits / Math.max(1, match.shots) * 100)}%`;
  try {
    const key = `protocol-best-${match.difficulty}`;
    const saved = Number(localStorage.getItem(key)) || 0;
    lastBest = Math.max(saved, match.kills);
    localStorage.setItem(key, String(lastBest));
    $("best-record").textContent = `이 난이도 최고 기록 ${lastBest} 처치${match.kills > saved ? " · NEW BEST" : ""}`;
  } catch { $("best-record").textContent = "좋은 플레이였습니다. 다음 클러치에 도전하세요."; }
}
function processEvents() {
  if (!match) return;
  for (const event of match.drainEvents()) {
    if (event.type === "round") {
      plantRequested = false;
      world.clearActors();
      announce("ATTACKERS / BUY PHASE", "작전 준비", "장비 지급 완료 · 잠시 후 라운드 시작");
    }
    if (event.type === "go") {
      announce("ROUND LIVE", "장벽이 사라졌습니다", "A 지점으로 진입하세요", 1.7);
      sound.play("go");
    }
    if (event.type === "shot") {
      world.flash();
      const p = match.player;
      const origin = { x: p.x + Math.sin(p.yaw) * 0.7 + Math.cos(p.yaw) * 0.2, y: p.y + 1.4, z: p.z + Math.cos(p.yaw) * 0.7 - Math.sin(p.yaw) * 0.2 };
      world.tracer(origin, event.end);
      sound.play("shot");
    }
    if (event.type === "enemyShot") { world.tracer({ x: event.x, y: 1.25, z: event.z }, event.to, true); sound.play("enemyShot"); }
    if (event.type === "hit") {
      hitTime = 0.16;
      $("hitmarker").hidden = false;
      $("hitmarker").style.color = event.head ? "#ffddab" : "white";
      sound.play(event.head ? "headshot" : "hit");
    }
    if (event.type === "kill") {
      killTime = 1.5;
      $("kill-confirm").hidden = false;
      $("kill-label").textContent = event.head ? "HEADSHOT" : "적 처치";
      addKill(event); sound.play("kill");
    }
    if (event.type === "damage") { damageFlash = 0.65; sound.play("damage"); }
    if (["reload", "reloaded", "switch", "dash", "smoke", "heal"].includes(event.type)) sound.play(event.type);
    if (event.type === "smoke") notify("연막 전개 · 8초 동안 시야 차단");
    if (event.type === "heal") notify("회복 시작 · 체력 +50");
    if (event.type === "planted") { plantRequested = false; announce("SPIKE PLANTED", "스파이크 설치 완료", "해체를 저지하고 25초 동안 지키세요", 2.5); sound.play("go"); }
    if (event.type === "result") {
      sound.play(event.won ? "win" : "lose");
      announce(event.won ? "ROUND WON" : "ROUND LOST", event.won ? "라운드 승리" : "라운드 패배", event.reason);
      if (event.final) showResults();
    }
  }
}

const mapCtx = $("minimap").getContext("2d");
function drawMinimap() {
  if (!match) return;
  const ctx = mapCtx, scale = 4.1, px = x => 100 + x * scale, pz = z => 115 - z * scale;
  ctx.clearRect(0, 0, 200, 230);
  ctx.fillStyle = "#12252b"; ctx.fillRect(0, 0, 200, 230);
  ctx.strokeStyle = "#799d9312"; ctx.lineWidth = 1;
  for (let i = 0; i < 230; i += 20) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 230); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(200, i); ctx.stroke();
  }
  ctx.fillStyle = "#56716e"; ctx.strokeStyle = "#9bb8a688";
  for (const wall of WALLS) {
    ctx.fillRect(px(wall.x - wall.w / 2), pz(wall.z + wall.d / 2), wall.w * scale, wall.d * scale);
    ctx.strokeRect(px(wall.x - wall.w / 2), pz(wall.z + wall.d / 2), wall.w * scale, wall.d * scale);
  }
  ctx.fillStyle = "#a3f6d522"; ctx.fillRect(px(-3.5), pz(15.5), 7 * scale, 7 * scale);
  ctx.fillStyle = "#b5e4c6"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
  ctx.fillText("A", px(0), pz(12) + 5);
  for (const smoke of match.smokes) {
    ctx.fillStyle = "#c4d8e466"; ctx.beginPath(); ctx.arc(px(smoke.x), pz(smoke.z), smoke.radius * scale, 0, Math.PI * 2); ctx.fill();
  }
  if (match.spike) {
    ctx.strokeStyle = "#ff6677"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px(match.spike.x), pz(match.spike.z), 7 + Math.sin(match.time * 6) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  for (const bot of match.bots) if (bot.hp > 0 && bot.seen > 0) {
    ctx.fillStyle = "#ff5668"; ctx.beginPath(); ctx.arc(px(bot.x), pz(bot.z), 4, 0, Math.PI * 2); ctx.fill();
  }
  const p = match.player;
  ctx.save(); ctx.translate(px(p.x), pz(p.z)); ctx.rotate(p.yaw);
  ctx.fillStyle = "#a3f6d520";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 35, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#b6ffe0"; ctx.strokeStyle = "#162d30"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function updateHUD() {
  if (!match) return;
  const p = match.player;
  $("score-us").textContent = match.score[0];
  $("score-them").textContent = match.score[1];
  $("round-label").textContent = match.spike ? "SPIKE PLANTED" : `ROUND ${String(match.round).padStart(2, "0")}`;
  const time = Math.max(0, Math.ceil(match.spike ? match.spike.timer : match.timer));
  $("timer").textContent = `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
  $("timer").style.color = match.spike || (match.phase === "active" && time < 15) ? "#ff7985" : "#ece8e1";
  const dots = match.bots.map(b => b.hp > 0 ? "1" : "0").join("");
  if ($("enemy-dots").dataset.state !== dots) {
    $("enemy-dots").replaceChildren(...match.bots.map(b => { const dot = document.createElement("i"); if (b.hp <= 0) dot.className = "dead"; return dot; }));
    $("enemy-dots").dataset.state = dots;
  }
  $("health").textContent = Math.ceil(p.hp);
  $("health-fill").style.width = `${p.hp}%`;
  $("health-fill").style.background = p.hp < 30 ? "var(--red)" : "var(--mint)";
  $("armor").textContent = `◇ ${Math.ceil(p.armor)}`;
  $("ammo").textContent = match.ammo;
  $("ammo").style.color = match.ammo <= 5 ? "#ff8890" : "#ece8e1";
  $("reserve").textContent = p.reserve[p.slot - 1];
  $("weapon-name").textContent = match.weapon.name;
  $("heal-state").textContent = p.healing > 0 ? "+ HP" : p.heal;
  $("smoke-state").textContent = p.smoke;
  $("dash-state").textContent = p.dash > 0 ? `${Math.ceil(p.dash)}s` : "준비";
  for (const [name, available] of [["heal", p.heal > 0], ["smoke", p.smoke > 0], ["dash", p.dash <= 0]]) {
    document.querySelector(`[data-ability="${name}"]`).classList.toggle("unavailable", !available);
  }
  $("location").textContent = p.z < -9 ? "공격팀 진영" : p.z < 7 ? "중앙 통로" : "A 지점";
  const defusing = match.bots.some(b => b.hp > 0 && b.defuse > 0);
  const siteDistance = Math.ceil(Math.hypot(p.x - SITE.x, p.z - SITE.z));
  $("objective").textContent = match.spike ? defusing ? "⚠ 적이 스파이크를 해체하고 있습니다!" : "스파이크를 지키세요 · 적의 해체를 저지하세요" : match.canPlant ? "A 지점 도착 · 멈춘 뒤 F를 눌러 스파이크 설치" : `A 지점까지 ${siteDistance}m · 초록색 구역에서 F로 설치`;
  $("interaction").hidden = !(match.canPlant || match.plant > 0) || match.phase !== "active";
  $("interaction-label").textContent = match.plant > 0 ? `설치 중 ${(2.5 - match.plant).toFixed(1)}초 · 이동하면 취소` : touch ? "눌러 스파이크 설치 시작" : "눌러 설치 시작 · 2.5초간 유지";
  $("interaction-progress").style.width = `${match.plant / 2.5 * 100}%`;
  $("reload-progress").hidden = p.reload <= 0;
  if (p.reload > 0) $("reload-progress").firstChild.textContent = `재장전 중 · ${p.reload.toFixed(1)}s `;
  $("crosshair").style.transform = `scale(${1 + p.recoil * 0.5 + (p.moving ? 0.4 : 0)})`;
  $("crosshair").hidden = match.phase !== "active" && match.phase !== "buy";
  $("smoke-veil").style.opacity = match.smokes.some(s => Math.hypot(p.x - s.x, p.z - s.z) < s.radius * 0.92) ? "0.97" : "0";
  if (match.phase === "buy") $("announcement-sub").textContent = `${Math.ceil(match.timer)}초 후 시작 · Q 대시 / E 연막 / C 회복`;
  if (previousPhase !== match.phase) { previousPhase = match.phase; if (match.phase === "active") beepClock = 0; }
  drawMinimap();
}
function step(dt) {
  if (!match) return;
  const input = inputState();
  if (input.forward || input.strafe || input.jump || input.fire || !match.canPlant) {
    plantRequested = false;
    input.plant = keys.has("KeyF");
  }
  match.update(dt, input);
  processEvents();
  if (match.paused) return;
  damageFlash = Math.max(0, damageFlash - dt * 1.8);
  $("damage-flash").style.opacity = damageFlash;
  hitTime -= dt; killTime -= dt; toastTime -= dt;
  if (hitTime <= 0) $("hitmarker").hidden = true;
  if (killTime <= 0) $("kill-confirm").hidden = true;
  if (toastTime <= 0) $("toast").classList.remove("visible");
  if (announceTime > 0) { announceTime -= dt; if (announceTime <= 0 && match.phase === "active") $("announcement").hidden = true; }
  feed.forEach(f => { f.life -= dt; if (f.life <= 0) f.element.remove(); });
  feed = feed.filter(f => f.life > 0);
  if (match.phase === "active") {
    stepClock -= dt;
    if (match.player.moving && match.player.y === 0 && stepClock <= 0) { sound.play("step"); stepClock = inputState().walk ? 0.52 : 0.35; }
    if (match.spike) { beepClock -= dt; if (beepClock <= 0) { sound.play("beep"); beepClock = match.spike.timer < 7 ? 0.3 : 0.9; } }
  }
}

$("start").addEventListener("click", startMatch);
$("replay").addEventListener("click", startMatch);
$("resume").addEventListener("click", () => setPaused(false));
$("pause-button").addEventListener("click", () => setPaused(true));
$("quit").addEventListener("click", backToLobby);
$("back-lobby").addEventListener("click", backToLobby);
$("guide-button").addEventListener("click", () => { $("guide").hidden = false; $("close-guide").focus(); });
$("mission-tab").addEventListener("click", () => { $("guide").hidden = true; $("start").focus(); });
for (const id of ["close-guide", "guide-done"]) $(id).addEventListener("click", () => { $("guide").hidden = true; $("guide-button").focus(); });
$("retry").addEventListener("click", () => location.reload());
$("sensitivity").addEventListener("input", e => { sensitivity = Number(e.target.value); $("sensitivity-value").textContent = sensitivity.toFixed(1); });
$("sound-button").addEventListener("click", () => {
  sound.unlock(); sound.muted = !sound.muted;
  $("sound-button").textContent = sound.muted ? "SOUND OFF" : "SOUND ON";
  $("sound-button").setAttribute("aria-label", sound.muted ? "소리 켜기" : "소리 끄기");
});
document.querySelectorAll("[data-ability]").forEach(button => button.addEventListener("click", () => useAbility(button.dataset.ability)));

document.addEventListener("keydown", e => {
  if (e.code === "Escape") {
    if (!$("guide").hidden) { $("guide").hidden = true; return; }
    if (match && !document.pointerLockElement) setPaused(!match.paused);
    return;
  }
  if (!match || match.paused || match.phase === "finished") return;
  if (["Space", "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyF", "Tab"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === "KeyF") beginPlant();
  if (e.code === "KeyR") match.reload();
  if (e.code === "Digit1") match.switchWeapon(1);
  if (e.code === "Digit2") match.switchWeapon(2);
  if (e.code === "KeyQ") useAbility("dash");
  if (e.code === "KeyE") useAbility("smoke");
  if (e.code === "KeyC") useAbility("heal");
});
document.addEventListener("keyup", e => keys.delete(e.code));
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && match && !match.paused && match.phase !== "finished") setPaused(true);
});
document.addEventListener("mousemove", e => {
  if (!match || match.paused || match.phase === "finished" || touch) return;
  if (document.pointerLockElement !== canvas && !pointer.dragging) return;
  const factor = sensitivity * (pointer.aim ? 0.0013 : 0.0021);
  match.player.yaw += e.movementX * factor;
  match.player.pitch = Math.max(-1.25, Math.min(1.25, match.player.pitch + e.movementY * factor));
});
canvas.addEventListener("mousedown", e => {
  if (!match || match.paused || touch || match.phase === "finished") return;
  sound.unlock(); pointer.dragging = true;
  if (e.button === 0) { pointer.fire = true; if (!document.pointerLockElement) lockPointer(); }
  if (e.button === 2) pointer.aim = true;
});
document.addEventListener("mouseup", e => { if (e.button === 0) pointer.fire = false; if (e.button === 2) pointer.aim = false; pointer.dragging = false; });
canvas.addEventListener("contextmenu", e => e.preventDefault());
window.addEventListener("blur", () => { clearInput(); if (match && match.phase !== "finished") setPaused(true); });
document.addEventListener("visibilitychange", () => { if (document.hidden && match && match.phase !== "finished") setPaused(true); });
window.addEventListener("resize", () => world?.engine.resize());
canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); if (match) setPaused(true); $("error").hidden = false; $("error-message").textContent = "그래픽 연결이 끊어졌어요. 다시 시도해 주세요."; });

function bindHold(id, down, up) {
  const el = $(id);
  el.addEventListener("pointerdown", e => { e.preventDefault(); el.setPointerCapture(e.pointerId); if (match && !match.paused) down(); });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(event, up);
}
bindHold("touch-fire", () => { sound.unlock(); pointer.fire = true; }, () => { pointer.fire = false; });
bindHold("touch-jump", () => keys.add("Space"), () => keys.delete("Space"));
$("touch-plant").addEventListener("click", beginPlant);
$("interaction").addEventListener("click", beginPlant);
$("touch-reload").addEventListener("click", () => match?.reload());
$("joystick").addEventListener("pointerdown", e => {
  if (joystick.id !== null) return;
  e.preventDefault(); joystick.id = e.pointerId; $("joystick").setPointerCapture(e.pointerId); updateJoystick(e);
});
function updateJoystick(e) {
  if (e.pointerId !== joystick.id) return;
  const rect = $("joystick").getBoundingClientRect(), max = rect.width * 0.33;
  let x = e.clientX - rect.left - rect.width / 2, y = e.clientY - rect.top - rect.height / 2;
  const length = Math.hypot(x, y);
  if (length > max) { x *= max / length; y *= max / length; }
  if (length < max * 0.12) { x = 0; y = 0; }
  joystick.x = x / max; joystick.y = y / max;
  $("joystick").querySelector("i").style.transform = `translate(${x}px,${y}px)`;
}
$("joystick").addEventListener("pointermove", updateJoystick);
for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) $("joystick").addEventListener(event, e => {
  if (e.pointerId !== joystick.id) return;
  joystick.id = null; joystick.x = 0; joystick.y = 0; $("joystick").querySelector("i").style.transform = "";
});
let lookPointer = null;
$("look-pad").addEventListener("pointerdown", e => {
  if (lookPointer) return;
  e.preventDefault(); $("look-pad").setPointerCapture(e.pointerId); lookPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
$("look-pad").addEventListener("pointermove", e => {
  if (!lookPointer || e.pointerId !== lookPointer.id || !match || match.paused) return;
  match.player.yaw += (e.clientX - lookPointer.x) * 0.005 * sensitivity;
  match.player.pitch = Math.max(-1.25, Math.min(1.25, match.player.pitch + (e.clientY - lookPointer.y) * 0.004 * sensitivity));
  lookPointer.x = e.clientX; lookPointer.y = e.clientY;
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) $("look-pad").addEventListener(event, e => { if (lookPointer?.id === e.pointerId) lookPointer = null; });

// A read-only snapshot and fixed-step clock make browser play reproducible.
window.render_game_to_text = () => JSON.stringify(match ? {
  mode: match.paused ? "paused" : match.phase,
  coordinates: "x right/east, z forward/north, y height; yaw 0 faces +z; pitch positive looks down",
  round: match.round, score: match.score, time: Number(match.timer.toFixed(2)), difficulty: match.difficulty,
  player: { x: Number(match.player.x.toFixed(2)), z: Number(match.player.z.toFixed(2)), y: Number(match.player.y.toFixed(2)), yaw: match.player.yaw, pitch: match.player.pitch, hp: Math.ceil(match.player.hp), armor: Math.ceil(match.player.armor), weapon: match.weapon.name, ammo: match.ammo, reserve: match.player.reserve[match.player.slot - 1], reload: match.player.reload, dash: match.player.dash, smoke: match.player.smoke, heal: match.player.heal },
  enemies: match.bots.map(b => ({ id: b.id, x: Number(b.x.toFixed(2)), z: Number(b.z.toFixed(2)), hp: b.hp, defuse: b.defuse })),
  site: SITE, spike: match.spike, plantProgress: match.plant, canPlant: match.canPlant,
  smokes: match.smokes, kills: match.kills, headshots: match.headshots, shots: match.shots, hits: match.hits,
} : { mode: "lobby", ready: !!world });
window.advanceTime = milliseconds => {
  const frames = Math.max(1, Math.ceil(milliseconds / (1000 / 60)));
  for (let i = 0; i < frames; i++) step(milliseconds / frames / 1000);
  if (world) { world.update(match, 1 / 60, pointer.aim); updateHUD(); world.render(); }
  return window.render_game_to_text();
};

try {
  world = createWorld(canvas, touch);
  world.update(null, 0);
  world.render();
  $("start").disabled = false;
  $("start-label").textContent = "전장에 투입";
  if (touch) document.querySelector(".start-note").textContent = "왼쪽 스틱 이동 · 오른쪽 드래그 조준 · 가로 화면 추천";
  world.engine.runRenderLoop(() => {
    const now = performance.now(), dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    step(dt);
    world.update(match, match?.paused ? 0 : dt, pointer.aim);
    if (now - lastUI > 80) { updateHUD(); $("fps").textContent = `${Math.round(world.engine.getFps())} FPS`; lastUI = now; }
    world.render();
  });
} catch (error) {
  console.error("PROTOCOL initialization failed", error);
  $("error").hidden = false;
  $("start-label").textContent = "전장을 불러오지 못했어요";
}
