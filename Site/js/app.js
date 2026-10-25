import { computeDeparture, displayKey, drawScreen, fullRefresh } from './screen.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Curseurs ---------- */
function paintRange(input) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--pct', pct + '%');
}
$$('input[type="range"]').forEach((r) => { paintRange(r); r.addEventListener('input', () => paintRange(r)); });
const setOutput = (id, text) => { const o = $(`output[data-for="${id}"]`); if (o) o.textContent = text; };

/* ---------- Temps perdu ---------- */
function updateCalc() {
  const wait = +$('#wait').value, trips = +$('#trips').value, days = +$('#days').value;
  setOutput('wait', `${wait} min`);
  setOutput('trips', String(trips));
  setOutput('days', String(days));
  const h = Math.round((wait * trips * days) / 60);
  $('#hours').textContent = `${h.toLocaleString('fr-FR')} heure${h > 1 ? 's' : ''}`;
}
['#wait', '#trips', '#days'].forEach((s) => $(s).addEventListener('input', updateCalc));
updateCalc();

/* ---------- Écrans e-ink : objet 3D, tuile, simulateur, vue éclatée ---------- */
const mkCanvas = () => { const c = document.createElement('canvas'); c.width = 1024; c.height = 768; return c; };
const stageCanvas = mkCanvas();
const explodedCanvas = mkCanvas();
const screens = [stageCanvas, $('#sim-screen'), $('#tile-screen'), explodedCanvas]
  .map((c) => ({ ctx: c.getContext('2d'), tex: null }));

const config = { station: 'nation', walk: 5 };
let lastKey = '', lastMinute = -1, refreshing = false;

function paint(d, phase) {
  for (const s of screens) {
    drawScreen(s.ctx, d, phase);
    if (s.tex) s.tex.needsUpdate = true;
  }
}

function describe(d) {
  const lead = `À ${d.station.name}, à ${d.walk} min à pied`;
  return d.leave === 0
    ? `${lead}&nbsp;: <strong>partez maintenant</strong> pour le métro dans ${d.trainIn} min.`
    : `${lead}&nbsp;: <strong>partez dans ${d.leave} min</strong> pour le métro dans ${d.trainIn} min.`;
}

function tick(force) {
  if (refreshing) return;
  const d = computeDeparture(config.station, config.walk, new Date());
  const key = displayKey(d);
  if (key === lastKey && !force) return;
  const minute = d.now.getMinutes();
  $('#sim-read').innerHTML = describe(d);
  // Nouvelle minute : rafraîchissement complet, comme le vrai panneau.
  if (!reduceMotion && (force || minute !== lastMinute)) {
    refreshing = true;
    fullRefresh(paint, d, () => { refreshing = false; });
  } else {
    paint(d, 'content');
  }
  lastKey = key;
  lastMinute = minute;
}

$$('#station input').forEach((r) => r.addEventListener('change', () => { config.station = r.value; tick(); }));
$('#walk').addEventListener('input', (e) => {
  config.walk = +e.target.value;
  setOutput('walk', `${config.walk} min`);
  tick();
});

/* ---------- 3D ---------- */
let stage = null, exploded = null;
async function init3D() {
  await document.fonts.ready;
  paint(computeDeparture(config.station, config.walk), 'content');
  try {
    const scene = await import('./scene.js');
    stage = scene.mountStage($('#stage-3d'), stageCanvas);
    screens[0].tex = stage.screenTex;
    exploded = scene.mountExploded($('#exploded-3d'), explodedCanvas);
    screens[3].tex = exploded.screenTex;
    // Même veinage que l'objet pour la tuile « Noyer massif ».
    $('#t-wood').style.setProperty('--wood', `url(${scene.walnutCanvas().toDataURL('image/jpeg', 0.85)})`);
    onScroll();
  } catch (err) {
    console.error('3D indisponible', err);
  }
  // L'écran s'allume : le seul moment joué sans action du visiteur.
  setTimeout(() => tick(true), reduceMotion ? 0 : 500);
  setInterval(() => tick(false), 1000);
}
init3D();

/* ---------- Séquence épinglée ---------- */
const stageEl = $('#apercu');
const intro = $('.stage-intro');
const note = $('.stage-note');
const captions = $$('.stage-captions li');
const bands = [[0.36, 0.56], [0.56, 0.76], [0.76, 1.01]];
function onScrollStage() {
  const r = stageEl.getBoundingClientRect();
  const p = clamp01(-r.top / (r.height - window.innerHeight));
  if (stage) stage.set(p);
  const fade = 1 - clamp01(p / 0.2);
  stageEl.style.setProperty('--intro', fade.toFixed(3));
  intro.classList.toggle('gone', fade <= 0.01);
  note.style.visibility = fade <= 0.01 ? 'hidden' : '';
  captions.forEach((li, i) => li.classList.toggle('on', p >= bands[i][0] && p < bands[i][1]));
}

