// Pencil: scraggly hand-drawn marks. Every line is drawn twice with a slow wobble, ends overshoot,
// circles do not quite close. Characters are doodles assembled from seeded parts (body, head, hat, prop),
// so one generator makes the whole cast. Drawn in a 64-unit box; `k` scales it.

import { rng } from './dither';

export type R = () => number;
export const GRAPHITE = '40,38,36';

// a smooth 1-D noise along a stroke, from random knots
function noise1(r: R, n: number) {
  const knots = Array.from({ length: n + 2 }, () => r() * 2 - 1);
  return (t: number) => {
    const x = t * n, i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
    return knots[i] * (1 - s) + knots[i + 1] * s;
  };
}

export class Pen {
  constructor(public ctx: CanvasRenderingContext2D, public r: R, public k = 1, public ink = GRAPHITE) {}

  // a wobbly polyline through pts, drawn `passes` times
  path(pts: [number, number][], o: { amp?: number; w?: number; a?: number; passes?: number; closed?: boolean } = {}) {
    const { amp = 0.9, w = 1, a = 0.75, passes = 2, closed = false } = o, c = this.ctx, k = this.k;
    const P = closed ? [...pts, pts[0]] : pts;
    let len = 0; const seg: number[] = [];
    for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(d); len += d; }
    if (!len) return;
    for (let p = 0; p < passes; p++) {
      const nz = noise1(this.r, Math.max(2, Math.round(len / 9))), drift = (this.r() - 0.5) * amp * 0.8;
      const over = closed ? 0.04 + this.r() * 0.08 : 0;    // closed shapes overshoot their start
      const steps = Math.max(4, Math.round(len / 1.6));
      c.beginPath();
      for (let s = 0; s <= steps * (1 + over); s++) {
        let d = ((s / steps) % 1) * len, i = 0;
        if (s >= steps && !closed) d = len;
        while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
        const t = seg[i] ? d / seg[i] : 0, [x0, y0] = P[i], [x1, y1] = P[i + 1];
        const nx = -(y1 - y0) / (seg[i] || 1), ny = (x1 - x0) / (seg[i] || 1), m = nz((s / steps) % 1) * amp + drift;
        const x = x0 + (x1 - x0) * t + nx * m, y = y0 + (y1 - y0) * t + ny * m;
        s ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k);
      }
      c.strokeStyle = `rgba(${this.ink},${a * (0.7 + this.r() * 0.3)})`;
      c.lineWidth = (w * (0.8 + this.r() * 0.4)) * Math.max(1, k / 2.2);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.stroke();
    }
  }
  line(x1: number, y1: number, x2: number, y2: number, o = {}) { this.path([[x1, y1], [x2, y2]], o); }
  ellipse(cx: number, cy: number, rx: number, ry: number, o = {}) {
    const n = 18, a0 = this.r() * 6.28;
    this.path(Array.from({ length: n }, (_, i) => [cx + Math.cos(a0 + i / n * 6.283) * rx, cy + Math.sin(a0 + i / n * 6.283) * ry] as [number, number]), { closed: true, ...o });
  }
  // parallel hatching inside a shape, clipped to it
  hatch(shape: (c: CanvasRenderingContext2D) => void, ang: number, gap: number, box: [number, number, number, number], o: { a?: number; w?: number } = {}) {
    const c = this.ctx; c.save(); c.beginPath(); shape(c); c.clip();
    const [x0, y0, x1, y1] = box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let t = -R; t <= R; t += gap * (0.8 + this.r() * 0.4))
      this.line(cx - dy * t - dx * R, cy + dx * t - dy * R, cx - dy * t + dx * R, cy + dx * t + dy * R, { amp: 0.5, passes: 1, a: o.a ?? 0.45, w: o.w ?? 0.8 });
    c.restore();
  }
  dot(x: number, y: number, r = 1) { const c = this.ctx; c.beginPath(); c.arc(x * this.k, y * this.k, r * this.k * 0.9, 0, 6.283); c.fillStyle = `rgba(${this.ink},.85)`; c.fill(); }
  scribble(cx: number, cy: number, rx: number, ry: number, n = 6) {
    const pts: [number, number][] = [];
    for (let i = 0; i < n * 2; i++) pts.push([cx + (this.r() - 0.5) * 2 * rx, cy + (i / (n * 2) - 0.5) * 2 * ry]);
    this.path(pts, { amp: 0.4, passes: 1, a: 0.55, w: 0.8 });
  }
}

