// Écran e-ink 400 × 300 : simulation des passages et dessin 1 bit, partagé
// entre l'objet 3D et la réplique 2D du simulateur.

export const STATIONS = {
  nation: { name: 'Nation', line: '1', dir: 'La Défense', headway: 3.4, seed: 11 },
  clichy: { name: 'Place de Clichy', line: '2', dir: 'Porte Dauphine', headway: 4.6, seed: 23 },
  chatelet: { name: 'Châtelet', line: '14', dir: 'Saint-Denis Pleyel', headway: 2.6, seed: 37 },
};

const PAPER = '#ecebe6';
const INK = '#16181d';

function rand(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Horaires fictifs mais stables : intervalle de base ± variation, calculés
// depuis minuit pour que deux visiteurs voient les mêmes passages.
export function nextTrains(stationKey, now = new Date(), count = 4) {
  const st = STATIONS[stationKey];
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const nowS = (now - midnight) / 1000;
  const out = [];
  let t = st.seed * 7;
  let k = 0;
  while (out.length < count && k < 2000) {
    t += (st.headway + (rand(k + st.seed) - 0.35) * 2.2) * 60;
    if (t > nowS) out.push((t - nowS) / 60);
    k++;
  }
  return out;
}

export function computeDeparture(stationKey, walk, now = new Date()) {
  const trains = nextTrains(stationKey, now, 5);
  const idx = trains.findIndex((m) => m >= walk);
  const train = trains[idx];
  const leave = Math.max(0, Math.floor(train - walk));
  return {
    station: STATIONS[stationKey],
    walk,
    now,
    leave,
    trainIn: Math.floor(train),
    thenIn: Math.floor(trains[idx + 1]),
  };
}

// Clé de ce qui est affiché : l'écran ne se redessine que si elle change.
export function displayKey(d) {
  const hh = d.now.getHours(), mm = d.now.getMinutes();
  return [d.station.name, hh, mm, d.leave, d.trainIn, d.thenIn, d.walk].join('|');
}

const FONT = '"Familjen Grotesk", "Helvetica Neue", Arial, sans-serif';

export function drawScreen(ctx, d, phase = 'content') {
  const W = 400, H = 300;
  const s = ctx.canvas.width / W;
  ctx.setTransform(s, 0, 0, s, 0, 0);

  // Rafraîchissement complet e-ink : noir puis blanc avant l'image.
  if (phase === 'black' || phase === 'white') {
    ctx.fillStyle = phase === 'black' ? INK : PAPER;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.textBaseline = 'alphabetic';

  // Pastille de ligne : en noir et blanc, comme sur un vrai écran 1 bit.
  ctx.beginPath();
  ctx.arc(34, 34, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.font = `700 ${d.station.line.length > 1 ? 13 : 15}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(d.station.line, 34, 39.5);

  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.font = `600 19px ${FONT}`;
  ctx.fillText(d.station.name, 56, 41);

  const hh = String(d.now.getHours()).padStart(2, '0');
  const mm = String(d.now.getMinutes()).padStart(2, '0');
  ctx.textAlign = 'right';
  ctx.font = `500 19px ${FONT}`;
  ctx.fillText(`${hh}:${mm}`, W - 22, 41);

  ctx.fillRect(22, 60, W - 44, 2);

  ctx.textAlign = 'left';
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText(d.leave === 0 ? 'C’est le moment' : 'Partez dans', 22, 92);

  if (d.leave === 0) {
    ctx.font = `700 86px ${FONT}`;
    ctx.fillText('Partez', 18, 196);
  } else {
    ctx.font = `700 150px ${FONT}`;
    const num = String(d.leave);
    ctx.fillText(num, 14, 222);
    const w = ctx.measureText(num).width;
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText('min', 14 + w + 10, 220);
  }

  ctx.fillRect(22, 242, W - 44, 1.5);
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText(`Métro dans ${d.trainIn} min, puis ${d.thenIn} min`, 22, 270);
  ctx.textAlign = 'right';
  ctx.fillText(`à pied ${d.walk} min`, W - 22, 270);
}

// Joue la séquence de rafraîchissement complet, comme un vrai panneau.
export function fullRefresh(paint, d, onDone) {
  const steps = [['black', 140], ['white', 110], ['black', 90], ['content', 0]];
  let i = 0;
  const run = () => {
    const [phase, wait] = steps[i++];
    paint(d, phase);
    if (i < steps.length) setTimeout(run, wait);
    else if (onDone) onDone();
  };
  run();
}
