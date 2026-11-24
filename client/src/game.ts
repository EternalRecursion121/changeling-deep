// The Deep, walked. WASD or arrows to move a tile at a time (hold to keep walking), E or Space to talk to
// whoever you face, 1 and 2 to switch between the pixel and pencil art. The lantern lights a radius around
// you; what you have seen stays on the map, dimmed. In the pencil style unseen ground is blank paper, so
// the map draws itself as you explore.

import { Style, hueAt, pencilStyle, pixelStyle } from './art';
import { Cell, Gate, Npc, areaAt, build } from './dungeon';
import { roomScreen } from './room';
import { State, clear, rank, nextRank, region, save } from './world';

const RADIUS = 6.5, STEP_MS = 125;
type Dir = [number, number];
const KEYS: Record<string, Dir> = {
  w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0],
};

export function game(root: HTMLElement, s: State, sheet: HTMLImageElement) {
  const { g, gates, npcs, start } = build();
  const W = g[0].length, H = g.length;
  const styles = { pixel: pixelStyle(sheet), pencil: pencilStyle() };
  let style: Style = styles[pickStyle()], layer = style.layer(g);
  const layers = new Map<string, HTMLCanvasElement>([[style.id, layer]]);

  root.innerHTML = `
    <div class="world">
      <canvas id="view"></canvas>
      <header class="hud">
        <span class="title">Changeling Deep</span>
        <span class="here" id="here"></span>
        <span class="rank" id="rank"></span>
        <span class="styles"><button data-s="pixel">1 Pixel</button><button data-s="pencil">2 Pencil</button></span>
      </header>
      <p class="toast" id="toast"></p>
      <p class="hint" id="hint">WASD to walk · E to talk · 1 / 2 to switch art</p>
      <div class="overlay" id="overlay" hidden></div>
    </div>`;
  const view = root.querySelector<HTMLCanvasElement>('#view')!, ctx = view.getContext('2d')!;
  const toastEl = root.querySelector<HTMLElement>('#toast')!, overlay = root.querySelector<HTMLElement>('#overlay')!;

  const me = { x: start.x, y: start.y, fx: start.x, fy: start.y, face: [0, 1] as Dir, moved: 0 };
  const seen = new Uint8Array(W * H), lit = new Float32Array(W * H);
  const gateOpen = (gt: Gate) => gt.region !== 'deeper' && s.open.includes(gt.region);
  const solidAt = (x: number, y: number) => !g[y]?.[x] || g[y][x].solid || gates.some((gt) => gt.x === x && gt.y === y && !gateOpen(gt));
  const npcAt = (x: number, y: number) => npcs.find((n) => n.x === x && n.y === y);

  // ---- art switching ----
  function pickStyle(): 'pixel' | 'pencil' {
    try { return localStorage.getItem('cd-style') === 'pencil' ? 'pencil' : 'pixel'; } catch { return 'pixel'; }
  }
  function setStyle(id: 'pixel' | 'pencil') {
    style = styles[id];
    if (!layers.has(id)) layers.set(id, style.layer(g));
    layer = layers.get(id)!;
    document.body.classList.toggle('pencil', id === 'pencil');
    root.querySelectorAll<HTMLButtonElement>('.styles button').forEach((b) => b.classList.toggle('on', b.dataset.s === id));
    try { localStorage.setItem('cd-style', id); } catch { /* */ }
  }
  root.querySelectorAll<HTMLButtonElement>('.styles button').forEach((b) => b.addEventListener('click', () => { setStyle(b.dataset.s as 'pixel'); b.blur(); }));
  setStyle(style.id);

  // ---- sight: a tile is lit if a straight line to it from the lantern passes only through open ground ----
  function look() {
    lit.fill(0);
    const R = Math.ceil(RADIUS);
    for (let y = me.y - R; y <= me.y + R; y++) for (let x = me.x - R; x <= me.x + R; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const d = Math.hypot(x - me.x, y - me.y);
      if (d > RADIUS || !clearLine(me.x, me.y, x, y)) continue;
      lit[y * W + x] = 1 - (d / RADIUS) ** 2 * 0.7; seen[y * W + x] = 1;
    }
  }
  function clearLine(x0: number, y0: number, x1: number, y1: number) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 1; i < n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      if (g[y][x].t === '#' || g[y][x].t === 'p' || g[y][x].t === 'B') return false;
    }
    return true;
  }

  // ---- moving ----
  const held: Dir[] = [];
  let busy = false;
  function tryStep(d: Dir) {
    me.face = d;
    const x = me.x + d[0], y = me.y + d[1], n = npcAt(x, y), gt = gates.find((q) => q.x === x && q.y === y);
    if (n) return talk(n);
    if (gt && !gateOpen(gt)) return toast(gt.says);
    if (g[y]?.[x]?.t === 'S') return toast('The stair up to the Readers\' lodge. Not yet.');
    if (solidAt(x, y)) return;
    me.x = x; me.y = y; me.moved = performance.now();
    look(); arrive();
  }
  let lastArea = '';
  function arrive() {
    const a = areaAt(me.x, me.y);
    if (a && a !== lastArea) { lastArea = a; root.querySelector('#here')!.textContent = region(a).name; toast(region(a).name, true); }
  }
  function talk(n: Npc) {
    if (n.room) return enter(n);
    toast(`${n.name} ${n.idle ?? 'says nothing'}.`);
  }
  function enter(n: Npc) {
    busy = true; overlay.hidden = false; held.length = 0;
    roomScreen(overlay, s, n.room!, (c) => style.portrait(c, n), (xp, passed) => {
      s.xp += xp;
      const opened = passed ? clear(s, n.room!) : [];
      save(s); overlay.hidden = true; overlay.innerHTML = ''; busy = false; hud();
      if (opened.length) toast(`The seals break: ${opened.map((id) => region(id).name).join(' and ')} ${opened.length > 1 ? 'are' : 'is'} open.`);
    });
  }

  let toastT = 0;
  function toast(text: string, title = false) {
    toastEl.textContent = text; toastEl.className = `toast show${title ? ' title' : ''}`;
    clearTimeout(toastT); toastT = window.setTimeout(() => (toastEl.className = 'toast'), title ? 1800 : 3600);
  }
  function hud() {
    const r = rank(s.xp), nx = nextRank(s.xp);
    root.querySelector('#rank')!.textContent = `${r.name} · ${s.xp} xp${nx ? ` / ${nx.xp}` : ''}`;
  }

  addEventListener('keydown', (e) => {
    if (busy) { if (e.key === 'Escape') overlay.querySelector<HTMLButtonElement>('#back')?.click(); return; }
    const k = e.key.toLowerCase();
    if (k === '1') return setStyle('pixel');
    if (k === '2') return setStyle('pencil');
    if (k === 'e' || k === ' ' || k === 'enter') { e.preventDefault(); const n = npcAt(me.x + me.face[0], me.y + me.face[1]); if (n) talk(n); return; }
    const d = KEYS[k];
    if (!d) return;
    e.preventDefault();
    if (!held.some((h) => h === d)) { held.push(d); if (performance.now() - me.moved > STEP_MS * 0.6) tryStep(d); }
    root.querySelector('#hint')!.classList.add('gone');
  });
  addEventListener('keyup', (e) => { const d = KEYS[e.key.toLowerCase()]; const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); });
  addEventListener('blur', () => (held.length = 0));

  // the menagerie wanders
  setInterval(() => {
    if (busy) return;
    for (const n of npcs) if (n.wander && Math.random() < 0.3) {
      const d = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as Dir[])[Math.floor(Math.random() * 4)], x = n.x + d[0], y = n.y + d[1];
      if (!solidAt(x, y) && !npcAt(x, y) && !(x === me.x && y === me.y) && areaAt(x, y) === 'menagerie' && g[y][x].t === '.') { n.x = x; n.y = y; }
    }
  }, 700);
  const pos = new Map<string, [number, number]>(npcs.map((n) => [n.id, [n.x, n.y]]));

  // ---- drawing ----
  function frame(now: number) {
    if (!busy && held.length && now - me.moved > STEP_MS) tryStep(held[held.length - 1]);
    const dpr = window.devicePixelRatio || 1, cw = view.clientWidth, ch = view.clientHeight;
    if (view.width !== Math.round(cw * dpr)) { view.width = Math.round(cw * dpr); view.height = Math.round(ch * dpr); }
    const ts = style.ts * (cw < 700 ? 0.75 : 1);
    me.fx += (me.x - me.fx) * 0.32; me.fy += (me.y - me.fy) * 0.32;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = style.id === 'pencil';
    ctx.fillStyle = style.fog; ctx.fillRect(0, 0, cw, ch);
    const ox = cw / 2 - (me.fx + 0.5) * ts, oy = ch / 2 - (me.fy + 0.5) * ts;
    ctx.translate(Math.round(ox), Math.round(oy));
    ctx.drawImage(layer, 0, 0, layer.width, layer.height, 0, 0, W * ts, H * ts);
    for (const gt of gates) ctx.drawImage(style.gate(gateOpen(gt), hueAt(gt.x, gt.y)), gt.x * ts, gt.y * ts, ts, ts);
    // darkness and memory
    const x0 = Math.max(0, Math.floor(-ox / ts)), y0 = Math.max(0, Math.floor(-oy / ts));
    const x1 = Math.min(W, Math.ceil((cw - ox) / ts)), y1 = Math.min(H, Math.ceil((ch - oy) / ts));
    ctx.fillStyle = style.fog;
    const flick = style.id === 'pixel' ? 0.04 * Math.sin(now / 90) * Math.sin(now / 37) : 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * W + x, L = lit[i];
      const cover = !seen[i] ? 1 : L ? (style.id === 'pixel' ? Math.max(0, 1 - L - flick) * 0.9 : 0) : style.dim;
      if (cover <= 0.01) continue;
      ctx.globalAlpha = cover; ctx.fillRect(x * ts - 0.5, y * ts - 0.5, ts + 1, ts + 1);
    }
    ctx.globalAlpha = 1;
    for (const n of [...npcs].sort((a, b) => pos.get(a.id)![1] - pos.get(b.id)![1])) {   // back to front
      const p = pos.get(n.id)!; p[0] += (n.x - p[0]) * 0.2; p[1] += (n.y - p[1]) * 0.2;
      const L = lit[n.y * W + n.x]; if (!L) continue;   // only what the lantern shows
      ctx.globalAlpha = style.id === 'pixel' ? Math.min(1, 0.25 + L) : 1;
      const bob = Math.sin(now / 520 + n.x * 1.7 + n.y) * (style.id === 'pencil' ? 1.2 : 0);
      ctx.drawImage(style.npc(n), p[0] * ts, (p[1] + 1 - style.tall) * ts + bob, ts, ts * style.tall);
    }
    ctx.globalAlpha = 1;
    const walk = Math.min(1, (now - me.moved) / STEP_MS), hop = style.id === 'pixel' ? -Math.sin(walk * Math.PI) * 3 : -Math.sin(walk * Math.PI) * 2;
    ctx.drawImage(style.npc(YOU), me.fx * ts, (me.fy + 1 - style.tall) * ts + hop, ts, ts * style.tall);
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  look(); arrive(); hud();
  requestAnimationFrame(frame);
  return { cellAt: (x: number, y: number): Cell => g[y][x] };
}

const YOU: Npc = { id: 'you', x: 0, y: 0, sprite: 24, name: 'You', hue: 0 };
