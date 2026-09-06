/**
 * SNOWFLOW — entry point and frame orchestration.
 *
 * WebGPU only, by design. No WebGL path, no feature-detect branches: if the
 * adapter isn't there we say so once and stop.
 */

import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
// Side-effect import: installs `captureGPUFrameTime` / `getGPUFrameTimeCounter`
// onto the engine prototype, which is what makes the overlay's GPU row a real
// GPU number rather than the presentation cadence.
import "@babylonjs/core/Engines/AbstractEngine/abstractEngine.timeQuery";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";

import { registerShaders } from "./shaders/registry.js";
import { S, onChange, set as setSetting } from "./core/settings.js";
import {
    sample, checkSpike, stats, mark, installDrawCounter, endFrameDraws,
} from "./core/perf.js";
import { initInput, pollInput, endFrame, input, startInput } from "./core/input.js";
import { CameraRig } from "./core/camera.js";
import { CharacterController } from "./character/controller.js";
import { Character } from "./character/character.js";
import { SnowContact } from "./character/snowContact.js";
import { SprayField } from "./vfx/particles.js";
import { SurfWake } from "./vfx/surfWake.js";
import { SpellSystem } from "./spells/spellSystem.js";
import { Overlay } from "./ui/overlay.js";
import { initExperience } from "./ui/experience.js";
import { initWorldHud } from "./ui/worldHud.js";
import { initVitalsHud } from "./ui/vitalsHud.js";
import { initNameplates } from "./ui/nameplates.js";
import { initMinimap } from "./ui/minimap.js";
import { initMatchHud } from "./ui/matchHud.js";
import { initMultiplayer } from "./ui/multiplayer.js";
import { DayCycle } from "./world/dayCycle.js";
import { MonsterSystem } from "./world/monsters.js";
import {
    PlayerHealth, CONTACT_DAMAGE, BITE_DAMAGE, SPELL_DAMAGE, SNOWBALL_DAMAGE,
} from "./world/health.js";
import { RemotePlayers } from "./world/remotePlayers.js";
import { SnowballFight } from "./world/snowballFight.js";
import { SnowballSystem } from "./world/snowball.js";
import { Scarecrows } from "./world/scarecrows.js";
import { FrostWhirls } from "./world/frostWhirls.js";
import { Music } from "./audio/music.js";
import { Room, PLAYER_COLORS } from "./net/room.js";
import { Sky } from "./render/sky.js";
import { ShadowSystem } from "./render/shadows.js";
import { Terrain } from "./terrain/terrain.js";
import { DepthPass } from "./render/depthPass.js";
import { PostChain } from "./post/postChain.js";
import { whenReady } from "./core/gpuUtil.js";
import * as loading from "./core/loading.js";

// ------------------------------------------------------- module-scope scratch
const _vel = new Vector3();

/**
 * Network send rate. Fifteen a second is the point where the easing in
 * `RemotePlayers` stops having to invent anything: a mage at full surf speed
 * moves 1.3 m between packets, which the thirteen-per-second damp closes
 * inside two frames.
 */
const NET_INTERVAL = 1 / 15;

/**
 * Everything a snowball can hit, rebuilt each frame into one reused array.
 * `id` is empty for anything that is not a player, which is also how the
 * ballistics knows a body is not allowed to hit itself.
 */
const _targets = [];
const _targetPool = [];
function slot(i) {
    return _targetPool[i] || (_targetPool[i] = {
        id: "", kind: "", index: 0, x: 0, y: 0, z: 0, rise: 0, radius: 0,
    });
}

