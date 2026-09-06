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
import { S, onChange } from "./core/settings.js";
import {
    sample, checkSpike, stats, mark, installDrawCounter, endFrameDraws,
} from "./core/perf.js";
import { initInput, pollInput, endFrame, input } from "./core/input.js";
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
import { initMultiplayer } from "./ui/multiplayer.js";
import { DayCycle } from "./world/dayCycle.js";
import { MonsterSystem } from "./world/monsters.js";
import { PlayerHealth, CONTACT_DAMAGE, SPELL_DAMAGE } from "./world/health.js";
import { RemotePlayers } from "./world/remotePlayers.js";
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
    // Given every system a character needs, because the other players in a room
    // *are* characters — same skeleton, same cloth, same boots in the same snow.
    // The bodies themselves are not built until a room opens.
    const remotePlayers = new RemotePlayers({
        scene, terrain, sky, shadows, spray, spells, depthPass, rig,
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
    monsters.onHit = (id, damage) => room.reportMonsterHit(id, damage);
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
                health.reset();
                remotePlayers.clear();
            }
            if (kind === "closed") figure.tintGarments(null);
        },
        onRoster: (players) => {
            roomUi.roster(players);
            // Wear your own room colour too, so the robe your friends see is
            // the colour on their nameplate and on their map.
            const me = players.find((p) => p.id === room.selfId);
            figure.tintGarments(me ? PLAYER_COLORS[me.colorIndex % PLAYER_COLORS.length] : null);
        },
        onMonsters: (wire, defeated) => {
            monsters.applySnapshot(wire);
            monsters.defeated = defeated;
        },
        onClock: (seconds) => cycle.adopt(seconds),
        onMonsterHit: (id, damage) => monsters.applyReportedHit(id, damage),
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
        monsters.update(
            dt, cycle, character.position,
            room.isHost ? room.partyPositions(character.position) : null
        );
        health.update(dt, cycle.isNight);
        if (room.duel) remotePlayers.resolveDuelHits(room, monsters.hitTest, SPELL_DAMAGE);
        // Before the terrain: their boots stage brushes into the same array
        // yours do, and the simulation pass consumes it below.
        remotePlayers.update(netDt, room, character.position);

        netAccum += netDt;
        if (room.active && netAccum >= NET_INTERVAL) {
            netAccum = 0;
            room.publishSelf(
                character.position, character.facing, character.surf,
                character.speed01, health.hp, health.downed
            );
            if (room.isHost) {
                room.publishWorld(monsters.snapshot(), cycle.elapsedSeconds, monsters.defeated);
            }
        }

        const company = remotePlayers.live;
        worldHud.update(monsters);
        vitals.update();
        nameplates.update(company, room, health);
        minimap.update(netDt, monsters, company, room);
        const tSpells = performance.now();
        terrain.update(rig.camera.position, character.position, dt);
        const tTerrain = performance.now();
        // After the shadow refit, so the figure's uniforms carry this frame's
        // cascade matrices rather than last frame's.
        figure.sync(rig.camera.position);
        remotePlayers.render(netDt, rig.camera.position);
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
        S, input, perfStats: stats,
    };
}

boot().catch((err) => {
    console.error(err);
    loading.fail("설원을 불러오지 못했어요. 새로고침하거나 다른 브라우저에서 다시 시도해주세요.");
});