/* ---------- Vue éclatée ---------- */
const objet = $('#objet');
const partItems = $$('#parts li');
function onScrollObjet() {
  if (!exploded) return;
  const r = objet.getBoundingClientRect();
  const vh = window.innerHeight;
  const p = clamp01((-r.top + vh * 0.35) / ((r.height - vh) * 0.45));
  // Mobile : le canvas tient la moitié haute, on lit dans la moitié basse.
  const mid = window.innerWidth < 860 ? vh * 0.74 : vh * 0.55;
  let active = null;
  for (const li of partItems) {
    const b = li.getBoundingClientRect();
    const on = b.top < mid && b.bottom > mid;
    li.classList.toggle('on', on);
    if (on) active = li.dataset.part;
  }
  exploded.set(p, active);
}

/* ---------- Étapes de montage ---------- */
const steps = $('#steps');
const fill = $('#steps-fill');
const stepEls = $$('.step');
function onScrollSteps() {
  const r = steps.getBoundingClientRect();
  const mark = window.innerHeight * 0.5;
  fill.style.transform = `scaleY(${clamp01((mark - r.top) / r.height)})`;
  for (const st of stepEls) st.classList.toggle('passed', st.getBoundingClientRect().top < mark);
}

/* ---------- Navigation locale ---------- */
const nav = $('#localnav');
const darkSections = $$('.stage, .film, .liste');
const navLinks = $$('.localnav nav a');
const targets = navLinks.map((a) => $(a.getAttribute('href')));
function onScrollNav() {
  const y = 26;
  nav.classList.toggle('dark', darkSections.some((s) => { const b = s.getBoundingClientRect(); return b.top <= y && b.bottom > y; }));
  let idx = -1;
  targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top < window.innerHeight * 0.4) idx = i; });
  navLinks.forEach((a, i) => a.setAttribute('aria-current', i === idx ? 'true' : 'false'));
}

function onScroll() { onScrollStage(); onScrollObjet(); onScrollSteps(); onScrollNav(); }
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { onScroll(); ticking = false; });
}, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

/* ---------- Schéma de câblage ---------- */
const WIRES = [
  { color: '#8e8e93', name: 'gris', screen: 'VCC', esp: '3V3', role: 'Alimentation 3,3 V' },
  { color: '#7a4a2a', name: 'marron', screen: 'GND', esp: 'GND', role: 'Masse' },
  { color: '#0a66d8', name: 'bleu', screen: 'DIN', esp: 'GPIO 23', role: 'Données SPI (MOSI)' },
  { color: '#e6b800', name: 'jaune', screen: 'CLK', esp: 'GPIO 18', role: 'Horloge SPI' },
  { color: '#f07a1a', name: 'orange', screen: 'CS', esp: 'GPIO 33', role: 'Sélection de l’écran' },
  { color: '#28a745', name: 'vert', screen: 'DC', esp: 'GPIO 25', role: 'Données ou commande' },
  { color: '#c7c7cc', name: 'blanc', screen: 'RST', esp: 'GPIO 26', role: 'Réinitialisation' },
  { color: '#8e44c9', name: 'violet', screen: 'BUSY', esp: 'GPIO 27', role: 'Écran occupé' },
];

