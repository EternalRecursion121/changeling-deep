// Two ways to draw the same Deep, switchable in play so they can be compared:
//   pixel:  Kenney's 1-Bit Pack (CC0), one ink per region on black
//   pencil: graphite on paper, hatched cave walls, doodled characters (pencil.ts)
// Each style draws the static map once into a big canvas, and gives sprites for anything that moves.

import { atkinson, rng, valueNoise } from './dither';
import { COLS, Cell, Npc, T, TILE, areaAt } from './dungeon';
import { GRAPHITE, Pen, Spec, doodle, paper, randomSpec } from './pencil';
import { REGIONS, region } from './world';

export interface Style {
  id: 'pixel' | 'pencil'; ts: number; bg: string;
  fog: CanvasPattern | string;
  layer(g: Cell[][]): HTMLCanvasElement;
  npc(n: Npc): HTMLCanvasElement;
  tile(index: number, hue: string): HTMLCanvasElement;   // gates and other changing tiles
  gate(open: boolean, hue: string): HTMLCanvasElement;
  portrait(c: HTMLCanvasElement, n: Npc): void;
  dim: number;   // how strongly remembered-but-unseen tiles are covered
  tall: number;  // a character sprite's height in tiles (it stands on its tile and may rise above it)
}

export const hueAt = (x: number, y: number) => region(areaAt(x, y) ?? 'antechamber').hue;
const PALETTE = REGIONS.map((r) => r.hue);
const npcHue = (n: Npc) => n.hue !== undefined ? PALETTE[n.hue % PALETTE.length] : hueAt(n.x, n.y);
const SCALE = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));

// ---------- pixel ----------

export function pixelStyle(sheet: HTMLImageElement): Style {
  const ts = 48, k = ts / TILE, cache = new Map<string, HTMLCanvasElement>();
  const tile = (i: number, hue: string, alpha = 1) => {
    const key = `${i}|${hue}|${alpha}`;
    if (cache.has(key)) return cache.get(key)!;
    const c = document.createElement('canvas'); c.width = c.height = ts;
    const x = c.getContext('2d')!; x.imageSmoothingEnabled = false;
    x.drawImage(sheet, (i % COLS) * TILE, Math.floor(i / COLS) * TILE, TILE, TILE, 0, 0, ts, ts);
    x.globalCompositeOperation = 'source-in'; x.globalAlpha = alpha; x.fillStyle = hue; x.fillRect(0, 0, ts, ts);
    cache.set(key, c); return c;
  };
  const near = (g: Cell[][], x: number, y: number) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => g[y + dy]?.[x + dx] && !g[y + dy][x + dx].solid || g[y + dy]?.[x + dx]?.t !== '#' && g[y + dy]?.[x + dx] !== undefined && g[y + dy][x + dx].t !== '#'));
  return {
    id: 'pixel', ts, bg: '#060507', fog: '#060507', dim: 0.72, tall: 1, tile: (i, h) => tile(i, h),
    layer(g) {
      const c = document.createElement('canvas'); c.width = g[0].length * ts; c.height = g.length * ts;
      const x = c.getContext('2d')!, r = rng(4);
      g.forEach((row, y) => row.forEach((cell, X) => {
        const hue = hueAt(X, y);
        if (cell.t === '#') { if (near(g, X, y)) x.drawImage(tile((X * 7 + y * 3) % 5 ? T.wall : T.wallB, hue, 0.38), X * ts, y * ts); return; }
        const f = T.floor[Math.floor(r() * T.floor.length)];
        if (f) x.drawImage(tile(f, hue, 0.16), X * ts, y * ts);
        if (cell.deco !== undefined) x.drawImage(tile(cell.deco, hue, cell.t === '~' ? 0.45 : 0.95), X * ts, y * ts);
      }));
      return c;
    },
    npc: (n) => tile(n.sprite, npcHue(n)),
    gate: (open, hue) => tile(open ? T.door : T.locked, hue, open ? 0.9 : 1),
    portrait(c, n) {
      const w = c.width, h = c.height, x = c.getContext('2d')!, hue = npcHue(n);
      const nz = valueNoise(w, h, 8, 3), a = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) a[y * w + X] = 0.32 * Math.exp(-((X / w - 0.5) ** 2 + (y / h - 0.5) ** 2) / 0.06) + 0.08 * (nz[y * w + X] - 0.5);
      const on = atkinson(a, w, h), img = x.createImageData(w, h), [R, G, B] = [1, 3, 5].map((j) => parseInt(hue.slice(j, j + 2), 16));
      on.forEach((v, i) => v && img.data.set([R, G, B, 140], i * 4)); x.putImageData(img, 0, 0);
      x.imageSmoothingEnabled = false; const s = Math.floor(Math.min(w, h) * 0.7 / TILE) * TILE;
      x.drawImage(tile(n.sprite, hue), (w - s) / 2, (h - s) / 2, s, s);
    },
  };
}