// ---------- the cast ----------

export interface Spec {
  kind: 'person' | 'beast' | 'blob' | 'spider' | 'ghost' | 'skeleton';
  head?: 'plain' | 'hood' | 'bald' | 'veil' | 'hair' | 'horns';
  hat?: 'none' | 'cone' | 'cap' | 'brim' | 'crown' | 'shawl';
  body?: 'robe' | 'tunic' | 'round' | 'thin';
  prop?: 'none' | 'staff' | 'taper' | 'lantern' | 'book' | 'keys' | 'sword' | 'bell' | 'flower' | 'sack';
  beard?: boolean; stoop?: number; eyes?: number;
}

const pick = <T,>(r: R, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];

export function randomSpec(seed: number): Spec {
  const r = rng(seed * 7919 + 13);
  const kind = pick(r, ['person', 'person', 'person', 'person', 'person', 'beast', 'blob', 'spider', 'ghost', 'skeleton'] as const);
  return {
    kind, head: pick(r, ['plain', 'hood', 'bald', 'veil', 'hair', 'horns', 'plain'] as const),
    hat: pick(r, ['none', 'none', 'cone', 'cap', 'brim', 'crown', 'shawl'] as const),
    body: pick(r, ['robe', 'tunic', 'round', 'thin'] as const),
    prop: pick(r, ['none', 'staff', 'taper', 'lantern', 'book', 'keys', 'sword', 'bell', 'flower', 'sack'] as const),
    beard: r() < 0.25, stoop: r() < 0.2 ? 3 : 0, eyes: 1 + Math.floor(r() * 3),
  };
}

// draw a character standing in a 64-wide, 96-tall box, feet on y=90. People get the full height; the
// beasts and things are drawn in the lower 64 and shifted down.
export function doodle(ctx: CanvasRenderingContext2D, spec: Spec, seed: number, k: number, accent?: string) {
  const p = new Pen(ctx, rng(seed * 31 + 7), k), r = p.r;
  const acc = accent ? new Pen(ctx, rng(seed + 99), k, accent) : p;
  shadow(p, 33, 90, spec.kind === 'beast' ? 20 : 14);
  if (spec.kind === 'person' || spec.kind === 'skeleton') {
    // nobody stands quite straight: lean the figure a little about its feet
    const lean = (r() - 0.5) * 0.12; ctx.save(); ctx.translate(32 * k, 90 * k); ctx.transform(1, 0, lean, 1, 0, 0); ctx.translate(-32 * k, -90 * k);
    person(p, acc, spec, r); ctx.restore(); return;
  }
  ctx.save(); ctx.translate(0, 30 * k);
  if (spec.kind === 'beast') beast(p, acc, r);
  if (spec.kind === 'blob') blob(p, acc, r, spec.eyes ?? 2);
  if (spec.kind === 'spider') spider(p, r);
  if (spec.kind === 'ghost') ghost(p, acc, r);
  ctx.restore();
}

function shadow(p: Pen, cx: number, cy: number, rx: number) {
  p.hatch((c) => c.ellipse((cx + 4) * p.k, cy * p.k, rx * p.k, 3.2 * p.k, 0, 0, 6.3), 1.15, 1.7, [cx - rx, cy - 4, cx + rx + 8, cy + 4], { a: 0.32, w: 0.7 });
}

// a shape drawn the way a hand does it: one loose construction line, then two firmer ones
function sketch(p: Pen, pts: [number, number][], o: { closed?: boolean; w?: number } = {}) {
  p.path(pts, { ...o, amp: 2.2, a: 0.18, passes: 1, w: 0.7 });
  p.path(pts, { ...o, amp: 0.8, a: 0.92, passes: 2, w: (o.w ?? 1.1) * 1.15 });
}