function buildWiring() {
  const svg = $('#wiring-svg');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text) n.textContent = text;
    return n;
  };
  const mono = 'SF Mono, JetBrains Mono, monospace';
  svg.append(
    el('rect', { x: 36, y: 36, width: 170, height: 300, rx: 14, fill: '#1d1d1f' }),
    el('rect', { x: 58, y: 54, width: 80, height: 62, rx: 6, fill: '#d2d2d7' }),
    el('text', { x: 98, y: 90, 'text-anchor': 'middle', 'font-family': mono, 'font-size': 13, fill: '#1d1d1f' }, 'ESP32'),
    el('rect', { x: 440, y: 62, width: 168, height: 230, rx: 14, fill: '#1d4f9c' }),
    el('rect', { x: 462, y: 86, width: 124, height: 150, rx: 6, fill: '#ecebe6' }),
    el('text', { x: 524, y: 166, 'text-anchor': 'middle', 'font-family': mono, 'font-size': 12, fill: '#1d1d1f' }, 'e‑paper 4,2"'),
    el('rect', { x: 240, y: 300, width: 130, height: 44, rx: 10, fill: '#3a3a3c' }),
    el('text', { x: 305, y: 326, 'text-anchor': 'middle', 'font-family': mono, 'font-size': 12, fill: '#fff' }, '3 × AAA, 4,5 V'),
  );
  const wires = el('g', {});
  const labels = el('g', { 'font-family': mono, 'font-size': 11 });
  WIRES.forEach((w, i) => {
    const y1 = 132 + i * 20, y2 = 96 + i * 24;
    wires.appendChild(el('path', { class: 'wire', d: `M206 ${y1} C 320 ${y1}, 330 ${y2}, 440 ${y2}`, stroke: w.color, 'data-i': i }));
    labels.appendChild(el('text', { x: 198, y: y1 + 4, 'text-anchor': 'end', fill: '#d2d2d7' }, w.esp.replace('GPIO ', 'D')));
    labels.appendChild(el('circle', { cx: 206, cy: y1, r: 3.5, fill: '#f5f5f7' }));
    labels.appendChild(el('circle', { cx: 440, cy: y2, r: 3.5, fill: '#f5f5f7' }));
    labels.appendChild(el('text', { x: 616, y: y2 + 4, fill: '#1d1d1f' }, w.screen));
  });
  wires.appendChild(el('path', { class: 'wire', d: 'M206 300 C 230 300, 240 312, 262 312', stroke: '#e0352b' }));
  wires.appendChild(el('path', { class: 'wire', d: 'M206 320 C 226 320, 236 332, 262 332', stroke: '#000' }));
  labels.appendChild(el('text', { x: 198, y: 304, 'text-anchor': 'end', fill: '#d2d2d7' }, 'VIN'));
  labels.appendChild(el('text', { x: 198, y: 324, 'text-anchor': 'end', fill: '#d2d2d7' }, 'GND'));
  svg.append(wires, labels);

  const tbody = $('#pins tbody');
  const focusWire = (i) => {
    svg.classList.toggle('focus', i !== null);
    $$('.wire[data-i]', svg).forEach((p) => p.classList.toggle('hot', p.dataset.i === String(i)));
    [...tbody.rows].forEach((row, k) => row.classList.toggle('hot', k === i));
  };
  WIRES.forEach((w, i) => {
    const tr = document.createElement('tr');
    tr.tabIndex = 0;
    tr.innerHTML = `<td><span class="swatch" style="background:${w.color}"></span>${w.name}</td><td>${w.screen}</td><td>${w.esp}</td><td>${w.role}</td>`;
    tr.addEventListener('mouseenter', () => focusWire(i));
    tr.addEventListener('focus', () => focusWire(i));
    tr.addEventListener('mouseleave', () => focusWire(null));
    tr.addEventListener('blur', () => focusWire(null));
    tbody.appendChild(tr);
  });
  $$('.wire[data-i]', svg).forEach((p) => {
    p.addEventListener('mouseenter', () => focusWire(+p.dataset.i));
    p.addEventListener('mouseleave', () => focusWire(null));
  });
}
buildWiring();

/* ---------- Liste d'attente (démo, rien n'est envoyé) ---------- */
const form = $('#wait-form');
const email = $('#email');
const msg = $('#wait-msg');
const defaultMsg = msg.innerHTML;
email.addEventListener('input', () => {
  if (email.getAttribute('aria-invalid') === 'true' && email.validity.valid) {
    email.removeAttribute('aria-invalid');
    msg.className = 'wait-msg';
    msg.innerHTML = defaultMsg;
  }
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!email.value.trim() || !email.validity.valid) {
    email.setAttribute('aria-invalid', 'true');
    msg.className = 'wait-msg err';
    msg.textContent = 'Entrez une adresse complète, par exemple prenom@exemple.fr.';
    email.focus();
    return;
  }
  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Inscription…';
  setTimeout(() => {
    form.classList.add('done');
    btn.textContent = 'Inscrit';
    msg.className = 'wait-msg ok';
    msg.textContent = 'C’est noté. Démonstration : rien n’a été envoyé ni enregistré.';
  }, 700);
});

/* ---------- Vidéo chargée au clic ---------- */
$('#yt').addEventListener('click', function () {
  const f = document.createElement('iframe');
  f.src = 'https://www.youtube-nocookie.com/embed/4oJ5NzMS_1s?autoplay=1&rel=0';
  f.title = "J'ai inventé un objet tech qui n'existait pas";
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  f.allowFullscreen = true;
  this.replaceChildren(f);
}, { once: true });