async function boot() {
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("view"));

    if (!navigator.gpu) {
        loading.fail("이 브라우저에서는 WebGPU를 사용할 수 없어요.");
        return;
    }

    await loading.phase("creating device", 0.05);

    const engine = new WebGPUEngine(canvas, {
        antialias: false, // TAA handles edges; MSAA here would just cost bandwidth
        stencil: false,
        powerPreference: "high-performance",
        enableAllFeatures: true,
        setMaximumLimits: true,
    });

    try {
        await engine.initAsync();
    } catch (err) {
        console.error(err);
        loading.fail("그래픽 장치를 시작하지 못했어요. 그래픽 가속 설정을 확인해주세요.");
        return;
    }

    // The heightfield is R32F and is filtered in the vertex shader, which needs
    // this feature. Every desktop GPU that can run this demo has it.
    const filterable = engine.getCaps().textureFloatLinearFiltering;
    if (!filterable) {
        console.warn("[snowflow] float32-filterable unavailable; height will step");
    }

    const applyScale = () => engine.setHardwareScalingLevel(1 / S.resolutionScale);
    applyScale();
    onChange("resolutionScale", applyScale);
    window.addEventListener("resize", () => engine.resize());

    installDrawCounter(engine);
    // WebGPU timestamp queries. The engine is created with `enableAllFeatures`,
    // so `timestamp-query` is on wherever the adapter has it; if it does not,
    // the counter simply stays at zero and the overlay shows a dash.
    engine.captureGPUFrameTime(true);
    registerShaders();

    await loading.phase("building scene", 0.12);

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.02, 0.03, 0.05, 1);
    scene.autoClear = true;
    // Do NOT clear depth between rendering groups. Babylon clears depth before
    // every group by default; here group 1 is the opaque scene and group 2 is
    // the alpha-blended water and spray, which must depth-test against it.
    scene.setRenderingAutoClearDepthStencil(1, false);
    scene.setRenderingAutoClearDepthStencil(2, false);
    // No stock lights: every material here computes its own lighting.
    scene.ambientColor = new Color3(0, 0, 0);

    const rig = new CameraRig(scene, canvas);
    scene.activeCamera = rig.camera;

    // ------------------------------------------------------------------ sky
    await loading.phase("integrating atmosphere", 0.2);
    const sky = new Sky(scene);
    sky.mesh.renderingGroupId = 0;
    await sky.solve();

    // -------------------------------------------------------------- shadows
    const shadows = new ShadowSystem(scene);

    // The camera-space depth prepass. It is a custom render target, and the
    // scene renders those in registration order — so creating it here, after
    // the cascades and before anything that draws, is the whole of the
    // scheduling.
    const depthPass = new DepthPass(scene);

    // -------------------------------------------------------------- terrain
    await loading.phase("baking heightfield", 0.34);
    const terrain = new Terrain(scene, sky, shadows);
    terrain.mesh.renderingGroupId = 1;
    await terrain.build();
    onChange("showTerrain", (v) => (terrain.mesh.isVisible = v));
    depthPass.registerCaster(terrain.mesh, terrain.makePrepassMaterial());

    await loading.phase("placing character", 0.62);

    const character = new CharacterController(terrain);
    character.position.set(0, 0, 0);
    character.position.y = terrain.heightAt(0, 0);

    // The figure: skeleton, garment simulation, shell fur.
    const figure = new Character(scene, terrain, sky, shadows, character);
    onChange("showCharacter", (v) => figure.setVisible(v));
    figure.registerPrepass(depthPass);

    // Airborne snow: footfall kick now, the surf plume and spell spray later.
    const spray = new SprayField(scene, terrain, sky, shadows);

    // Feet and the surf groove write into the terrain state buffer through here.
    const contact = new SnowContact(character, terrain.deform, figure.figure, spray);

    // The breaking wave, its bow crest and the plume it sheds.
    const wake = new SurfWake(scene, sky, shadows, character, spray, terrain);
    onChange("showWake", (v) => wake.setEnabled(v));
    wake.registerPrepass(depthPass);

    // The nine spells, the water body they bend and the ice they leave. Every
    // one of them writes into the same terrain state buffer the feet and the
    // wake do, and lights the snow through the same four-slot pool.
    const spells = new SpellSystem(
        scene, sky, shadows, terrain, character, figure.figure, rig, spray
    );
    // Every surface a spell can light.
    spells.addConsumers(
        terrain.material, figure.bodyMat, figure.clothMat,
        wake.material, spray.material
    );
    spells.registerPrepass(depthPass);

    const cycle = new DayCycle();
    const worldHud = initWorldHud(cycle);

    // Your own hit points, and everyone else's bodies. Both are declared before
    // the shadows because a shadow reaching you is now an event that spends one
    // and is aimed at the other.
    const health = new PlayerHealth({
        onEvent: (kind) => {
            if (kind === "down") rig.addTrauma(0.7);
            if (kind === "revive") worldHud.announce("revive");
        },
    });
    const room = new Room();
    /** Last announced duel setting, so a flip is only called out once. */
    let duelWas = false;
    // Given every system a character needs, because the other players in a room
    // *are* characters — same skeleton, same cloth, same boots in the same snow.
    // The bodies themselves are not built until a room opens.
    const remotePlayers = new RemotePlayers({
        scene, terrain, sky, shadows, spray, spells, depthPass, rig,
    });

    const scarecrows = new Scarecrows(scene, terrain, sky, rig, depthPass);
    const snowballs = new SnowballSystem({
        scene, terrain, sky, rig, spray, depthPass,
        onImpact: (ball, target) => onBallImpact(ball, target),
    });
    const match = new SnowballFight({
        onEvent: (kind, detail) => {
            if (kind === "countdown") worldHud.announce("matchSoon");
            if (kind === "go") {
                worldHud.announce("matchGo");
                // Scarecrows are what makes this worth playing on your own.
                // With someone else in the room, they are the target.
                if (!room.active || room.count < 2) scarecrows.deploy(character.position);
            }
            if (kind === "finish" || kind === "off") {
                scarecrows.clear();
                snowballs.clear();
            }
            if (kind === "hit" && detail?.bonus) rig.addTrauma(0.10);
        },
    });

    const monsters = new MonsterSystem(scene, terrain, rig, spells, depthPass, (event) => {
        if (event === "contact") {
            // The knockback always happens; the damage only lands outside the
            // grace window, and the notice only fires when the damage does.
            const taken = health.damage(CONTACT_DAMAGE, "contact");
            rig.addTrauma(taken > 0 ? 0.34 : 0.18);
            if (taken === 0) return;
        }
        worldHud.announce(event);
    });
    monsters.onHit = (id, damage) => room.reportMonsterHit(id, damage, "m");
    // Every local cast goes out as one message; every friend's comes back as one.
    spells.onCast = (key, params) => room.castSpell(key, params);

    // The dawn. Same pool shape and wire format as the wraiths, opposite in
    // every other way — quick, single-point, and circling rather than closing.
    const whirls = new FrostWhirls(scene, terrain, sky, rig, spells, spray, depthPass, (event) => {
        if (event === "bite") {
            const taken = health.damage(BITE_DAMAGE, "contact");
            rig.addTrauma(taken > 0 ? 0.26 : 0.14);
            if (taken === 0) return;
        }
        // A shove from a whirl has already been announced as a bite.
        if (event === "contact") return;
        worldHud.announce(event);
    });
    whirls.onHit = (id, damage) => room.reportMonsterHit(id, damage, "w");

    // The score. Built on the first gesture, because a browser will not let a
    // page make a sound before someone has asked it to.
    const music = new Music();
    const unlockMusic = () => { void music.unlock(); };
    document.addEventListener("pointerdown", unlockMusic, { passive: true });
    document.addEventListener("keydown", unlockMusic);
    document.addEventListener("snowflow:input", () => { if (input.active) unlockMusic(); });

    const musicButton = document.getElementById("music-button");
    const musicState = document.getElementById("music-state");
    const syncMusicButton = () => {
        musicButton.setAttribute("aria-pressed", String(S.music !== false));
        musicState.textContent = S.music !== false ? "켬" : "끔";
    };
    musicButton.addEventListener("click", () => setSetting("music", S.music === false));
    onChange("music", syncMusicButton);
    syncMusicButton();

    /**
     * A snowball has finished its flight — anyone's snowball, because every
     * client simulates every ball. Only the thrower scores it, and only the
     * body that was hit reacts to being hit.
     *
     * @param {any} ball @param {any|null} target
     */
    function onBallImpact(ball, target) {
        const kind = target ? target.kind : "";
        if (kind === "monster" && ball.mine) {
            // A snowball is a nuisance, not a spell: one point of the two a
            // wraith carries. The host still decides whether it died.
            if (monsters.remote) room.reportMonsterHit(target.index, 1, "m");
            else monsters.applyReportedHit(target.index, 1);
        }
        if (kind === "whirl" && ball.mine) {
            // One point is all a whirl has. This is the throw's hour.
            if (whirls.remote) room.reportMonsterHit(target.index, 1, "w");
            else whirls.applyReportedHit(target.index, 1);
        }
        if (kind === "self") {
            rig.addTrauma(0.28);
            if (!match.active && room.duel) health.damage(SNOWBALL_DAMAGE, "spell");
            worldHud.announce(match.active ? "snowballed" : "spell");
        }
        if (!ball.mine) return;
        let scored = false;
        if (kind === "scarecrow") scored = scarecrows.knock(target);
        else if (kind === "player" || kind === "monster" || kind === "whirl") scored = true;
        if (scored && kind === "player") worldHud.announce("landed");
        match.resolve(scored);
    }

    /** Refill the hit list: me, everyone else, every shadow, every scarecrow. */
    function buildTargets() {
        _targets.length = 0;
        let n = 0;
        const me = slot(n++);
        me.id = room.selfId || "me";
        me.kind = "self";
        me.x = character.position.x; me.y = character.position.y; me.z = character.position.z;
        me.rise = 0.9; me.radius = 0.5;
        _targets.push(me);

        for (const other of remotePlayers.live) {
            const t = slot(n++);
            t.id = other.id;
            t.kind = "player";
            t.x = other.x; t.y = other.y; t.z = other.z;
            t.rise = 0.9; t.radius = 0.5;
            _targets.push(t);
        }
        for (const m of monsters.monsters) {
            if (!m.active || m.hp <= 0 || m.age < 0.8) continue;
            const t = slot(n++);
            t.id = "";
            t.kind = "monster";
            t.index = m.id;
            t.x = m.x; t.y = m.y; t.z = m.z;
            t.rise = 1.35; t.radius = 1.0;
            _targets.push(t);
        }
        for (const w of whirls.monsters) {
            if (!w.active || w.hp <= 0 || w.age < whirls.windup) continue;
            const t = slot(n++);
            t.id = "";
            t.kind = "whirl";
            t.index = w.id;
            t.x = w.x; t.y = w.y; t.z = w.z;
            t.rise = 1.0; t.radius = 0.9;
            _targets.push(t);
        }
        scarecrows.collect(_targets);
        return _targets;
    }
    const syncClock = () => cycle.tick(performance.now(), input.active && !S.freezeTime);
    document.addEventListener("snowflow:input", syncClock);
    onChange("freezeTime", syncClock);

    // The rig needs ground heights to keep the spring arm above the snow.
    rig.groundAt = (x, z) => terrain.heightAt(x, z);

    const post = new PostChain(scene, rig.camera, depthPass, sky);

    const overlay = new Overlay({ rig, character });
    const experience = initExperience(canvas, overlay);
    initInput(canvas, { onToggleOverlay: experience.toggleSettings });

    const vitals = initVitalsHud(health);
    const nameplates = initNameplates(scene, engine, rig);
    // Bakes the relief image on construction, which is why it happens here —
    // behind the loading screen, and after the heightfield readback it reads.
    const minimap = initMinimap({ terrain, character, rig });
    // Building three more characters is awaited before a room reports itself
    // open, so nobody's first sight of a friend is a compile hitch.
    const roomUi = initMultiplayer(room, { prepare: () => remotePlayers.provision() });
    const matchHud = initMatchHud(match);

    // One button, whether you are alone, hosting, or a guest asking the host.
    document.getElementById("match-start").addEventListener("click", () => {
        if (room.active && !room.isHost) room.requestMatch(true);
        else match.start();
        void startInput(canvas);
    });
    // The room is built before the panel that drives it, so its hooks are
    // attached here — one place where every message from the wire is turned
    // into something in the world.
    room.hooks = {
        onStatus: (kind, detail) => {
            roomUi.status(kind, detail);
            if (kind === "open" || kind === "closed") {
                // Joining and leaving are both a fresh start: the shadows on
                // screen belonged to whichever simulation you just left.
                monsters.clear();
                whirls.clear();
                health.reset();
                remotePlayers.clear();
                snowballs.reset();
                match.stop();
            }
            if (kind === "closed") {
                figure.tintGarments(null);
                duelWas = false;
            }
        },
        onRoster: (players) => {
            roomUi.roster(players);
            // The mode is broadcast with the roster, so this is where a guest
            // finds out the host flipped it. Nobody should have to work out
            // from a spell passing through a friend that the rules changed.
            if (room.duel !== duelWas) {
                duelWas = room.duel;
                worldHud.announce(room.duel ? "duelOn" : "duelOff");
            }
            // Wear your own room colour too, so the robe your friends see is
            // the colour on their nameplate and on their map.
            const me = players.find((p) => p.id === room.selfId);
            figure.tintGarments(me ? PLAYER_COLORS[me.colorIndex % PLAYER_COLORS.length] : null);
            snowballs.selfId = room.selfId || "me";
            snowballs.colorIndex = me ? me.colorIndex : 0;
            match.keepOnly(new Set(players.map((p) => p.id).filter((id) => id !== room.selfId)));
        },
        onBall: (wire, from) => {
            const thrower = room.players.get(from);
            snowballs.accept(wire, from, thrower ? thrower.colorIndex : 0);
        },
        onCast: (key, params, from) => remotePlayers.castFor(from, key, params),
        onMatch: (phase, timer) => match.adopt(phase, timer),
        onMatchRequest: (want) => { if (want) match.start(); },
        onMonsters: (wire, defeated) => {
            monsters.applySnapshot(wire);
            monsters.defeated = defeated;
        },
        onClock: (seconds) => cycle.adopt(seconds),
        onMonsterHit: (id, damage, kind) => {
            if (kind === "w") whirls.applyReportedHit(id, damage);
            else monsters.applyReportedHit(id, damage);
        },
        onWhirls: (wire, defeated) => {
            whirls.applySnapshot(wire);
            whirls.defeated = defeated;
        },
        onHurt: (damage) => {
            if (health.damage(damage, "spell") > 0) {
                rig.addTrauma(0.35);
                worldHud.announce("spell");
            }
        },
    };

    // ------------------------------------------------------------- warm-up
    // Everything that can compile, compiles here — behind the loading screen.
    await loading.phase("compiling pipelines", 0.78);
    shadows.update(rig.camera, sky.sunDir);
    sky.render(rig, 0);
    await terrain.warmUp();
    terrain.update(rig.camera.position, character.position, 0);
    figure.update(0);
    figure.sync(rig.camera.position);
    await figure.warmUp();
    spray.update(0, rig.camera.position);
    await spray.warmUp();
    await wake.warmUp();
    await spells.warmUp(
        character.position.x + 3, character.position.y, character.position.z + 3
    );
    await monsters.warmUp();
    await snowballs.warmUp();
    await scarecrows.warmUp();
    await whirls.warmUp();
    await whenReady(sky.material, "sky material", [sky.mesh, false]);
    await depthPass.warmUp();
    post.update(0, 0, rig.distance);
    const passes = post.passes;
    for (let i = 0; i < passes.length; i++) {
        await whenReady(passes[i], "post:" + passes[i].name);
    }

    await loading.phase("warming render targets", 0.92);
    // A few real frames so every render target is allocated and every pipeline
    // has actually been bound at least once.
    for (let i = 0; i < 3; i++) {
        scene.render();
        await loading.nextFrame();
    }
    // Only now: the spell meshes had to be standing *through* those frames for
    // their render pipelines to exist. See `WaterBody.warmUp`.
    spells.finishWarmUp();

    // ------------------------------------------------------------- run loop
    let prev = performance.now();
    let time = 0;
    let netAccum = 0;

    engine.runRenderLoop(() => {
        const now = performance.now();
        // The clock reads uncapped wall time. Physics still uses a bounded step.
        cycle.tick(now, input.active && !S.freezeTime);
        let dtMs = now - prev;
        prev = now;
        if (dtMs > 100) dtMs = 100;
        const dt = S.freezeTime || !input.active ? 0 : dtMs / 1000;
        // The other mages are not paused by *your* welcome card, so everything
        // that answers the wire runs on wall time rather than on the sim step.
        const netDt = dtMs / 1000;
        time += dt;

        pollInput();

        // Per-system CPU timing. Babylon's WebGPU timestamp queries are
        // whole-frame, so the GPU row is a total and these are not subdivisions
        // of it — the overlay labels them `cpu` for that reason.
        const tFrame = performance.now();

        // Lying in the snow is a full stop, not a slide: a zero step is the
        // controller's own idle path, so the body holds its ground and its
        // momentum until it gets up.
        character.update(health.downed ? 0 : dt, rig);
        terrain.heightfield.clampToPlayArea(character.position);
        // Pose and simulate before the contact pass: the footprints are stamped
        // at the boot's actual planted position, which only exists once the
        // figure has been solved.
        figure.update(dt);
        contact.update(dt);
        const tChar = performance.now();

        _vel.copyFrom(character.velocity);
        rig.update(dt, character.position, _vel, character.lean, character.speed01);

        // Jitters the projection and republishes everything the screen-space
        // passes derive from the camera. Must be after the rig has moved and
        // before anything reads `scene.getTransformMatrix()` — which the depth
        // prepass and the beauty pass both do.
        post.update(dt, character.streak01, rig.distance);
        sky.update();
        sky.nightAmount = cycle.nightAmount;
        sky.render(rig, time);
        shadows.update(rig.camera, sky.sunDir);
        // After the shadow refit, so the water and the ice carry this frame's
        // cascade matrices; before the terrain, so the brushes every spell
        // writes are in the staging array when the simulation pass runs.
        spells.update(dt, rig.camera.position);
        // In a room the host owns the shadows and the clock; a guest renders
        // them and reports what its own spells land.
        monsters.remote = room.active && !room.isHost;
        whirls.remote = monsters.remote;
        const party = room.isHost ? room.partyPositions(character.position) : null;
        monsters.update(dt, cycle, character.position, party);
        whirls.update(dt, cycle, character.position, party);
        health.update(dt, cycle.isNight);
        match.update(dt);
        scarecrows.update(dt, character.position);
        // Digging, winding up and letting go. Before the ballistics, so a ball
        // thrown this frame flies this frame.
        snowballs.aimAndThrow(dt, { controller: character, figure: figure.figure, room });
        snowballs.update(dt, buildTargets());
        if (room.duel) {
            remotePlayers.resolveDuelHits(
                room, monsters.hitTest, SPELL_DAMAGE, () => worldHud.announce("landed")
            );
        }
        // Before the terrain: their boots stage brushes into the same array
        // yours do, and the simulation pass consumes it below.
        remotePlayers.update(netDt, room, character.position, rig.camera.position);
        // After every system that can declare a light has run this frame.
        spells.applyLights();

        netAccum += netDt;
        if (room.active && netAccum >= NET_INTERVAL) {
            netAccum = 0;
            room.publishSelf(
                character.position, character.facing, character.surf,
                character.speed01, health.hp, health.downed, 0, match.score, rig.forward
            );
            if (room.isHost) {
                room.publishWorld(
                    monsters.snapshot(), cycle.elapsedSeconds, monsters.defeated, match,
                    whirls.snapshot(), whirls.defeated
                );
            }
            // Other people's scores ride along with their bodies, so a dropped
            // packet costs a scoreboard refresh and never a point.
            for (const other of room.others) {
                if (!other.hasState) continue;
                match.post(other.id, other.name, other.colorIndex, other.state[8] | 0);
            }
        }

        const company = remotePlayers.live;
        worldHud.update(monsters, room.duel, whirls);
        vitals.update();
        matchHud.update(match.standings(room.name || "나", snowballs.colorIndex), snowballs);

        // What the music needs to know. `threat` is creatures close enough to
        // matter, 0..1 — the drone tremor and the low pulse follow it.
        let near = 0;
        for (const m of monsters.monsters) {
            if (m.active && m.hp > 0 &&
                Math.hypot(m.x - character.position.x, m.z - character.position.z) < 28) near++;
        }
        for (const w of whirls.monsters) {
            if (w.active && w.hp > 0 &&
                Math.hypot(w.x - character.position.x, w.z - character.position.z) < 28) near++;
        }
        music.update({
            hour: cycle.hour, nightAmount: cycle.nightAmount,
            speed01: character.speed01, surf: character.surf,
            threat: Math.min(1, near / 4),
            matchRunning: match.running,
            lowHealth: health.fraction < 0.3 && !health.downed,
            paused: !input.active,
        });
        nameplates.update(company, room, health);
        minimap.update(netDt, monsters, company, room, whirls);
        const tSpells = performance.now();
        terrain.update(rig.camera.position, character.position, dt);
        const tTerrain = performance.now();
        // After the shadow refit, so the figure's uniforms carry this frame's
        // cascade matrices rather than last frame's.
        figure.sync(rig.camera.position);
        remotePlayers.render(netDt, rig.camera.position);
        snowballs.render({ controller: character, figure: figure.figure });
        // Before the spray: the wake decides where its own lip is, and the
        // grains it sheds have to be in the pool before the pool is uploaded.
        wake.update(dt, rig.camera.position);
        spray.update(dt, rig.camera.position);
        const tVfx = performance.now();

        scene.render();
        post.endFrame();
        const tRender = performance.now();

        mark("cpu character", tChar - tFrame);
        mark("cpu spells", tSpells - tChar);
        mark("cpu terrain", tTerrain - tSpells);
        mark("cpu wake+spray", tVfx - tTerrain);
        mark("cpu submit", tRender - tVfx);
        mark("cpu total", tRender - tFrame);
        stats.gpuMs = engine.getGPUFrameTimeCounter().lastSecAverage / 1e6;

        endFrameDraws();
        stats.triangles =
            (terrain.mesh.metadata ? terrain.mesh.metadata.triangles : 0) +
            (S.showCharacter ? figure.triangles : 0) +
            (wake.mesh.isVisible ? wake.mesh.metadata.triangles : 0) +
            remotePlayers.triangles +
            spells.triangles +
            spray.liveCount * 2;

        sample(dtMs);
        checkSpike(dtMs);
        overlay.update(dtMs, engine);

        endFrame();
    });

    await loading.done();
    setTimeout(() => overlay.resetSpikes(), 800);

    globalThis.SNOWFLOW = {
        engine, scene, rig, character, figure, contact, spray, wake, spells,
        overlay, terrain, sky, shadows, post, depthPass,
        cycle, monsters, health, room, remotePlayers, minimap,
        match, snowballs, scarecrows, whirls, music,
        S, input, perfStats: stats,
    };
}

boot().catch((err) => {
    console.error(err);
    loading.fail("설원을 불러오지 못했어요. 새로고침하거나 다른 브라우저에서 다시 시도해주세요.");
});