function person(p: Pen, acc: Pen, s: Spec, r: R) {
  const tall = 0.88 + r() * 0.3, st = s.stoop ?? 0, fy = 90;
  const hr = 6.8 + r() * 2.2, hx = 32 + st * 1.6, hy = fy - 64 * tall + st * 2.5;
  const sy = hy + hr + 3, wy = sy + (fy - sy) * 0.4;
  const sw = s.body === 'round' ? 12 : s.body === 'thin' ? 6.5 : 9.5, fw = s.body === 'robe' ? 15 + r() * 3 : 10;
  const shade = (shape: (c: CanvasRenderingContext2D) => void, box: [number, number, number, number]) => {
    acc.hatch(shape, 1.05, 2.1, box, { a: 0.62 });
    p.hatch(shape, -0.45, 2.9, box, { a: 0.45 });
  };

  // ---- body ----
  if (s.body === 'round') {
    const cy = wy + 6, ry = (fy - 8 - sy) / 2 + 2;
    sketch(p, ellipsePts(32, cy, 14, ry), { closed: true });
    shade((c) => { c.ellipse(32 * p.k, cy * p.k, 14 * p.k, ry * p.k, 0, -1.2, 1.6); }, [30, cy - ry, 48, cy + ry]);
    p.path([[22, cy - 2], [32, cy + 1], [42, cy - 3]], { passes: 1, a: 0.5 });   // a belt over the belly
    legs(p, cy + ry - 2, fy, 5, r);
  } else if (s.body === 'robe') {
    const L: [number, number][] = [[32 - sw + st, sy], [32 - sw - 2 + st, wy], [32 - fw, fy - 1]], R_: [number, number][] = [[32 + fw, fy - 1], [32 + sw + 2 + st, wy], [32 + sw + st, sy]];
    const hem: [number, number][] = Array.from({ length: 7 }, (_, i) => [32 - fw + i * fw / 3, fy - 1 + (i % 2 ? 1.5 : -0.5) + (r() - 0.5)]);
    sketch(p, [...L, ...hem.slice(1, -1), ...R_]);
    p.path(hem, { passes: 1, a: 0.7 });
    for (let i = 0; i < 3; i++) { const x = 32 - fw / 2 + i * fw / 2 + (r() - 0.5) * 3; p.path([[32 + st + (x - 32) * 0.3, wy + 2], [x - 1, (wy + fy) / 2], [x + (r() - 0.5) * 3, fy - 3]], { passes: 1, a: 0.42, amp: 0.6 }); }
    shade((c) => { c.moveTo((32 + st + 2) * p.k, sy * p.k); c.lineTo((32 + sw + st + 3) * p.k, wy * p.k); c.lineTo((32 + fw + 1) * p.k, fy * p.k); c.lineTo((32 + fw * 0.2) * p.k, fy * p.k); c.closePath(); }, [30, sy, 32 + fw + 2, fy]);
    p.path([[32 - sw - 1 + st, wy], [32 + st, wy + 1.5], [32 + sw + 2 + st, wy - 0.5]], { w: 1.2, a: 0.8 });    // the cord
    p.path([[32 + st + 1, wy + 1], [33 + st, wy + 9], [31 + st, wy + 13]], { passes: 1, a: 0.7 });
  } else {
    const hip = wy + 8, lw = s.body === 'thin' ? 3 : 4.2;
    sketch(p, [[32 - sw + st, sy], [32 - sw - 1, hip], [32 + sw + 1, hip], [32 + sw + st, sy]]);
    for (let y = sy + 5; y < hip - 2; y += 5) p.dot(32 + st * 0.5, y, 0.7);                                     // buttons
    p.line(32 - sw - 1, hip - 3, 32 + sw + 1, hip - 3, { passes: 1, a: 0.7 });
    shade((c) => c.rect((32 + 1) * p.k, sy * p.k, (sw + 2) * p.k, (hip - sy) * p.k), [32, sy, 32 + sw + 2, hip]);
    legs(p, hip, fy, lw, r);
  }
  if (s.kind === 'skeleton') for (let y = sy + 4; y < wy; y += 3.5) p.path([[27, y], [32, y + 1], [37, y]], { passes: 1, a: 0.65 });

  // ---- arms: sleeves with thickness, a hand at the end ----
  const lh: [number, number] = [32 - sw - 6 + st, wy + 4], rh: [number, number] = [32 + sw + 7 + st, wy + 2];
  sleeve(p, [32 - sw + st, sy + 1], [32 - sw - 5 + st, (sy + wy) / 2 + 2], lh);
  sleeve(p, [32 + sw + st, sy + 1], [32 + sw + 6 + st, (sy + wy) / 2], rh);
  prop(p, acc, s.prop ?? 'none', rh, r);
  for (const [x, y] of [lh, rh]) { p.scribble(x, y + 1.8, 1.8, 1.8, 3); p.path([[x - 1.8, y], [x - 2, y + 3], [x, y + 4], [x + 2, y + 2.5], [x + 1.5, y]], { passes: 1, w: 0.9, a: 0.85 }); }

  // ---- head ----
  if (s.head === 'hood' || s.hat === 'shawl') {
    const hood: [number, number][] = [[hx - hr - 4, sy + 4], [hx - hr - 3, hy - 3], [hx - 2, hy - hr - 6], [hx + hr + 2, hy - 3], [hx + hr + 4, sy + 4]];
    sketch(p, hood, { w: 1.2 });
    acc.hatch((c) => { c.arc(hx * p.k, (hy - 1) * p.k, (hr + 3.5) * p.k, 3.1, 6.3); c.arc(hx * p.k, hy * p.k, hr * p.k, 6.3, 3.1, true); }, 1.0, 1.8, [hx - hr - 5, hy - hr - 6, hx + hr + 5, sy + 4], { a: 0.55 });
    p.hatch((c) => { c.arc(hx * p.k, (hy - 1) * p.k, (hr + 3.5) * p.k, 4.6, 6.3); c.arc(hx * p.k, hy * p.k, hr * p.k, 6.3, 4.6, true); }, -0.5, 2, [hx, hy - hr - 6, hx + hr + 5, hy + 2], { a: 0.5 });
  }
  sketch(p, ellipsePts(hx, hy, hr, hr * 1.12), { closed: true });
  if (s.kind === 'skeleton') {
    p.ellipse(hx - 2.8, hy - 0.5, 2, 2.4, { w: 1.1 }); p.ellipse(hx + 2.8, hy - 0.5, 2, 2.4, { w: 1.1 });
    p.hatch((c) => { c.arc((hx - 2.8) * p.k, (hy - 0.5) * p.k, 2 * p.k, 0, 6.3); c.moveTo((hx + 4.8) * p.k, hy * p.k); c.arc((hx + 2.8) * p.k, (hy - 0.5) * p.k, 2 * p.k, 0, 6.3); }, 0.8, 0.9, [hx - 5, hy - 3, hx + 5, hy + 2], { a: 0.8 });
    for (let x = -3; x <= 3; x += 1.5) p.line(hx + x, hy + 4, hx + x, hy + 6, { passes: 1, a: 0.7 });
  } else if (s.head === 'veil') {
    p.hatch((c) => c.ellipse(hx * p.k, hy * p.k, hr * p.k, hr * 1.12 * p.k, 0, 0, 6.3), -0.4, 1.4, [hx - hr, hy - hr * 1.2, hx + hr, hy + hr * 1.2], { a: 0.55 });
    p.hatch((c) => c.ellipse(hx * p.k, hy * p.k, hr * p.k, hr * 1.12 * p.k, 0, 0, 6.3), 0.9, 2.2, [hx - hr, hy - hr * 1.2, hx + hr, hy + hr * 1.2], { a: 0.35 });
    p.dot(hx - 2.6, hy - 1, 0.7); p.dot(hx + 2.6, hy - 1, 0.7);
  } else face(p, hx, hy, hr, r, st > 0);
  // shade the far side of the face
  p.hatch((c) => c.ellipse(hx * p.k, hy * p.k, hr * p.k, hr * 1.12 * p.k, 0, -1.3, 1.3), 1.1, 1.9, [hx + hr * 0.3, hy - hr * 1.2, hx + hr, hy + hr * 1.2], { a: 0.35 });
  if (s.head === 'hair') { for (let i = 0; i < 7; i++) p.path([[hx - hr + i * 2.2, hy - hr * 0.6], [hx - hr + 1 + i * 2.2 + r(), hy - hr * 1.15], [hx - hr + 3 + i * 2, hy - hr * 0.9]], { passes: 1, a: 0.7 }); p.path([[hx + hr - 1, hy - 2], [hx + hr + 4, hy + 2], [hx + hr + 3, hy + 9]], { a: 0.7 }); }
  if (s.head === 'horns') { sketch(p, [[hx - 4, hy - hr + 1], [hx - 9, hy - hr - 4], [hx - 8, hy - hr - 10]]); sketch(p, [[hx + 4, hy - hr + 1], [hx + 9, hy - hr - 4], [hx + 8, hy - hr - 10]]); }
  if (s.head === 'bald') p.path([[hx - 3, hy - hr + 2], [hx, hy - hr + 1.4], [hx + 2, hy - hr + 2]], { passes: 1, a: 0.4 });
  if (s.beard) { const b: [number, number][] = [[hx - hr + 1, hy + 2], [hx - 4, hy + hr + 5], [hx, hy + hr + 8], [hx + 4, hy + hr + 5], [hx + hr - 1, hy + 2]]; sketch(p, b); acc.hatch((c) => { c.moveTo(b[0][0] * p.k, b[0][1] * p.k); b.forEach(([x, y]) => c.lineTo(x * p.k, y * p.k)); }, 1.4, 1.3, [hx - hr, hy, hx + hr, hy + hr + 9], { a: 0.5 }); }

  // ---- hat ----
  const top = hy - hr * 1.1;
  if (s.hat === 'cone') { sketch(p, [[hx - hr - 4, top + 3], [hx + 3, top - 20], [hx + 5, top - 22], [hx + hr + 4, top + 3]]); p.path([[hx - hr - 7, top + 3], [hx, top + 5], [hx + hr + 7, top + 2]], { w: 1.2 }); acc.hatch((c) => { c.moveTo((hx + 3) * p.k, (top - 20) * p.k); c.lineTo((hx + hr + 4) * p.k, (top + 3) * p.k); c.lineTo(hx * p.k, (top + 3) * p.k); c.closePath(); }, 1.1, 2, [hx - 2, top - 22, hx + hr + 5, top + 4], { a: 0.5 }); }
  if (s.hat === 'cap') { sketch(p, [[hx - hr - 1, top + 3], [hx - hr, top - 3], [hx + hr, top - 4], [hx + hr + 7, top + 1], [hx + hr, top + 3]]); acc.hatch((c) => c.rect((hx - hr) * p.k, (top - 4) * p.k, hr * 2 * p.k, 7 * p.k), 0.4, 1.6, [hx - hr, top - 4, hx + hr + 7, top + 3], { a: 0.55 }); }
  if (s.hat === 'brim') { p.path([[hx - hr - 8, top + 2], [hx, top + 4], [hx + hr + 8, top + 1]], { w: 1.3 }); sketch(p, [[hx - hr + 1, top + 2], [hx - hr + 2, top - 8], [hx + hr - 2, top - 9], [hx + hr - 1, top + 2]]); acc.hatch((c) => c.rect((hx - hr + 1) * p.k, (top - 9) * p.k, (hr * 2 - 2) * p.k, 11 * p.k), 1.2, 1.5, [hx - hr, top - 9, hx + hr, top + 2], { a: 0.6 }); }
  if (s.hat === 'crown') { sketch(p, [[hx - 6, top + 1], [hx - 6, top - 6], [hx - 3, top - 2], [hx, top - 8], [hx + 3, top - 2], [hx + 6, top - 6], [hx + 6, top + 1]]); p.dot(hx, top - 8.5, 0.9); }
}

