import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';
import { asset, isMobileViewport } from './utils.js';

/* --------------------------------------------------------------------------
   Wet, polished studio floor: blurred planar reflection with puddle variation
   -------------------------------------------------------------------------- */
const FloorShader = {
  name: 'NoirvalWetFloor',
  defines: { TAPS: 2 },
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uStrength: { value: 0.62 },
    uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform vec2 uTexel;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <logdepthbuf_pars_fragment>
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv.xy / vUv.w;
      float wet = smoothstep(0.3, 0.7, fbm(vWorld.xz * 0.35 + 3.1));
      float spread = mix(3.2, 1.8, wet);
      vec2 ripple = vec2(0.0);
      vec3 acc = vec3(0.0);
      float wsum = 0.0;
      for (int x = -TAPS; x <= TAPS; x++) {
        for (int y = -TAPS; y <= TAPS; y++) {
          vec2 o = vec2(float(x), float(y) * 2.4) * uTexel * spread;
          float w = exp(-float(x * x + y * y) * 0.3);
          acc += texture2D(tDiffuse, uv + o + ripple).rgb * w;
          wsum += w;
        }
      }
      vec3 refl = acc / wsum;
      float d = length(vWorld.xz);
      float fade = 1.0 - smoothstep(2.5, 12.0, d);
      float grain = fbm(vWorld.xz * 38.0);
      vec3 base = color * (0.7 + 0.6 * grain);
      float pool = 1.0 - smoothstep(0.0, 4.6, length(vWorld.xz * vec2(1.0, 0.62)));
      vec3 col = base + vec3(0.05, 0.048, 0.046) * pool * pool + refl * uStrength * mix(0.45, 1.0, wet) * fade;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

/* Studio of soft-boxes rendered into a PMREM: gives the car paint its reflections. */
function createStudioEnvironment(renderer) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x000000);
  const geo = new THREE.PlaneGeometry(1, 1);
  const add = (w, h, intensity, pos, rot, color = 0xffffff) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(w, h, 1);
    m.position.set(...pos);
    m.rotation.set(...rot);
    envScene.add(m);
  };
  add(3.2, 11, 4.2, [0, 6, 0], [Math.PI / 2, 0, 0]); // long overhead softbox
  add(1.1, 5.5, 2.8, [-7, 2.4, -1.5], [0, Math.PI / 2, 0]); // left strip
  add(1.1, 5.5, 2.8, [7, 2.4, 1.5], [0, -Math.PI / 2, 0]); // right strip
  add(11, 0.6, 2.2, [0, 2.2, 9], [0, Math.PI, 0]); // rear horizon strip
  add(16, 2.6, 0.5, [0, 1.3, -10], [0, 0, 0]); // soft front fill
  add(2.2, 2.2, 1.6, [-4.5, 4.5, -5], [-0.6, -0.6, 0]); // kicker
  add(0.5, 14, 1.4, [-8, 0.7, 0], [0, Math.PI / 2, Math.PI / 2]); // low left strip (wheels / sills)
  add(0.5, 14, 1.4, [8, 0.7, 0], [0, -Math.PI / 2, Math.PI / 2]); // low right strip
  add(40, 40, 0.018, [0, -0.02, 0], [-Math.PI / 2, 0, 0], 0x999999); // faint floor bounce
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();
  geo.dispose();
  return env;
}

/** Drop every triangle whose world-space centroid falls inside one of the boxes. */
function removeTriangles(mesh, boxes) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const idx = g.index;
  const m = mesh.matrixWorld;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const count = idx ? idx.count : pos.count;
  const keep = [];
  for (let i = 0; i < count; i += 3) {
    const ia = idx ? idx.getX(i) : i;
    const ib = idx ? idx.getX(i + 1) : i + 1;
    const ic = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia).applyMatrix4(m);
    b.fromBufferAttribute(pos, ib).applyMatrix4(m);
    c.fromBufferAttribute(pos, ic).applyMatrix4(m);
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    if (!boxes.some((box) => box.containsPoint(centroid))) keep.push(ia, ib, ic);
  }
  g.setIndex(keep);
}

