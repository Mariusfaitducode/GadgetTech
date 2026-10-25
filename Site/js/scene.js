// Le boîtier, reconstruit aux cotes des STL publiés (130 × 100 mm,
// coque 27,5 mm + cadre 7,5 mm). Unités : millimètres, groupe mis à 1/10.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function roundedHole(w, h, r) {
  const s = roundedRect(w, h, r);
  return new THREE.Path(s.getPoints(24).reverse());
}

// Veinage de noyer procédural : bandes sinueuses + pores.
let woodCache = null;
export function walnutCanvas() {
  if (woodCache) return woodCache;
  const N = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#3a2216';
  g.fillRect(0, 0, N, N);
  // Larges bandes de teinte, puis fibres fines, puis pores.
  for (let i = 0; i < 14; i++) {
    const y = Math.random() * N, h = 40 + Math.random() * 160;
    const grad = g.createLinearGradient(0, y - h, 0, y + h);
    const tone = Math.random() < 0.5 ? '120,74,44' : '24,13,7';
    grad.addColorStop(0, `rgba(${tone},0)`);
    grad.addColorStop(0.5, `rgba(${tone},${0.12 + Math.random() * 0.18})`);
    grad.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grad;
    g.fillRect(0, y - h, N, h * 2);
  }
  const TAU = Math.PI * 2;
  for (let i = 0; i < 900; i++) {
    const y0 = Math.random() * N;
    const k1 = 1 + Math.floor(Math.random() * 2), k2 = 3 + Math.floor(Math.random() * 3);
    const a1 = 4 + Math.random() * 14, a2 = Math.random() * 3;
    const p1 = Math.random() * TAU, p2 = Math.random() * TAU;
    const light = Math.random() < 0.4;
    g.strokeStyle = light
      ? `rgba(${140 + Math.random() * 40},${88 + Math.random() * 26},${52 + Math.random() * 18},${0.04 + Math.random() * 0.08})`
      : `rgba(${18 + Math.random() * 14},${9 + Math.random() * 8},5,${0.06 + Math.random() * 0.16})`;
    g.lineWidth = 0.4 + Math.random() * (light ? 2.4 : 1.6);
    g.beginPath();
    for (let x = 0; x <= N; x += 6) {
      const t = (x / N) * TAU;
      const y = y0 + Math.sin(t * k1 + p1) * a1 + Math.sin(t * k2 + p2) * a2;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(12,6,3,${Math.random() * 0.4})`;
    g.fillRect(Math.random() * N, Math.random() * N, 1 + Math.random() * 5, 0.8);
  }
  woodCache = c;
  return c;
}

function walnutTextures() {
  const map = new THREE.CanvasTexture(walnutCanvas());
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  // Les UV des faces vont de -65 à 65 mm : décalage pour ne jamais croiser
  // le bord de la tuile au milieu de l'objet.
  map.repeat.set(1 / 150, 1 / 150);
  map.offset.set(0.5, 0.5);
  map.anisotropy = 8;
  return map;
}

export function buildDevice(screenCanvas) {
  const wood = walnutTextures();
  const walnut = new THREE.MeshPhysicalMaterial({
    map: wood, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.32, sheen: 0.2,
  });
  const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.55 });
  const pcbBlack = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.4 });
  const pcbBlue = new THREE.MeshStandardMaterial({ color: 0x1d4f9c, roughness: 0.38 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 1, roughness: 0.28 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1, roughness: 0.3 });
  const panelEdge = new THREE.MeshStandardMaterial({ color: 0xd9d8d2, roughness: 0.5 });

  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 8;
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTex, roughness: 0.92, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.22,
  });

  const parts = {};
  const mk = (name) => { const g = new THREE.Group(); g.name = name; parts[name] = g; return g; };

  // 6. Coque : fond 3 mm + parois 4 mm.
  const coque = mk('coque');
  const base = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedRect(130, 100, 14), { depth: 1.8, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 3, curveSegments: 24 }),
    walnut,
  );
  base.position.z = 0.6;
  const wallShape = roundedRect(130, 100, 14);
  wallShape.holes.push(roundedHole(122, 92, 10));
  const walls = new THREE.Mesh(
    new THREE.ExtrudeGeometry(wallShape, { depth: 23, bevelEnabled: true, bevelThickness: 0.7, bevelSize: 0.7, bevelSegments: 3, curveSegments: 24 }),
    walnut,
  );
  walls.position.z = 3.7;
  coque.add(base, walls);

  // 5. Aimants dans les angles du rebord.
  const aimants = mk('aimants');
  const magGeo = new THREE.CylinderGeometry(3, 3, 2.5, 28);
  magGeo.rotateX(Math.PI / 2);
  for (const [x, y] of [[-55, -40], [55, -40], [-55, 40], [55, 40]]) {
    const m = new THREE.Mesh(magGeo, metal);
    m.position.set(x, y, 26.3);
    aimants.add(m);
  }

  // 4. Support 3 × AAA.
  const piles = mk('piles');
  const holder = new THREE.Mesh(new THREE.BoxGeometry(47, 36, 11), blackPlastic);
  holder.position.z = 8.5;
  piles.add(holder);
  const cellGeo = new THREE.CylinderGeometry(5.1, 5.1, 40, 28);
  cellGeo.rotateZ(Math.PI / 2);
  const capGeo = new THREE.CylinderGeometry(5.12, 5.12, 4, 28);
  capGeo.rotateZ(Math.PI / 2);
  const cellMat = new THREE.MeshStandardMaterial({ color: 0x26272b, metalness: 0.5, roughness: 0.35 });
  for (const y of [-11, 0, 11]) {
    const cell = new THREE.Mesh(cellGeo, cellMat);
    cell.position.set(-2, y, 15);
    const cap = new THREE.Mesh(capGeo, copper);
    cap.position.set(19.5, y, 15);
    piles.add(cell, cap);
  }
  const wireGeo = new THREE.CylinderGeometry(0.7, 0.7, 30, 8);
  wireGeo.rotateZ(Math.PI / 2);
  const red = new THREE.Mesh(wireGeo, new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.5 }));
  red.position.set(38, 14, 6);
  const blk = new THREE.Mesh(wireGeo, blackPlastic);
  blk.position.set(38, 11, 6);
  piles.add(red, blk);
  piles.position.set(-30, -14, 0);

  // 3. ESP32 DevKit.
  const esp = mk('esp32');
  const board = new THREE.Mesh(new THREE.BoxGeometry(51.5, 28.3, 1.6), pcbBlack);
  board.position.z = 6;
  const shield = new THREE.Mesh(new THREE.BoxGeometry(17.5, 15.5, 3.2), metal);
  shield.position.set(-12, 0, 8.4);
  const ant = new THREE.Mesh(new THREE.BoxGeometry(6, 18, 0.9), pcbBlack);
  ant.position.set(-23, 0, 7.3);
  const usb = new THREE.Mesh(new THREE.BoxGeometry(7.5, 9, 3.2), metal);
  usb.position.set(23.5, 0, 8.4);
  const headerGeo = new THREE.BoxGeometry(48, 2.5, 2.5);
  const h1 = new THREE.Mesh(headerGeo, blackPlastic); h1.position.set(0, 12.6, 4);
  const h2 = new THREE.Mesh(headerGeo, blackPlastic); h2.position.set(0, -12.6, 4);
  esp.add(board, shield, ant, usb, h1, h2);
  esp.position.set(30, 22, 0);

  // 2. Écran e-paper 4,2" sur sa carte Waveshare.
  const ecran = mk('ecran');
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(103, 78.5, 1.6), pcbBlue);
  pcb.position.z = 22.8;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(91, 77, 1.2), panelEdge);
  panel.position.set(0, 0.5, 24.2);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(84.8, 63.6), screenMat);
  display.position.set(0, 0.8, 24.85);
  ecran.add(pcb, panel, display);
  const ribbonColors = [0x8a8a8a, 0x6b3b1f, 0x2456c8, 0xf2c200, 0xf07a1a, 0x2f9a48, 0xf4f4f0, 0x7b3fb0];
  ribbonColors.forEach((col, i) => {
    const w = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 26, 8),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 }),
    );
    w.rotation.x = Math.PI / 2.6;
    w.position.set(30 + i * 1.2, -42, 12);
    ecran.add(w);
  });

  // 1. Cadre en noyer.
  const cadre = mk('cadre');
  const frameShape = roundedRect(130, 100, 14);
  frameShape.holes.push(roundedHole(88, 66, 7));
  const frame = new THREE.Mesh(
    new THREE.ExtrudeGeometry(frameShape, { depth: 5.1, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 5, curveSegments: 32 }),
    walnut,
  );
  frame.position.z = 28.7;
  cadre.add(frame);
  cadre.userData.flat = true;

  const device = new THREE.Group();
  for (const k of ['coque', 'aimants', 'piles', 'esp32', 'ecran', 'cadre']) device.add(parts[k]);
  device.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // Pas d'ombre portée sur l'écran : évite l'acné d'ombre sur le texte.
  display.receiveShadow = false;
  panel.receiveShadow = false;
  device.scale.setScalar(0.1);

  return { device, parts, screenTex };
}

function baseRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  return { renderer, env };
}

function whenVisible(el, cb) {
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; cb(visible); }, { rootMargin: '100px' }).observe(el);
  return () => visible;
}

// Scène noire façon page produit : la séquence épinglée pilote l'angle et
// le travelling. progress ∈ [0,1] vient du défilement.
export function mountStage(container, screenCanvas) {
  const { renderer, env } = baseRenderer(container);
  renderer.shadowMap.enabled = false;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
  camera.position.set(0, 0, 40);

  const { device, parts, screenTex } = buildDevice(screenCanvas);
  // Pivot au centre de l'épaisseur (35 mm) pour tourner sur lui-même.
  device.position.z = -1.75;
  const pivot = new THREE.Group();
  pivot.add(device);
  scene.add(pivot);

  const key = new THREE.SpotLight(0xfff1df, 2000, 120, 0.5, 0.8, 2);
  key.position.set(-14, 22, 30);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd2ff, 2.2);
  rim.position.set(18, 8, -14);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffd9b8, 1.4);
  rim2.position.set(-20, -6, -10);
  scene.add(rim2);
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));

  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  let state = 0, shown = 0;
  let pointer = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  if (!reduceMotion) {
    window.addEventListener('pointermove', (e) => {
      pointer.x = e.clientX / window.innerWidth - 0.5;
      pointer.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  let zFar = 40, zNear = 20, tan = Math.tan(THREE.MathUtils.degToRad(15));
  function layout() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const a = camera.aspect;
    // Ouverture : l'objet occupe ~44 % de la largeur (78 % sur mobile).
    zFar = 13.6 / ((a > 1 ? 0.44 : 0.8) * 2 * tan * a);
    zFar = Math.max(zFar, 13.6 / (0.5 * 2 * tan));
    // Fin de séquence : l'écran remplit l'image.
    const zW = 8.6 / (0.8 * 2 * tan * a), zH = 6.6 / (0.62 * 2 * tan);
    zNear = Math.max(zW, zH);
  }
  new ResizeObserver(layout).observe(container);
  layout();

  const isVisible = whenVisible(container, () => {});
  function frame() {
    requestAnimationFrame(frame);
    if (!isVisible()) return;
    shown += (state - shown) * (reduceMotion ? 1 : 0.09);
    cur.x += (pointer.x - cur.x) * 0.05;
    cur.y += (pointer.y - cur.y) * 0.05;
    const turn = ease(clamp01(shown / 0.42));
    const dolly = ease(clamp01((shown - 0.32) / 0.5));
    const visH = 2 * zFar * tan;
    pivot.rotation.y = lerp(-0.66, 0, turn) + cur.x * 0.12 * (1 - dolly);
    pivot.rotation.x = lerp(0.24, 0, turn) + cur.y * 0.06 * (1 - dolly);
    pivot.rotation.z = lerp(0.05, 0, turn);
    pivot.position.y = lerp(-visH * 0.14, 0, turn);
    camera.position.z = lerp(zFar, zNear, dolly);
    renderer.render(scene, camera);
  }
  frame();
  return { screenTex, parts, set(p) { state = p; } };
}

// Vue éclatée pilotée par le défilement : progress ∈ [0,1], active = pièce mise en avant.
export function mountExploded(container, screenCanvas) {
  const { renderer, env } = baseRenderer(container);
  renderer.shadowMap.enabled = false;
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.8;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
  camera.position.set(0, 0, 62);

  const { device, parts, screenTex } = buildDevice(screenCanvas);
  const tilt = new THREE.Group();
  tilt.rotation.x = -0.98;
  tilt.add(device);
  const turn = new THREE.Group();
  turn.rotation.y = -0.62;
  turn.add(tilt);
  scene.add(turn);
  device.position.z = -2;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a968e, 1.1));
  const key = new THREE.DirectionalLight(0xfff2e2, 2.2);
  key.position.set(-10, 20, 16);
  scene.add(key);

  const lift = { cadre: 108, ecran: 78, aimants: 52, esp32: 44, piles: 24, coque: 0 };
  const order = ['cadre', 'ecran', 'esp32', 'piles', 'aimants', 'coque'];
  const mats = new Map();
  device.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      mats.set(o, o.material);
    }
  });

  let state = { progress: 0, active: null };
  let shown = { progress: 0 };

  function layout() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.position.z = camera.aspect < 1.2 ? 56 : 62;
  }
  new ResizeObserver(layout).observe(container);
  layout();

  const isVisible = whenVisible(container, () => {});
  function frame() {
    requestAnimationFrame(frame);
    if (!isVisible()) return;
    shown.progress += (state.progress - shown.progress) * (reduceMotion ? 1 : 0.08);
    const p = shown.progress;
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    for (const k of order) parts[k].position.z = lift[k] * e;
    device.position.y = -3 * e;
    turn.rotation.y = -0.62 + (reduceMotion ? 0 : (p - 0.5) * 0.25);
    for (const k of order) {
      const dim = state.active && state.active !== k;
      parts[k].traverse((o) => {
        if (!o.isMesh) return;
        const m = mats.get(o);
        m.opacity += ((dim ? 0.14 : 1) - m.opacity) * 0.12;
        m.depthWrite = m.opacity > 0.95;
      });
    }
    renderer.render(scene, camera);
  }
  frame();

  return {
    screenTex,
    set(progress, active) { state.progress = progress; state.active = active; },
  };
}