const ellipsePts = (cx: number, cy: number, rx: number, ry: number): [number, number][] =>
  Array.from({ length: 20 }, (_, i) => [cx + Math.cos(i / 20 * 6.283 - 1.2) * rx, cy + Math.sin(i / 20 * 6.283 - 1.2) * ry]);

function face(p: Pen, hx: number, hy: number, hr: number, r: R, old: boolean) {
  const ey = hy - 0.8, sp = hr * 0.38;
  for (const sx of [-1, 1]) {
    p.ellipse(hx + sx * sp, ey, 1.3, 0.9, { passes: 1, w: 0.8, a: 0.8 }); p.dot(hx + sx * sp + 0.3, ey + 0.2, 0.55);
    p.line(hx + sx * (sp - 1.5), ey - 2.5 + (r() - 0.5), hx + sx * (sp + 1.8), ey - 2.8 - r() * 0.8, { passes: 1, a: 0.75 });   // brow
  }
  p.path([[hx + 0.3, ey + 0.5], [hx + 1.6, ey + 3.4], [hx, ey + 4]], { passes: 1, a: 0.7 });                                      // nose
  const m = r(); p.path([[hx - 2, hy + hr * 0.5], [hx, hy + hr * 0.5 + (m - 0.5) * 1.2], [hx + 2.2, hy + hr * 0.5 - (m - 0.3)]], { passes: 1, a: 0.7 });
  if (old) for (const sx of [-1, 1]) p.path([[hx + sx * (sp + 2), ey + 1], [hx + sx * (sp + 3), ey + 2.5]], { passes: 1, a: 0.5 });
}

