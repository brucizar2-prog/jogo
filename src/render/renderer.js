// Renderizador 3D: cena, câmera 2.5D, pós-processamento e sincronização com a lógica.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildScenery, THEMES } from './scenery.js';
import { createModel, ArthurModel, M } from './models.js';
import { Effects } from './effects.js';
import { tex } from './textures.js';

// Proteção contra NaN: normais "flat" calculadas por derivadas podem virar NaN em triângulos
// minúsculos/distantes, e o bloom espalharia o pixel inválido pela tela inteira.
THREE.ShaderChunk.normal_fragment_begin = THREE.ShaderChunk.normal_fragment_begin.replace(
  'vec3 normal = normalize( cross( fdx, fdy ) );',
  'vec3 fn_ = cross( fdx, fdy ); vec3 normal = dot( fn_, fn_ ) > 1e-20 ? normalize( fn_ ) : vec3( 0.0, 0.0, 1.0 );');
THREE.ShaderChunk.opaque_fragment = 'if ( any( isnan( outgoingLight ) ) || any( isinf( outgoingLight ) ) ) outgoingLight = vec3( 0.0 );\n' + THREE.ShaderChunk.opaque_fragment;

const VIEW_H = 14;        // altura visível (em tiles) no plano de jogo = 224 px do arcade
const FOV = 34;

