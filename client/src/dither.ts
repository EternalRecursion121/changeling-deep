// One-ink Atkinson dithering, the house style: every picture in the Deep is a field of single pixels in
// one region's ink on black. `atkinson` turns a 0..1 intensity grid into on/off pixels; `paint` writes them.

export function atkinson(a: Float32Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const b = Float32Array.from(a);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, o = b[i], n = o >= 0.5 ? 1 : 0, e = (o - n) / 8;
      out[i] = n;
      if (x + 1 < w) b[i + 1] += e;
      if (x + 2 < w) b[i + 2] += e;
      if (y + 1 < h) { if (x > 0) b[i + w - 1] += e; b[i + w] += e; if (x + 1 < w) b[i + w + 1] += e; }
      if (y + 2 < h) b[i + 2 * w] += e;
    }
  }
  return out;
}

export function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((j) => parseInt(hex.slice(j, j + 2), 16)) as [number, number, number];
}

export function paint(ctx: CanvasRenderingContext2D, on: Uint8Array, w: number, h: number, hex: string) {
  const img = ctx.createImageData(w, h), [r, g, b] = rgb(hex);
  for (let i = 0; i < on.length; i++) if (on[i]) {
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// a small seeded noise, so placeholder art draws the same every time
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function valueNoise(w: number, h: number, cell: number, seed: number): Float32Array {
  const r = rng(seed), gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  const g = Float32Array.from({ length: gw * gh }, r), out = new Float32Array(w * h);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = s(gx - x0), fy = s(gy - y0);
    const v = (i: number, j: number) => g[(y0 + j) * gw + x0 + i];
    out[y * w + x] = (v(0, 0) * (1 - fx) + v(1, 0) * fx) * (1 - fy) + (v(0, 1) * (1 - fx) + v(1, 1) * fx) * fy;
  }
  return out;
}

// Placeholder portrait until painted portraits exist: a hooded figure in a pool of light, from
// shapes and noise, dithered. Each creature passes its own seed so they differ a little.
export function placeholderPortrait(canvas: HTMLCanvasElement, hex: string, seed: number) {
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d')!;
  const n = valueNoise(w, h, 9, seed), n2 = valueNoise(w, h, 3, seed + 7), r = rng(seed);
  const a = new Float32Array(w * h);
  const hx = w * (0.47 + r() * 0.06), hy = h * (0.36 + r() * 0.04), hr = w * (0.15 + r() * 0.03);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, u = x / w, v = y / h;
    let L = 0.5 * Math.exp(-((u - 0.5) ** 2 + (v - 0.42) ** 2) / 0.09);          // the light behind
    const dh = Math.hypot((x - hx) / hr, (y - hy) / (hr * 1.25));                  // the hood
    const sh = Math.abs(u - 0.5) < 0.12 + Math.max(0, v - 0.48) * 0.95 && v > 0.48; // the shoulders
    if (dh < 1 || sh) L = 0.06 + 0.1 * n2[i] + (dh < 1 ? 0.45 * Math.max(0, 1 - dh) ** 3 * (u < hx / w ? 1 : 0.3) : 0);
    if (dh < 1.08 && dh >= 1) L += 0.35;                                           // rim light on the hood
    a[i] = Math.min(1, Math.max(0, L + 0.18 * (n[i] - 0.5)) ** 1.25 * Math.min(1, (1 - v) * 3));   // clamp before the power: a negative base gives NaN
  }
  paint(ctx, atkinson(a, w, h), w, h, hex);
}
