// Renderer, post-processing chain and frame loop.
// Chain: Render (MSAA, half float) → GTAO (high only) → Bloom → Output (AgX tone map, sRGB) → Finish (vignette, grain).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { setAnisotropy } from './tex.js';

const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.32 }, uGrain: { value: 0.025 }, uFade: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uSharpen: { value: 0.18 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uFade, uSharpen; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 px = 1.0 / uRes;
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec3 blur = (texture2D(tDiffuse, vUv + vec2(px.x,0.)).rgb + texture2D(tDiffuse, vUv - vec2(px.x,0.)).rgb
                 + texture2D(tDiffuse, vUv + vec2(0.,px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.,px.y)).rgb) * 0.25;
      c = clamp(c + (c - blur) * uSharpen, 0.0, 1.0);
      vec2 d = vUv - 0.5; d.x *= uRes.x / uRes.y;
      c *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(d));
      c += (h(vUv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;
      c = mix(c, vec3(0.0), uFade);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class Engine {
  constructor(canvas, { quality = 'high' } = {}) {
    this.canvas = canvas;
    this.quality = quality;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    // the sun's shadow map is drawn once per frame (start() asks for it); left on auto, the GTAO
    // normal pass drew every shadow caster a second time
    r.shadowMap.autoUpdate = false;
    this.renderer = r;
    setAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));

    this.scene = new THREE.Scene();
    // the scene itself never moves; left on, it made every object recompute its world matrix each frame
    this.scene.matrixAutoUpdate = false;
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 2400);
    this.updaters = new Set();
    this.lateUpdaters = new Set();
    this.elapsed = 0;
    this.frameMs = 16;
    this.maxRatio = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.5 : 1);
    this.ratio = this.maxRatio;
    this._slow = 0; this._fast = 0;
    this.buildComposer();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  buildComposer() {
    const r = this.renderer, high = this.quality === 'high';
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: high ? 4 : 2 });
    this.composer?.dispose?.();
    const c = new EffectComposer(r, rt);
    c.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = null;
    if (high) {
      const g = new GTAOPass(this.scene, this.camera, size.x, size.y);
      g.output = GTAOPass.OUTPUT.Default;
      g.blendIntensity = 0.85;
      g.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
      g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      // AO is soft, so it is worked out at half resolution (a quarter of the pixels) and blended
      // over the full-size picture
      const setSize = g.setSize.bind(g);
      g.setSize = (w, h) => setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
      g.setSize(size.x, size.y);
      // the normal/depth pass only draws what is near: far buildings, trees and the ground add no
      // corner shadow you could see from inside a room (engine.aoHide lists what to leave out)
      g._overrideVisibility = () => {
        const cache = g._visibilityCache;
        if (!this._lines || this._linesAge-- <= 0) {
          this._lines = [];
          this._linesAge = 120;
          this.scene.traverse((o) => { if (o.isPoints || o.isLine || o.isLine2) this._lines.push(o); });
        }
        for (const o of this._lines) if (o.visible) { o.visible = false; cache.push(o); }
        for (const o of this.aoHide?.(this.camera.position) ?? []) if (o.visible) { o.visible = false; cache.push(o); }
      };
      c.addPass(g);
      this.gtao = g;
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.5, 2.2);
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.finish = new ShaderPass(FinishShader);
    c.addPass(this.finish);
    this.composer = c;
  }

  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this.maxRatio = Math.min(window.devicePixelRatio || 1, q === 'high' ? 1.5 : 1);
    this.ratio = this.maxRatio;
    this.buildComposer();
    this.resize();
    this.onQuality?.(q);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.ratio);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.finish.uniforms.uRes.value.set(w * this.ratio, h * this.ratio);
  }

  /** fn(dt, elapsed) every frame before rendering. late=true runs after normal updaters (cameras). */
  onUpdate(fn, late = false) { (late ? this.lateUpdaters : this.updaters).add(fn); return () => (late ? this.lateUpdaters : this.updaters).delete(fn); }

  set fade(v) { this.finish.uniforms.uFade.value = v; }
  get fade() { return this.finish.uniforms.uFade.value; }

  /** Dynamic resolution: keep ~50+ fps by stepping the pixel ratio. */
  adapt(ms) {
    this.frameMs = this.frameMs * 0.95 + ms * 0.05;
    if (this.frameMs > 24) this._slow++; else this._slow = 0;
    if (this.frameMs < 13) this._fast++; else this._fast = 0;
    if (this._slow > 90 && this.ratio > 0.6) { this.ratio = Math.max(0.6, this.ratio - 0.15); this._slow = 0; this.resize(); }
    if (this._fast > 240 && this.ratio < this.maxRatio) { this.ratio = Math.min(this.maxRatio, this.ratio + 0.1); this._fast = 0; this.resize(); }
  }

  start() {
    let last = performance.now();
    const tick = (now) => {
      requestAnimationFrame(tick);
      const ms = now - last;
      last = now;
      const dt = Math.min(0.1, ms / 1000);
      this.elapsed += dt;
      for (const fn of this.updaters) fn(dt, this.elapsed);
      for (const fn of this.lateUpdaters) fn(dt, this.elapsed);
      this.finish.uniforms.uTime.value = this.elapsed;
      this.renderer.shadowMap.needsUpdate = true;
      this.composer.render(dt);
      if (!document.hidden) this.adapt(ms);
    };
    requestAnimationFrame(tick);
  }

  /**
   * Draw everything once into a tiny target with no culling, while the loading screen is up: every
   * texture and mesh goes to the GPU now instead of in the frame where it first comes into view
   * (walking out of the flat used to stop the picture for ~0.4 s: ~150 textures, ~1000 meshes).
   * Hidden things (the far island) wait. Call it after one real frame (the shadow map must exist).
   */
  warmUp() {
    const r = this.renderer, off = [];
    this.scene.traverse((o) => { if (o.frustumCulled && (o.isMesh || o.isLine || o.isPoints || o.isSprite)) { o.frustumCulled = false; off.push(o); } });
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    const prev = r.getRenderTarget();
    try {
      r.setRenderTarget(rt);
      r.shadowMap.needsUpdate = false; // keeps the shadow map of the frame drawn just before
      r.render(this.scene, this.camera);
    } finally {
      r.setRenderTarget(prev);
      rt.dispose();
      for (const o of off) o.frustumCulled = true;
    }
  }

  /** Render one frame now (used by tests and the viewer). */
  renderOnce() { this.renderer.shadowMap.needsUpdate = true; this.composer.render(0.016); }
}