// vinheta, grão de filme e modo CRT opcional (scanlines, curvatura, aberração cromática)
const RetroShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCRT: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uFade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uCRT; uniform vec2 uRes; uniform float uFade; varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 uv = vUv;
      if (uCRT > 0.5) { vec2 cc = uv - 0.5; float d = dot(cc, cc); uv = 0.5 + cc*(1.0 + d*0.09); }
      vec3 col;
      if (uCRT > 0.5) {
        float ab = 0.0012;
        col = vec3(texture2D(tDiffuse, uv + vec2(ab,0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ab,0.0)).b);
        float sl = sin(uv.y * uRes.y * 1.5) * 0.5 + 0.5;
        col *= mix(1.0, 0.72 + 0.28*sl, 0.85);
        float mask = mod(gl_FragCoord.x, 3.0);
        col *= vec3(mask<1.0?1.06:0.96, mask>=1.0&&mask<2.0?1.06:0.96, mask>=2.0?1.06:0.96);
        if (uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) col = vec3(0.0);
        col *= 1.12;
      } else col = texture2D(tDiffuse, uv).rgb;
      vec2 v = vUv - 0.5;
      col *= smoothstep(0.95, 0.25, length(v*vec2(1.0, 1.15)));
      col += (rand(vUv*uRes + uTime) - 0.5) * 0.035;
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    // qualidade automática: aparelhos de toque/modestos usam resolução e sombras menores
    const q = new URLSearchParams(location.search).get('q');
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.low = q === 'low' || (q !== 'high' && (mobile || (navigator.hardwareConcurrency || 8) <= 4));
    const r = new THREE.WebGLRenderer({ canvas, antialias: !this.low, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.low ? 1 : 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.r = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 900);
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.22;
    // luzes base
    this.hemi = new THREE.HemisphereLight(0x8090c0, 0x201010, 0.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xc8d6ff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.low ? 1024 : 2048, this.low ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.rim = new THREE.DirectionalLight(0x8090ff, 0.6);
    this.scene.add(this.rim); this.scene.add(this.rim.target);
    // luz que acompanha o Arthur (lanterna suave) e pool fixo de luzes dinâmicas
    this.heroLight = new THREE.PointLight(0xffe0c0, 2.2, 7, 2);
    this.scene.add(this.heroLight);
    this.pool = [];
    const nPool = this.low ? 6 : 10;
    for (let i = 0; i < nPool; i++) { const l = new THREE.PointLight(0xffffff, 0, 6, 2); this.scene.add(l); this.pool.push(l); }
    // pós-processamento
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.82);
    this.composer.addPass(this.bloom);
    this.retro = new ShaderPass(RetroShader);
    this.composer.addPass(this.retro);
    this.composer.addPass(new OutputPass());
    this.effects = new Effects(this.scene);
    this.views = new Map();
    this.stageRoot = null;
    this.crt = false;
    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get aspect() { return this.w / this.h; }
  // largura visível em px do arcade (usada pela lógica para instanciar/remover entidades)
  get viewWidthPx() { return VIEW_H * this.aspect * 16 * this.zoomFix; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.w = w; this.h = h;
    this.r.setSize(w, h, false);
    this.composer.setSize(w, h);
    if (this.low) this.bloom.setSize(Math.floor(w / 2), Math.floor(h / 2));
    this.camera.aspect = w / h;
    // em telas estreitas (retrato) garante ao menos a largura da tela original (16 tiles)
    this.zoomFix = Math.max(1, (16 / VIEW_H) / this.camera.aspect);
    this.dist = ((VIEW_H * this.zoomFix) / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const z = parseFloat(new URLSearchParams(location.search).get('zoom') || '1');   // depuração: ?zoom=2.5
    this.debugZoom = z > 1;
    if (z > 0) this.dist /= z;
    this.camera.updateProjectionMatrix();
    this.retro.uniforms.uRes.value.set(w, h);
    this.effects.setScale(h / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2))));
  }

  setCRT(on) { this.crt = on; this.retro.uniforms.uCRT.value = on ? 1 : 0; }

  // ------------------------------------------------------------------ fase
  loadStage(game) {
    this.clearStage();
    const data = game.data;
    const theme = THEMES[data.theme];
    this.theme = theme;
    this.scene.background = new THREE.Color(theme.bg);
    this.scene.fog = new THREE.FogExp2(theme.fog[0], theme.fog[1]);
    this.hemi.color.setHex(theme.hemi[0]); this.hemi.groundColor.setHex(theme.hemi[1]); this.hemi.intensity = theme.hemi[2];
    this.sun.color.setHex(theme.moon[0]); this.sun.intensity = theme.moon[1];
    this.sunDir = new THREE.Vector3(...theme.moonDir).normalize();
    this.scenery = buildScenery(game.level, data, this);
    this.stageRoot = this.scenery.root;
    this.scene.add(this.stageRoot);
    // plataformas móveis
    this.platformMeshes = game.level.platforms.map((p) => {
      const g = new THREE.Group();
      const w = p.w / 16;
      if (p.kind === 'raft') {
        for (let i = 0; i < 4; i++) {
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 8), new THREE.MeshStandardMaterial({ map: tex('bark'), roughness: 0.9 }));
          log.rotation.x = Math.PI / 2; log.position.set(0.25 + i * 0.5, -0.25, 0); log.castShadow = true; log.receiveShadow = true; g.add(log);
        }
      } else if (p.kind === 'ice') {
        const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, 2.2), new THREE.MeshStandardMaterial({ map: tex('icetop'), roughness: 0.3, color: 0xd8ecff }));
        s.position.set(w / 2, -0.22, -0.3); s.castShadow = s.receiveShadow = true; g.add(s);
      } else {
        // pedras azuladas flutuantes (como as do arcade)
        const mat = M(0x6a7aa8, { r: 0.7 });
        const mat2 = M(0x3a4470, { r: 0.8 });
        for (let i = 0; i < Math.round(w * 2); i++) {
          const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), i % 2 ? mat : mat2);
          b.position.set(0.25 + i * 0.5, -0.32 - (i % 2) * 0.08, (i % 3 - 1) * 0.35);
          b.rotation.set(i, i * 2, 0);
          b.castShadow = true; b.receiveShadow = true; g.add(b);
        }
        const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 1.6), mat);
        top.position.set(w / 2, -0.06, 0); top.receiveShadow = true; g.add(top);
      }
      this.scene.add(g);
      return g;
    });
    this.player = new ArthurModel();
    this.scene.add(this.player.obj);
    this.snapCamera = true;
  }

  clearStage() {
    if (this.stageRoot) {
      this.scene.remove(this.stageRoot);
      this.stageRoot.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      this.stageRoot = null;
    }
    for (const [, v] of this.views) this.scene.remove(v.obj);
    this.views.clear();
    if (this.platformMeshes) for (const m of this.platformMeshes) this.scene.remove(m);
    this.platformMeshes = [];
    if (this.player) this.scene.remove(this.player.obj);
    this.effects.clear();
  }

  // ------------------------------------------------------------------ quadro
  frame(game, dt, time) {
    const seen = new Set();
    const lightReqs = [];
    const sync = (e, z = 0) => {
      let v = this.views.get(e);
      if (!v) {
        v = createModel(e);
        if (!v) return;
        this.views.set(e, v);
        this.scene.add(v.obj);
        if (v.face) v.face(e.facing || 1, undefined, true);
      }
      seen.add(e);
      v.obj.position.set(e.x / 16, -e.y / 16, z);
      v.update(e, dt, time);
      if (v.setFlash) v.setFlash(e.flash > 0 && (e.flash % 4) < 2);
      if (v.setOpacity && e.alpha !== undefined) v.setOpacity(Math.max(0.02, Math.min(1, e.alpha)));
      if (v.lightReq && v.lightReq.intensity > 0.1) lightReqs.push({ x: e.x / 16, y: -e.y / 16 + (v.lightReq.oy || 0), z: z + 0.8, prio: 2, ...v.lightReq });
    };
    for (const e of game.enemies) if (e.kind === 'enemy') sync(e, e.type === 'firejet' ? -0.2 : 0);
    for (const s of game.shots) sync(s, 0.35);
    for (const s of game.eshots) sync(s, 0.3);
    for (const it of game.items) sync(it, 0.1);
    for (const [e, v] of this.views) if (!seen.has(e)) { this.scene.remove(v.obj); this.views.delete(e); }

    // Arthur
    const P = game.player;
    this.player.obj.position.set(P.x / 16, -P.y / 16, 0);
    this.player.update(P, dt, time);
    this.heroLight.position.set(P.x / 16 + 0.8, -P.y / 16 + 2.6, 3.5);

    // plataformas
    game.level.platforms.forEach((p, i) => { const m = this.platformMeshes[i]; if (m) m.position.set(p.x / 16, -p.y / 16, 0); });

    // efeitos
    for (const ev of game.fx.drain()) {
      if (ev.type === 'dooropen') { this.doorT = 0.0001; continue; }
      this.effects.emit(ev);
    }
    this.effects.ambient(game, dt, game.view);
    this.effects.update(dt);
    for (const f of this.effects.flashes) lightReqs.push({ x: f.x, y: f.y, z: f.z, color: f.color, intensity: f.intensity, dist: f.dist, prio: 3 });
    const cx = game.cam.x / 16, cy = -game.cam.y / 16;
    // luzes fixas do cenário dentro da área visível
    const halfW = this.viewWidthPx / 32 + 4, halfH = 10;
    for (const l of this.scenery.lights) {
      if (Math.abs(l.x - cx) < halfW && Math.abs(l.y - cy) < halfH) lightReqs.push(l);
    }
    // distribui o pool fixo pelas fontes mais relevantes (fortes e perto do centro da tela)
    const score = (q) => (q.prio || 1) * q.intensity / (1 + Math.hypot(q.x - cx, (q.y - cy) * 1.5) * 0.35);
    lightReqs.sort((a, b) => score(b) - score(a));
    for (let i = 0; i < this.pool.length; i++) {
      const l = this.pool[i], q = lightReqs[i];
      if (q) { l.position.set(q.x, q.y, q.z); l.color.setHex(q.color); l.intensity = q.intensity; l.distance = q.dist || 6; l.decay = q.decay || 2; }
      else l.intensity = 0;
    }

    if (this.doorT !== undefined && this.doorT > 0) { this.doorT = Math.min(1, this.doorT + dt * 0.6); this.scenery.openDoor(this.doorT); }

    // câmera
    let shx = 0, shy = 0;
    if (game.shakeT > 0) { const a = game.shakeA * (game.shakeT / 16) / 16; shx = (Math.random() - 0.5) * a; shy = (Math.random() - 0.5) * a; }
    let tx = cx + shx, ty = cy + shy;
    if (this.debugZoom) { tx = P.x / 16; ty = -P.y / 16 + 1; }
    this.camTarget.set(tx, ty - 0.2, 0);
    this.camPos.set(tx, ty + 2.4, this.dist);
    if (this.snapCamera) { this.camera.position.copy(this.camPos); this.snapCamera = false; }
    else this.camera.position.lerp(this.camPos, 0.35);
    this.camera.lookAt(this.camTarget);
    // sombra acompanha a câmera
    this.sun.position.set(tx + this.sunDir.x * 30, ty + this.sunDir.y * 30, this.sunDir.z * 30);
    this.sun.target.position.set(tx, ty, 0);
    this.rim.position.set(tx - 10, ty + 6, -20); this.rim.target.position.set(tx, ty, 0);
    this.scenery.update(time, tx, ty);
  }

  render(time) {
    this.retro.uniforms.uTime.value = time % 100;
    this.composer.render();
  }

  // renderiza só a cena (usado no título/telas)
  setFade(f) { this.retro.uniforms.uFade.value = f; }
}