function sleeve(p: Pen, a: [number, number], m: [number, number], h: [number, number]) {
  p.path([a, m, h], { w: 1.1 });
  p.path([[a[0] + 2, a[1] + 3], [m[0] + 2.5, m[1] + 1], [h[0] + 2, h[1] - 1]], { passes: 1, a: 0.55 });
}

function legs(p: Pen, y0: number, fy: number, w: number, r: R) {
  for (const sx of [-1, 1]) {
    const x = 32 + sx * 4.5;
    p.path([[x - w / 2, y0], [x - w / 2 + (r() - 0.5), fy - 4]], { w: 1 }); p.path([[x + w / 2, y0], [x + w / 2 + (r() - 0.5), fy - 4]], { w: 1 });
    sketch(p, [[x - w / 2 - 1, fy - 4], [x - w / 2 - 1, fy], [x + w / 2 + sx * 3 + 2, fy], [x + w / 2 + 1, fy - 4]]);
    p.hatch((c) => c.rect((x - w / 2 - 1) * p.k, (fy - 4) * p.k, (w + 5) * p.k, 4 * p.k), 0.9, 1.1, [x - w, fy - 5, x + w + 4, fy + 1], { a: 0.7 });
  }
}

function prop(p: Pen, acc: Pen, kind: string, [x, y]: [number, number], r: R) {
  if (kind === 'staff') { sketch(p, [[x, y - 30], [x + 1, 90]], { w: 1.2 }); p.ellipse(x, y - 33, 3, 3); p.path([[x - 3, y - 30], [x, y - 36], [x + 3, y - 30]], { passes: 1, a: 0.6 }); }
  if (kind === 'taper') { p.line(x - 1, y + 2, x + 4, y - 26, { w: 1 }); acc.path([[x + 4, y - 27], [x + 3, y - 31], [x + 5, y - 34], [x + 6, y - 30], [x + 4, y - 27]], { a: 0.9 }); }
  if (kind === 'lantern') { p.line(x, y, x, y + 3, { passes: 1 }); p.path([[x - 3, y + 3], [x - 3, y + 10], [x + 3, y + 10], [x + 3, y + 3]], { closed: true }); acc.dot(x, y + 6.5, 1.3); }
  if (kind === 'book') { p.path([[x - 4, y - 1], [x + 4, y - 3], [x + 5, y + 6], [x - 3, y + 8]], { closed: true }); p.line(x - 2, y + 1, x + 3, y, { passes: 1, a: 0.4 }); }
  if (kind === 'keys') { p.ellipse(x, y + 3, 3, 3); for (let i = 0; i < 3; i++) p.line(x - 2 + i * 2, y + 6, x - 3 + i * 2.5, y + 11, { passes: 1 }); }
  if (kind === 'sword') { p.line(x, y + 2, x + 3, y - 20, { w: 1.2 }); p.line(x - 3, y - 1, x + 4, y, { passes: 1 }); }
  if (kind === 'bell') { p.path([[x - 3, y + 9], [x - 2, y + 2], [x, y], [x + 2, y + 2], [x + 3, y + 9]]); p.line(x - 4, y + 9, x + 4, y + 9, { passes: 1 }); p.dot(x, y + 10.5, 0.9); }
  if (kind === 'flower') { p.line(x, y + 2, x + 1, y - 12, { passes: 1 }); acc.ellipse(x + 1, y - 14, 2.5, 2.2, { passes: 1 }); }
  if (kind === 'sack') { p.path([[x - 2, y - 4], [x - 6, y + 4], [x - 4, y + 12], [x + 6, y + 12], [x + 7, y + 3], [x + 2, y - 4]], { closed: true }); p.scribble(x, y - 4, 2, 1, 3); }
  void r;
}