export function createStudio({ section, canvas, stage }) {
  const mobile = isMobileViewport();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    alpha: false,
  });
  const maxDpr = mobile ? 1.6 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = createStudioEnvironment(renderer);
  scene.environmentIntensity = 1.0;
  scene.fog = new THREE.Fog(0x000000, 10, 24);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  camera.position.set(4.3, 1.3, -4.6);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2 - 0.06;
  controls.rotateSpeed = 0.55;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;
  canvas.style.touchAction = 'pan-y'; // keep vertical page scrolling on touch devices
  controls.update();

  let resumeTimer = null;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    clearTimeout(resumeTimer);
  });
  controls.addEventListener('end', () => {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => (controls.autoRotate = state.spin), 4500);
  });

  /* ----------------------------------------------------------- floor */
  const floor = new Reflector(new THREE.PlaneGeometry(60, 60), {
    shader: FloorShader,
    textureWidth: 1024,
    textureHeight: 1024,
    color: new THREE.Color(0x0a0a0a),
    multisample: mobile ? 0 : 4,
    clipBias: 0.002,
  });
  floor.material.defines.TAPS = mobile ? 1 : 2;
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  /* ------------------------------------------------------- materials */
  const M = {
    body: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#a00000'),
      metalness: 0.25,
      roughness: 0.38,
      clearcoat: 1,
      clearcoatRoughness: 0.025,
      envMapIntensity: 1.25,
    }),
    rim: new THREE.MeshStandardMaterial({ color: new THREE.Color('#6b6e73'), metalness: 1, roughness: 0.3, envMapIntensity: 2.2 }),
    metal: new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2a2c'), metalness: 1, roughness: 0.35 }),
    chrome: new THREE.MeshStandardMaterial({ color: new THREE.Color('#9c9c9c'), metalness: 1, roughness: 0.2, envMapIntensity: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      metalness: 0,
      roughness: 0,
      transmission: 1,
      ior: 1.5,
      thickness: 0,
      specularIntensity: 0.35, // grazing reflections of the overhead softbox otherwise bloom into a streak
      envMapIntensity: 0.5,
    }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0, transmission: 1, ior: 1.5 }),
    led: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color('#e4f0ff'), emissiveIntensity: 4.5 }),
    tail: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#3a0000'),
      emissive: new THREE.Color('#ff1010'),
      emissiveIntensity: 1.4,
      roughness: 0.12,
      clearcoat: 1,
    }),
    tire: new THREE.MeshStandardMaterial({ color: new THREE.Color('#101010'), roughness: 0.78, metalness: 0 }),
    carbon: new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#101012'), roughness: 0.32, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.03 }),
    leather: new THREE.MeshStandardMaterial({ color: new THREE.Color('#141313'), roughness: 0.62 }),
    leatherRed: new THREE.MeshStandardMaterial({ color: new THREE.Color('#7a0a0a'), roughness: 0.55 }),
    interior: new THREE.MeshStandardMaterial({ color: new THREE.Color('#0d0d0e'), roughness: 0.6 }),
    interiorLight: new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2928'), roughness: 0.55 }),
    plastic: new THREE.MeshStandardMaterial({ color: new THREE.Color('#121213'), roughness: 0.5 }),
    badge: new THREE.MeshStandardMaterial({ color: new THREE.Color('#1c1c1c'), metalness: 1, roughness: 0.3 }),
  };

  const byMaterialName = {
    Body_Color: M.body,
    Glass_Gray: M.glass,
    Projector_Glass: M.lens,
    Turn_Signal_LED: M.led,
    Taillight_Glass: M.tail,
    Tires: M.tire,
    metal_gray: M.metal,
    metal_chrome: M.chrome,
    plastic_gray: M.plastic,
    Carbon_Fiber: M.carbon,
    Leather: M.leather,
    Leather_red: M.leatherRed,
    Interior_dark: M.interior,
    Interior_light: M.interiorLight,
    Carpet: M.interior,
    Ferrari_Yellow: M.badge,
    _0098_DodgerBlue: M.badge,
  };

  /* --------------------------------------------------------- composer */
  const composerTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: mobile ? 2 : 4,
  });
  const composer = new EffectComposer(renderer, composerTarget);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 1.6); // only the LEDs (emissive 4.5) bloom
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ------------------------------------------------------------- load */
  const state = { spin: true, lights: true, ready: false, visible: false, intro: false };
  // Camera glides in the first time the loaded studio is actually on screen.
  function playIntro() {
    if (state.intro || !state.ready || !state.visible) return;
    state.intro = true;
    gsap.from(camera.position, { x: 7.4, y: 2.4, z: -7.6, duration: 2.6, ease: 'expo.out', onUpdate: () => controls.update() });
  }
  const loadingEl = section.querySelector('[data-studio-loading]');
  const draco = new DRACOLoader(); // decoder files are bundled by Vite via import.meta.url
  // Strict Content-Security-Policies can forbid WebAssembly; fall back to the pure-JS decoder there.
  const wasmAllowed = (() => {
    try {
      return typeof WebAssembly === 'object' && !!new WebAssembly.Module(Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0));
    } catch {
      return false;
    }
  })();
  if (!wasmAllowed) draco.setDecoderConfig({ type: 'js' });
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  let car = null;
  loader.load(
    asset('models/car.glb'),
    (gltf) => {
      car = gltf.scene;
      car.updateMatrixWorld(true);
      // De-badge: remove the small emblem triangles (grille, nose, tail) so the build reads as unbranded.
      const chrome = car.getObjectByName('chrome');
      if (chrome) {
        removeTriangles(chrome, [
          new THREE.Box3(new THREE.Vector3(-0.05, 0.2, -2.25), new THREE.Vector3(0.05, 0.66, -2.0)),
          new THREE.Box3(new THREE.Vector3(-0.05, 0.58, 2.0), new THREE.Vector3(0.05, 1.02, 2.25)),
        ]);
      }
      const shields = car.getObjectByName('yellow_trim');
      if (shields) shields.visible = false;
      car.traverse((o) => {
        if (!o.isMesh) return;
        const name = o.material && o.material.name;
        if (byMaterialName[name]) o.material = byMaterialName[name];
        if (/^rim_/.test(o.name)) o.material = M.rim;
        o.castShadow = false;
        o.receiveShadow = false;
      });
      // contact shadow (baked AO) under the car
      const ao = new THREE.TextureLoader().load(asset('models/car_ao.png'));
      ao.colorSpace = THREE.SRGBColorSpace;
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
        new THREE.MeshBasicMaterial({
          map: ao,
          blending: THREE.MultiplyBlending,
          toneMapped: false,
          transparent: true,
          premultipliedAlpha: true,
          depthWrite: false,
        }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.002;
      shadow.renderOrder = 2;
      car.add(shadow);
      scene.add(car);
      state.ready = true;
      section.classList.add('is-ready');
      draco.dispose();
      playIntro();
    },
    (xhr) => {
      if (xhr.total && loadingEl) loadingEl.style.setProperty('--p', (xhr.loaded / xhr.total).toFixed(3));
    },
    (err) => {
      console.error('Studio model failed to load', err);
      if (loadingEl) loadingEl.querySelector('span').textContent = 'The studio could not be loaded';
    },
  );

  /* ----------------------------------------------------------- resize */
  const resize = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    // shift the car slightly left on wide screens to leave room for the panel
    if (!isMobileViewport() && w > 900) {
      camera.setViewOffset(w, h, w * 0.07, 0, w, h);
    } else {
      camera.clearViewOffset();
    }
    camera.fov = w / h < 1 ? 42 : 30;
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    const rw = Math.round(w * pr * (mobile ? 0.45 : 0.6));
    const rh = Math.round(h * pr * (mobile ? 0.45 : 0.6));
    floor.getRenderTarget().setSize(rw, rh);
    floor.material.uniforms.uTexel.value.set(1 / rw, 1 / rh);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  /* --------------------------------------------------------------- UI */
  const tweenColor = (mat, hex, duration = 1.2) => {
    const from = mat.color.clone();
    const to = new THREE.Color(hex);
    const p = { t: 0 };
    gsap.to(p, { t: 1, duration, ease: 'power2.inOut', onUpdate: () => mat.color.lerpColors(from, to, p.t) });
  };

  const setActive = (btn, groupSel) => {
    section.querySelectorAll(groupSel).forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      if (b.hasAttribute('role')) b.setAttribute('aria-checked', String(b === btn));
    });
  };

  section.querySelectorAll('[data-paint]').forEach((btn) =>
    btn.addEventListener('click', () => {
      setActive(btn, '[data-paint]');
      tweenColor(M.body, btn.dataset.paint);
      const name = section.querySelector('[data-paint-name]');
      if (name) name.textContent = btn.dataset.paintLabel;
      const hex = btn.dataset.paint.toLowerCase();
      const light = hex === '#d8d8d2';
      gsap.to(M.body, { metalness: light ? 0.15 : 0.25, roughness: light ? 0.3 : 0.38, duration: 1 });
    }),
  );

  section.querySelectorAll('[data-rim]').forEach((btn) =>
    btn.addEventListener('click', () => {
      setActive(btn, '[data-rim]');
      tweenColor(M.rim, btn.dataset.rim, 0.9);
      gsap.to(M.rim, { metalness: Number(btn.dataset.rimMetal), roughness: Number(btn.dataset.rimRough), duration: 0.9 });
      const name = section.querySelector('[data-rim-name]');
      if (name) name.textContent = btn.textContent.trim();
    }),
  );

  const VIEWS = {
    front: new THREE.Vector3(0.0, 1.0, -6.6),
    side: new THREE.Vector3(8.0, 0.95, 0.0),
    rear: new THREE.Vector3(-0.6, 1.15, 6.6),
    top: new THREE.Vector3(0.4, 7.4, -1.0),
  };
  const sph = new THREE.Spherical();
  const sphTo = new THREE.Spherical();
  section.querySelectorAll('[data-view]').forEach((btn) =>
    btn.addEventListener('click', () => {
      controls.autoRotate = false;
      clearTimeout(resumeTimer);
      const offset = camera.position.clone().sub(controls.target);
      sph.setFromVector3(offset);
      sphTo.setFromVector3(VIEWS[btn.dataset.view]);
      // take the short way around
      let dTheta = sphTo.theta - sph.theta;
      dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
      const p = { r: sph.radius, phi: sph.phi, theta: sph.theta };
      gsap.to(p, {
        r: sphTo.radius,
        phi: sphTo.phi,
        theta: sph.theta + dTheta,
        duration: 1.6,
        ease: 'power3.inOut',
        onUpdate: () => {
          offset.setFromSphericalCoords(p.r, p.phi, p.theta);
          camera.position.copy(controls.target).add(offset);
          controls.update();
        },
        onComplete: () => {
          resumeTimer = setTimeout(() => (controls.autoRotate = state.spin), 6000);
        },
      });
    }),
  );

  const lightsBtn = section.querySelector('[data-lights]');
  lightsBtn?.addEventListener('click', () => {
    state.lights = !state.lights;
    lightsBtn.classList.toggle('is-active', state.lights);
    lightsBtn.setAttribute('aria-pressed', String(state.lights));
    lightsBtn.textContent = state.lights ? 'On' : 'Off';
    gsap.to(M.led, { emissiveIntensity: state.lights ? 4.5 : 0, duration: 0.5 });
    gsap.to(M.tail, { emissiveIntensity: state.lights ? 1.4 : 0.05, duration: 0.5 });
  });

  const spinBtn = section.querySelector('[data-spin]');
  spinBtn?.classList.add('is-active');
  spinBtn?.addEventListener('click', () => {
    state.spin = !state.spin;
    controls.autoRotate = state.spin;
    spinBtn.classList.toggle('is-active', state.spin);
    spinBtn.setAttribute('aria-pressed', String(state.spin));
  });

  /* ------------------------------------------------------------- loop */
  const io = new IntersectionObserver(
    ([entry]) => {
      state.visible = entry.isIntersecting;
      playIntro();
    },
    { rootMargin: '10% 0px' },
  );
  io.observe(section);

  let last = performance.now();
  return {
    tick() {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (state.paused || !state.visible || document.hidden) return;
      controls.update(dt);
      composer.render(dt);
    },
    // debugging helpers (used by automated visual checks)
    setPaused(v) {
      state.paused = v;
    },
    snapshot(view) {
      if (view && VIEWS[view]) {
        camera.position.copy(VIEWS[view]);
        controls.update();
      }
      controls.update();
      composer.render(0.016);
      return canvas.toDataURL('image/png');
    },
    get ready() {
      return state.ready;
    },
  };
}