// ---------- pencil ----------

const NAMED: Record<string, Spec> = {
  you: { kind: 'person', head: 'hood', hat: 'none', body: 'robe', prop: 'lantern' },
  odile: { kind: 'person', head: 'plain', hat: 'shawl', body: 'robe', prop: 'taper', stoop: 3 },
  aldous: { kind: 'person', head: 'bald', hat: 'none', body: 'round', prop: 'keys', beard: true },
  miller: { kind: 'person', head: 'plain', hat: 'cap', body: 'tunic', prop: 'sack' },
  bellringer: { kind: 'person', head: 'hair', hat: 'none', body: 'thin', prop: 'bell' },
  widow: { kind: 'person', head: 'veil', hat: 'brim', body: 'robe', prop: 'flower' },
  archivist: { kind: 'ghost' },
};
export const specOf = (n: Npc) => NAMED[n.id] ?? randomSpec(/^m\d+$/.test(n.id) ? Number(n.id.slice(1)) + 1 : seedOf(n.id));
export const seedOf = (id: string) => [...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
// the region inks are made for black; on paper they need to be darker to read
const deepen = (hex: string, f = 0.5) => [1, 3, 5].map((j) => Math.round(parseInt(hex.slice(j, j + 2), 16) * f)).join(',');

export function pencilStyle(): Style {
  const ts = 60, sc = SCALE, ls = Math.min(SCALE, 1.5), cache = new Map<string, HTMLCanvasElement>();
  const pap = paper(256, 256), fog = document.createElement('canvas').getContext('2d')!.createPattern(pap, 'repeat')!;
  const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w * sc; c.height = h * sc; return c; };
  const glyph = (key: string, draw: (p: Pen) => void, hue?: string) => {
    if (cache.has(key)) return cache.get(key)!;
    const c = canvas(ts, ts), p = new Pen(c.getContext('2d')!, rng(seedOf(key)), ts / 64 * sc, hue ? deepen(hue) : GRAPHITE);
    draw(p); cache.set(key, c); return c;
  };
  return {
    id: 'pencil', ts, bg: '#ede6d8', fog, dim: 0.5, tall: 1.5,
    tile: (i, h) => glyph(`t${i}`, (p) => deco(p, i), h),
    layer(g) {
      const H = g.length, W = g[0].length, c = document.createElement('canvas'), x = c.getContext('2d')!;
      c.width = W * ts * ls; c.height = H * ts * ls;
      x.drawImage(pap, 0, 0); for (let y = 0; y < c.height; y += 256) for (let X = 0; X < c.width; X += 256) x.drawImage(pap, X, y);
      const k = ls, p = new Pen(x, rng(11), k), u = ts;   // world units = css px
      const floor = (X: number, y: number) => !!g[y]?.[X] && g[y][X].t !== '#';
      // faint grid on the floor, as on a surveyor's sheet
      for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) if (floor(X, y)) {
        if (floor(X + 1, y)) p.line((X + 1) * u, y * u + 4, (X + 1) * u, (y + 1) * u - 4, { passes: 1, a: 0.08, amp: 0.6 });
        if (floor(X, y + 1)) p.line(X * u + 4, (y + 1) * u, (X + 1) * u - 4, (y + 1) * u, { passes: 1, a: 0.08, amp: 0.6 });
      }
      // walls: an edge line where rock meets floor, then rough clusters of hatching that thin out into the rock
      for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) {
        if (floor(X, y)) continue;
        let d = 9;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (floor(X + dx, y + dy)) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)));
        if (d > 3) continue;
        const n = d === 1 ? 7 : d === 2 ? 3 : p.r() < 0.5 ? 1 : 0;
        if (d === 1 && p.r() < 0.5) p.ellipse((X + p.r()) * u, (y + p.r()) * u, 2 + p.r() * 3, 1.5 + p.r() * 2.5, { passes: 1, a: 0.5 });   // loose stones
        for (let i = 0; i < n; i++) {
          const cx = (X + p.r()) * u, cy = (y + p.r()) * u, a = p.r() * 3.14, L = 9 + p.r() * 8, m = 3 + Math.floor(p.r() * 3);
          for (let j = 0; j < m; j++) {
            const o = (j - m / 2) * 3.2, dx = Math.cos(a), dy = Math.sin(a);
            p.line(cx - dx * L / 2 - dy * o, cy - dy * L / 2 + dx * o, cx + dx * L / 2 - dy * o, cy + dy * L / 2 + dx * o, { passes: 1, a: [0, 0.62, 0.36, 0.2][d], amp: 0.7 });
          }
        }
        if (floor(X, y + 1)) p.line(X * u - 2, (y + 1) * u, (X + 1) * u + 2, (y + 1) * u, { w: 2.2, a: 0.9 });
        if (floor(X, y - 1)) p.line(X * u - 2, y * u, (X + 1) * u + 2, y * u, { w: 2.2, a: 0.9 });
        if (floor(X + 1, y)) p.line((X + 1) * u, y * u - 2, (X + 1) * u, (y + 1) * u + 2, { w: 2.2, a: 0.9 });
        if (floor(X - 1, y)) p.line(X * u, y * u - 2, X * u, (y + 1) * u + 2, { w: 2.2, a: 0.9 });
      }
      // things in the rooms
      g.forEach((row, y) => row.forEach((cell, X) => { if (cell.deco !== undefined) x.drawImage(glyph(`t${cell.deco}`, (q) => deco(q, cell.deco!), hueAt(X, y)), X * u * k, y * u * k, u * k, u * k); }));
      return c;
    },
    npc(n) {
      const key = `n${n.id}|${npcHue(n)}`;
      if (cache.has(key)) return cache.get(key)!;
      const c = canvas(ts, ts * 1.5); doodle(c.getContext('2d')!, specOf(n), seedOf(n.id), ts / 64 * sc, deepen(npcHue(n), 0.55));
      cache.set(key, c); return c;
    },
    gate: (open, hue) => glyph(open ? 'gate-open' : 'gate-shut', (p) => {
      p.path([[14, 60], [14, 12], [32, 4], [50, 12], [50, 60]], { w: 1.4 });
      if (!open) { p.hatch((c) => c.rect(14 * p.k, 8 * p.k, 36 * p.k, 52 * p.k), 1.57, 4, [14, 4, 50, 60], { a: 0.5 }); p.ellipse(32, 36, 6, 6, { w: 1.3 }); p.line(32, 33, 32, 40); }
    }, hue),
    portrait(c, n) {
      const x = c.getContext('2d')!; x.drawImage(pap, 0, 0);
      for (let X = 0; X < c.width; X += 256) for (let y = 0; y < c.height; y += 256) x.drawImage(pap, X, y);
      const k = Math.min(c.width / 64, c.height / 96); x.translate((c.width - 64 * k) / 2, (c.height - 96 * k) / 2);
      doodle(x, specOf(n), seedOf(n.id), k, deepen(npcHue(n), 0.55));
    },
  };
}