function beast(p: Pen, acc: Pen, r: R) {
  const big = r() < 0.5, bw = big ? 15 : 11, by = 44;
  p.ellipse(30, by, bw, 7 + r() * 2, { w: 1.1 });
  acc.hatch((c) => c.ellipse(30 * p.k, by * p.k, bw * p.k, 8 * p.k, 0, 0, 6.3), 0.8, 3, [15, 36, 45, 52]);
  for (const x of [20, 25, 36, 41]) p.line(x, by + 5, x + (r() - 0.5) * 3, 60, { w: 1 });
  const hx = 30 + bw + 2, hy = by - 8; p.ellipse(hx, hy, 5.5, 5, { w: 1.1 }); p.dot(hx + 1.5, hy - 1, 0.9);
  if (r() < 0.5) { p.line(hx - 2, hy - 4, hx - 4, hy - 10); p.line(hx + 1, hy - 5, hx + 2, hy - 11); }
  else p.path([[hx - 3, hy - 4], [hx - 2, hy - 9], [hx, hy - 5]]);
  p.path([[30 - bw, by - 2], [30 - bw - 5, by - 8], [30 - bw - 6, by - 14]], { a: 0.6 });
}

function blob(p: Pen, acc: Pen, r: R, eyes: number) {
  const pts: [number, number][] = Array.from({ length: 16 }, (_, i) => {
    const a = i / 16 * 6.283, rr = 15 + (r() - 0.5) * 6 + (Math.sin(a) > 0.6 ? 4 : 0);
    return [32 + Math.cos(a) * rr, 44 + Math.sin(a) * rr * 0.85];
  });
  p.path(pts, { closed: true, w: 1.2 });
  acc.hatch((c) => c.ellipse(32 * p.k, 44 * p.k, 15 * p.k, 13 * p.k, 0, 0.3, 2.8), -0.6, 2.6, [16, 40, 48, 58]);
  for (let i = 0; i < eyes; i++) { const x = 32 + (i - (eyes - 1) / 2) * 7, y = 39 + (r() - 0.5) * 4; p.ellipse(x, y, 2.6, 2.6, { passes: 1 }); p.dot(x + 0.5, y + 0.5, 0.9); }
}

