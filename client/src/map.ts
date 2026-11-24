// The map of the Deep: regions as lit chambers on black, paths between them, and a dithered fog over
// everything not yet earned. When a region opens, the fog burns off it pixel by pixel outward from the
// node, the agenda page's dissolve (distance plus a Bayer threshold), so earning ground feels physical.

import { atkinson, rgb, valueNoise } from './dither';
import { PATHS, REGIONS, Region, State, nextRank, rank, region } from './world';

const SVG = 'http://www.w3.org/2000/svg';
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const FOG = '#4a4552';
const PX = 3;          // fog pixel size in CSS px
const CLEAR = 0.13;    // radius of a region's clearing, as a fraction of the map's width
const REVEAL_MS = 1800;

export function mapScreen(root: HTMLElement, s: State, enter: (id: string) => void, justOpened: string[] = []) {
  const r = rank(s.xp), nx = nextRank(s.xp);
  root.innerHTML = `
    <main class="map-screen">
      <header class="bar">
        <h1>Changeling Deep</h1>
        <div class="rank"><span class="rank-name">${r.name}</span>
          <span class="xp"><span class="xp-fill" style="width:${nx ? (100 * (s.xp - r.xp)) / (nx.xp - r.xp) : 100}%"></span></span>
          <span class="xp-num">${s.xp} xp${nx ? ` · ${nx.xp - s.xp} to ${nx.name}` : ''}</span></div>
      </header>
      <section class="map-wrap">
        <div class="map" id="map"><svg id="map-svg"></svg><canvas id="fog"></canvas><div id="map-labels"></div></div>
        <aside class="panel" id="panel"></aside>
      </section>
    </main>`;
  const map = root.querySelector<HTMLDivElement>('#map')!, svg = root.querySelector<SVGSVGElement>('#map-svg')!;
  const fog = root.querySelector<HTMLCanvasElement>('#fog')!, labels = root.querySelector<HTMLDivElement>('#map-labels')!;
  const panel = root.querySelector<HTMLElement>('#panel')!;
  let chosen = justOpened[0] || s.open.filter((id) => !s.cleared.includes(id)).at(-1) || 'antechamber';
  const born = new Map<string, number>(justOpened.map((id) => [id, performance.now() + 500]));

  function showPanel(id: string) {
    chosen = id;
    const g = region(id), open = s.open.includes(id), done = s.cleared.includes(id), built = id === 'antechamber';
    panel.style.setProperty('--hue', open ? g.hue : FOG);
    panel.innerHTML = open ? `
      <p class="kicker">Region ${g.n} · ${g.game === 'both' ? 'potions and shapeshifters' : g.game}</p>
      <h2>${g.name}</h2>
      <p class="line">${g.line}</p>
      ${done ? '<p class="note">Cleared. You can go back in for practice.</p>' : ''}
      ${built ? `<button class="go" id="enter">${done ? 'Go back down' : 'Go down'}</button>`
              : '<p class="note">No rooms built here yet in this prototype.</p>'}`
    : `
      <p class="kicker">Region ${g.n}</p>
      <h2 class="fogged">Fog</h2>
      <p class="line">Nobody you know has come back from here with a reading.</p>
      <p class="note">${g.opens}</p>`;
    panel.querySelector('#enter')?.addEventListener('click', () => enter(id));
    for (const el of labels.querySelectorAll<HTMLElement>('.node')) el.classList.toggle('on', el.dataset.id === id);
  }

  function draw() {
    const W = map.clientWidth, H = map.clientHeight;
    if (!W || !H) return;   // detached (we left for a room) or not laid out yet
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    const P = (g: Region) => [g.x * W, g.y * H];
    for (const [a, b] of PATHS) {
      const A = region(a), B = region(b), [x1, y1] = P(A), [x2, y2] = P(B);
      const lit = s.open.includes(a) && s.open.includes(b);
      const p = document.createElementNS(SVG, 'path');
      const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12, my = (y1 + y2) / 2 - (x2 - x1) * 0.06;
      p.setAttribute('d', `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`);
      p.setAttribute('class', lit ? 'path lit' : 'path');
      svg.append(p);
    }
    labels.innerHTML = '';
    for (const g of REGIONS) {
      const [x, y] = P(g), open = s.open.includes(g.id);
      const el = document.createElement('button');
      el.className = `node${open ? ' open' : ''}${s.cleared.includes(g.id) ? ' cleared' : ''}${born.has(g.id) ? ' new' : ''}`;
      el.dataset.id = g.id; el.style.left = `${x}px`; el.style.top = `${y}px`;
      el.style.setProperty('--hue', open ? g.hue : FOG);
      el.setAttribute('aria-label', open ? g.name : `Region ${g.n}, in fog`);
      el.innerHTML = `<span class="pip"></span><span class="name">${open ? g.name.replace(/^The /, '') : ''}</span>`;
      el.addEventListener('click', () => showPanel(g.id));
      labels.append(el);
    }
    buildFog(W, H);
    showPanel(chosen);
  }

  // the fog: one dither of slow noise at full strength, computed once per size; each frame decides which
  // of its pixels still stand, from each open region's clearing as it grows
  let fogOn: Uint8Array, fw = 0, fh = 0, ctx: CanvasRenderingContext2D, img: ImageData;
  function buildFog(W: number, H: number) {
    fw = Math.ceil(W / PX); fh = Math.ceil(H / PX);
    fog.width = fw; fog.height = fh;
    const n = valueNoise(fw, fh, 22, 5), m = valueNoise(fw, fh, 6, 9), a = new Float32Array(fw * fh);
    for (let i = 0; i < a.length; i++) a[i] = 0.1 + 0.32 * n[i] ** 1.5 + 0.12 * m[i];
    fogOn = atkinson(a, fw, fh);
    ctx = fog.getContext('2d')!; img = ctx.createImageData(fw, fh);
    frame();
  }
  function frame() {
    const now = performance.now(), R = CLEAR * fw, feather = R * 0.55, [r, g, b] = rgb(FOG);
    const centres = s.open.map((id) => {
      const G = region(id), t0 = born.get(id);
      const k = t0 === undefined ? 1 : Math.max(0, Math.min(1, (now - t0) / REVEAL_MS));
      return [G.x * fw, G.y * fh, 1 - (1 - k) ** 3] as const;
    });
    const d = img.data;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const i = y * fw + x;
      let lift = 0;
      for (const [cx, cy, k] of centres) {
        if (k <= 0) continue;
        const dist = Math.hypot(x - cx, (y - cy) * 1.15);
        lift = Math.max(lift, (k * (R + feather) - dist) / feather);
      }
      const stand = fogOn[i] && lift < BAYER[(y & 3) * 4 + (x & 3)] / 16;
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = stand ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
    if ([...born.values()].some((t0) => now - t0 < REVEAL_MS)) requestAnimationFrame(frame);
  }

  new ResizeObserver(() => draw()).observe(map);   // fires once on observe, which is the first draw
}