// small furniture of the Deep, by the same tile index the pixel style uses
function deco(p: Pen, i: number) {
  const r = p.r;
  if (i === T.stairs) for (let y = 14; y <= 54; y += 8) p.line(12, y, 52, y + (r() - 0.5) * 2, { w: 1.2 });
  else if (i === T.candle || i === T.candle2) { p.path([[27, 58], [27, 34], [37, 34], [37, 58]], { w: 1.1 }); p.line(22, 58, 42, 58); p.path([[32, 32], [29, 24], [32, 16], [35, 24], [32, 32]], { a: 0.9 }); p.line(32, 34, 32, 30, { passes: 1 }); }
  else if (i === T.pillar) { p.ellipse(32, 32, 16, 16, { w: 1.4 }); p.hatch((c) => c.arc(32 * p.k, 32 * p.k, 16 * p.k, 0, 6.3), 0.8, 3, [16, 16, 48, 48]); }
  else if ((T.bottle as readonly number[]).includes(i)) { const w = 6 + (i % 3) * 2, h = 18 + (i % 4) * 4; p.path([[32 - w, 60], [32 - w, 60 - h], [30, 60 - h - 6], [30, 60 - h - 12], [34, 60 - h - 12], [34, 60 - h - 6], [32 + w, 60 - h], [32 + w, 60]], { closed: true }); p.hatch((c) => c.rect((32 - w) * p.k, (60 - h / 2) * p.k, w * 2 * p.k, h / 2 * p.k), 0.5, 2.5, [32 - w, 60 - h, 32 + w, 60]); }
  else if (i === T.cauldron) { p.ellipse(32, 40, 20, 16, { w: 1.4 }); p.ellipse(32, 28, 20, 5); p.hatch((c) => c.ellipse(32 * p.k, 44 * p.k, 18 * p.k, 12 * p.k, 0, 0, 3.14), 0.6, 2.4, [12, 32, 52, 56]); for (let j = 0; j < 3; j++) p.ellipse(26 + j * 6, 16 - j * 3, 3, 3, { passes: 1, a: 0.5 }); }
  else if (i === T.table) { p.path([[6, 30], [58, 26], [60, 34], [8, 38]], { closed: true, w: 1.2 }); p.line(12, 37, 12, 58); p.line(54, 33, 54, 56); }
  else if (i === T.web) { for (let a = 0; a < 5; a++) p.line(2, 2, 2 + Math.cos(a * 0.39) * 50, 2 + Math.sin(a * 0.39) * 50, { passes: 1, a: 0.45 }); for (const R of [14, 26, 38]) p.path(Array.from({ length: 6 }, (_, j) => [2 + Math.cos(j * 0.31) * R, 2 + Math.sin(j * 0.31) * R] as [number, number]), { passes: 1, a: 0.4 }); }
  else if ((T.mask as readonly number[]).includes(i)) { p.ellipse(32, 30, 13, 17, { w: 1.2 }); p.path([[24, 26], [28, 24], [30, 27]], { w: 1.2 }); p.path([[34, 27], [36, 24], [40, 26]], { w: 1.2 }); p.path([[27, 40], [32, 38 + (i % 2) * 4], [37, 40]], { passes: 1 }); p.line(32, 13, 32, 2, { passes: 1, a: 0.5 }); }
  else if (i === T.books) { for (let x = 6; x < 58; x += 5 + r() * 3) { const h = 30 + r() * 18; p.path([[x, 58], [x, 58 - h], [x + 4, 58 - h], [x + 4, 58]], { passes: 1 }); } p.line(2, 58, 62, 58, { w: 1.3 }); }
  else if (i === T.water) for (let y = 12; y < 60; y += 10) p.path(Array.from({ length: 8 }, (_, j) => [4 + j * 8, y + (j % 2 ? 2 : -2)] as [number, number]), { passes: 1, a: 0.45 });
  else if (i === T.locked || i === T.door) p.path([[14, 60], [14, 12], [32, 4], [50, 12], [50, 60]], { w: 1.4 });
  else p.ellipse(32, 32, 10, 10);
}