function spider(p: Pen, r: R) {
  p.ellipse(32, 46, 7, 5.5, { w: 1.2 }); p.ellipse(32, 38, 4.5, 4, { w: 1.1 });
  p.hatch((c) => c.ellipse(32 * p.k, 46 * p.k, 7 * p.k, 5.5 * p.k, 0, 0, 6.3), 0.7, 1.8, [25, 40, 39, 52], { a: 0.6 });
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const y = 42 + i * 3; p.path([[32 + s * 5, y], [32 + s * (12 + i), y - 6 + i * 2], [32 + s * (17 + r() * 3), y + 8 + i * 2]], { passes: 1, w: 0.9 });
  }
  p.dot(30.5, 37.5, 0.8); p.dot(33.5, 37.5, 0.8);
}

function ghost(p: Pen, acc: Pen, r: R) {
  const pts: [number, number][] = [[18, 58], [18, 30], [22, 18], [32, 13], [42, 18], [46, 30], [46, 58]];
  const hem: [number, number][] = Array.from({ length: 7 }, (_, i) => [46 - i * 4.6, 58 + (i % 2 ? -4 : 1) + (r() - 0.5) * 2]);
  p.path([...pts, ...hem], { closed: true, w: 1.1 });
  acc.hatch((c) => c.rect(36 * p.k, 20 * p.k, 12 * p.k, 40 * p.k), 1.1, 3.2, [36, 20, 48, 60], { a: 0.3 });
  p.ellipse(27, 30, 2.6, 3.6, { passes: 1 }); p.ellipse(37, 30, 2.6, 3.6, { passes: 1 });
  p.path([[29, 40], [32, 42], [35, 40]], { passes: 1, a: 0.5 });
}

// ---------- the place ----------

export function paper(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d')!, img = x.createImageData(w, h), r = rng(3);
  for (let i = 0; i < w * h; i++) {
    const v = 238 + (r() - 0.5) * 10 - (r() < 0.004 ? 22 : 0);
    img.data.set([v, v - 5, v - 16, 255], i * 4);
  }
  x.putImageData(img, 0, 0);
  return c;
}
