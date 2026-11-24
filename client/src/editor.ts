// The Deep Designer: paint a map, place gates and characters, and play it.
//
// Left: tools and palette. Middle: the map (drag to paint, shift-drag for a rectangle, space-drag or
// right-drag to pan, wheel to zoom). Right: whatever is selected, the map's own settings, and problems.
// The draft saves itself in this browser; Export writes the JSON that goes in src/maps/.

import deep from './maps/deep.json';
import { Style, pencilStyle, pixelStyle } from './art';
import { KINDS, MapData, REGION_KEY, SPRITES, build, kind } from './dungeon';
import { ROOMS } from './mock';
import { REGIONS, region } from './world';

type Tool = 'tile' | 'region' | 'gate' | 'npc' | 'start' | 'select' | 'erase';
const KEY = 'cd-map-draft';
const TOOLS: [Tool, string, string][] = [
  ['tile', 'Paint tiles', 'B'], ['region', 'Paint regions', 'R'], ['select', 'Select and move', 'V'],
  ['npc', 'Place a character', 'N'], ['gate', 'Place a sealed gate', 'G'], ['start', 'Set the start', 'S'], ['erase', 'Remove a thing', 'E'],
];
const LETTER = Object.fromEntries(Object.entries(REGION_KEY).map(([k, v]) => [v, k]));
const esc = (t: string) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const clone = (m: MapData): MapData => JSON.parse(JSON.stringify(m));

const root = document.getElementById('ed')!;
const sheet = new Image(); sheet.src = '/tiles/1bit.png';
Promise.all([sheet.decode(), document.fonts.load('30px Chapbook')]).finally(start);

function start() {
  let map: MapData = loadDraft() ?? clone(deep as MapData);
  const styles: Record<string, Style> = { pixel: pixelStyle(sheet), pencil: pencilStyle() };
  let view: 'pixel' | 'pencil' = 'pixel', tool: Tool = 'tile', brush = '.', regionBrush = 'a', npcSprite = SPRITES[0];
  let showRegions = true, showGrid = true;
  let sel: { type: 'npc'; i: number } | { type: 'gate'; i: number } | null = null;
  const undo: string[] = [], redo: string[] = [];

  root.innerHTML = `
    <div class="ed">
      <header class="ed-bar">
        <a class="ed-title" href="/">Changeling Deep</a><span class="ed-sub">Designer</span>
        <input id="ed-name" class="ed-name" aria-label="Map name" />
        <span class="ed-group"><button id="undo" title="Undo (Ctrl Z)">Undo</button><button id="redo" title="Redo (Ctrl Shift Z)">Redo</button></span>
        <span class="ed-group" id="views"><button data-v="pixel">Pixel</button><button data-v="pencil">Pencil</button></span>
        <span class="ed-group"><label><input type="checkbox" id="o-reg" checked /> Regions</label><label><input type="checkbox" id="o-grid" checked /> Grid</label></span>
        <span class="ed-group right"><button id="import">Import</button><button id="export">Export JSON</button><button id="revert" title="Throw away the draft and load the built-in map">Revert</button>
          <button id="play" class="ed-play">Play this map</button></span>
        <input type="file" id="file" accept=".json,application/json" hidden />
      </header>
      <aside class="ed-left">
        <h3>Tools</h3><div class="ed-tools" id="tools"></div>
        <h3>Tiles</h3><div class="ed-swatches" id="tiles"></div>
        <h3>Regions</h3><div class="ed-regions" id="regions"></div>
        <p class="ed-help">Drag to paint · Shift-drag for a rectangle · Space or right-drag to pan · Wheel to zoom · Alt-click to pick a tile</p>
      </aside>
      <main class="ed-main"><canvas id="cv"></canvas><div class="ed-coord" id="coord"></div></main>
      <aside class="ed-right"><div id="inspect"></div><div id="mapset"></div><div id="problems"></div></aside>
    </div>`;
  const $ = <T extends HTMLElement>(q: string) => root.querySelector<T>(q)!;
  const cv = $<HTMLCanvasElement>('#cv'), ctx = cv.getContext('2d')!;

  // ---------- state changes ----------
  let built = build(map), layer = styles.pixel.layer(built.g), pencilLayer: HTMLCanvasElement | null = null, pencilT = 0;
  function commit(before: string) {
    if (before !== JSON.stringify(map)) { undo.push(before); if (undo.length > 200) undo.shift(); redo.length = 0; }
    refresh();
  }
  function refresh() {
    built = build(map); layer = styles.pixel.layer(built.g);
    pencilLayer = null; clearTimeout(pencilT);
    if (view === 'pencil') pencilT = window.setTimeout(() => { pencilLayer = styles.pencil.layer(build(map).g); draw(); }, 350);
    try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* */ }
    $<HTMLInputElement>('#ed-name').value = map.name;
    panels(); draw();
  }
  function step(from: string[], to: string[]) { const s = from.pop(); if (!s) return; to.push(JSON.stringify(map)); map = JSON.parse(s); sel = null; refresh(); }

  // ---------- the left panel ----------
  function tilesPanel() {
    $('#tools').innerHTML = TOOLS.map(([t, name, k]) => `<button class="${t === tool ? 'on' : ''}" data-t="${t}" title="${name} (${k})"><b>${k}</b>${name}</button>`).join('');
    $('#tools').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.onclick = () => setTool(b.dataset.t as Tool));
    $('#tiles').innerHTML = KINDS.map((k) => `<button class="${tool === 'tile' && brush === k.ch ? 'on' : ''}" data-c="${esc(k.ch)}" title="${esc(k.name)}"><canvas width="32" height="32" data-k="${esc(k.ch)}"></canvas><span>${esc(k.name)}</span></button>`).join('');
    $('#tiles').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.onclick = () => { brush = b.dataset.c!; setTool('tile'); });
    $('#tiles').querySelectorAll<HTMLCanvasElement>('canvas').forEach((c) => swatch(c, c.dataset.k!));
    $('#regions').innerHTML = [['.', 'None', '#3a3640'], ...REGIONS.map((r) => [LETTER[r.id], r.name.replace(/^The /, ''), r.hue])]
      .filter(([k]) => k).map(([k, name, hue]) => `<button class="${tool === 'region' && regionBrush === k ? 'on' : ''}" data-r="${k}"><i style="background:${hue}"></i>${esc(name)}</button>`).join('');
    $('#regions').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.onclick = () => { regionBrush = b.dataset.r!; setTool('region'); });
  }
  function swatch(c: HTMLCanvasElement, ch: string) {
    const x = c.getContext('2d')!, k = kind(ch);
    x.fillStyle = ch === '#' ? '#2a2730' : '#0d0b10'; x.fillRect(0, 0, 32, 32);
    const d = k.deco?.(0) ?? (ch === '.' ? 5 : undefined);
    if (d !== undefined) { x.imageSmoothingEnabled = false; x.drawImage(styles.pixel.tile(d, '#ECE8F1'), 0, 0, 32, 32); }
  }
  function setTool(t: Tool) { tool = t; tilesPanel(); draw(); cv.style.cursor = t === 'select' ? 'default' : 'crosshair'; }

  // ---------- the right panel ----------
  function panels() {
    const ins = $('#inspect');
    if (sel?.type === 'npc' && map.npcs[sel.i]) {
      const n = map.npcs[sel.i];
      ins.innerHTML = `<h3>Character</h3>
        <label>Id <input data-f="id" value="${esc(n.id)}" /></label>
        <label>Name <input data-f="name" value="${esc(n.name)}" /></label>
        <label>When you talk to it <input data-f="idle" value="${esc(n.idle ?? '')}" placeholder="stands very still" /></label>
        <label>Room (a playable conversation) <select data-f="room"><option value="">none</option>${Object.keys(ROOMS).map((r) => `<option ${n.room === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label>Ink <select data-f="hue"><option value="">from its region</option>${REGIONS.map((r, i) => `<option value="${i}" ${n.hue === i ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
        <label class="row"><input type="checkbox" data-f="wander" ${n.wander ? 'checked' : ''} /> Wanders (in the Menagerie)</label>
        <p class="ed-k">At ${n.x}, ${n.y}</p>
        <h3>Sprite (pixel style)</h3><div class="ed-sprites">${SPRITES.map((s) => `<canvas width="32" height="32" data-s="${s}" class="${s === n.sprite ? 'on' : ''}"></canvas>`).join('')}</div>
        <button class="ed-danger" id="del">Remove character</button>`;
      ins.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-f]').forEach((el) => el.onchange = () => {
        const before = JSON.stringify(map), f = el.dataset.f!, v = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
        const t = n as unknown as Record<string, unknown>;
        if (f === 'hue') { if (v === '') delete n.hue; else n.hue = Number(v); }
        else if (v === '' || v === false) delete t[f]; else t[f] = v;
        commit(before);
      });
      spritePicker(ins, (s) => { const before = JSON.stringify(map); n.sprite = s; commit(before); });
    } else if (sel?.type === 'gate' && map.gates[sel.i]) {
      const q = map.gates[sel.i];
      ins.innerHTML = `<h3>Sealed gate</h3>
        <label>Opens when this region opens <select data-f="region">${[...REGIONS.map((r) => r.id), 'deeper'].map((r) => `<option ${q.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label>What it says while sealed <textarea data-f="says" rows="4">${esc(q.says)}</textarea></label>
        <p class="ed-k">At ${q.x}, ${q.y}. A gate called "deeper" never opens.</p>
        <button class="ed-danger" id="del">Remove gate</button>`;
      ins.querySelectorAll<HTMLInputElement>('[data-f]').forEach((el) => el.onchange = () => { const before = JSON.stringify(map); (q as unknown as Record<string, string>)[el.dataset.f!] = el.value; commit(before); });
    } else if (tool === 'npc') {
      ins.innerHTML = `<h3>New character</h3><p class="ed-k">Pick a sprite, then click the map.</p><div class="ed-sprites">${SPRITES.map((s) => `<canvas width="32" height="32" data-s="${s}" class="${s === npcSprite ? 'on' : ''}"></canvas>`).join('')}</div>`;
      spritePicker(ins, (s) => { npcSprite = s; panels(); });
    } else ins.innerHTML = `<h3>Nothing selected</h3><p class="ed-k">Use Select (V) and click a character or a gate to edit it.</p>`;
    ins.querySelector<HTMLButtonElement>('#del')?.addEventListener('click', () => {
      const before = JSON.stringify(map);
      if (sel?.type === 'npc') map.npcs.splice(sel.i, 1); else if (sel?.type === 'gate') map.gates.splice(sel.i, 1);
      sel = null; commit(before);
    });

    $('#mapset').innerHTML = `<h3>Map</h3>
      <div class="ed-size"><label>Width <input type="number" id="mw" min="8" max="200" value="${map.w}" /></label><label>Height <input type="number" id="mh" min="8" max="200" value="${map.h}" /></label><button id="resize">Resize</button></div>
      <p class="ed-k">Start at ${map.start.x}, ${map.start.y} · ${map.npcs.length} characters · ${map.gates.length} gates</p>`;
    $('#resize').onclick = () => resize(+$<HTMLInputElement>('#mw').value, +$<HTMLInputElement>('#mh').value);

    const probs = problems();
    $('#problems').innerHTML = `<h3>Problems</h3>${probs.length ? `<ul>${probs.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '<p class="ed-k">None found.</p>'}`;
  }
  function spritePicker(el: HTMLElement, pickIt: (s: number) => void) {
    el.querySelectorAll<HTMLCanvasElement>('.ed-sprites canvas').forEach((c) => {
      const x = c.getContext('2d')!; x.fillStyle = '#0d0b10'; x.fillRect(0, 0, 32, 32); x.imageSmoothingEnabled = false;
      x.drawImage(styles.pixel.tile(+c.dataset.s!, '#ECE8F1'), 0, 0, 32, 32);
      c.onclick = () => pickIt(+c.dataset.s!);
    });
  }
  function problems() {
    const out: string[] = [], solid = (x: number, y: number) => built.g[y]?.[x]?.solid ?? true;
    if (solid(map.start.x, map.start.y)) out.push('The start is on a tile you cannot stand on.');
    const ids = new Set<string>();
    map.npcs.forEach((n) => {
      if (ids.has(n.id)) out.push(`Two characters share the id "${n.id}".`); ids.add(n.id);
      if (solid(n.x, n.y)) out.push(`${n.name} is standing in a wall (${n.x}, ${n.y}).`);
      if (n.room && !ROOMS[n.room]) out.push(`${n.name} leads to a room "${n.room}" that does not exist.`);
    });
    map.gates.forEach((q) => { if (built.g[q.y]?.[q.x]?.t !== '.' && built.g[q.y]?.[q.x]?.t !== '+') out.push(`A gate at ${q.x}, ${q.y} is not on floor.`); });
    return out;
  }
  function resize(w: number, h: number) {
    w = Math.max(8, Math.min(200, Math.round(w || map.w))); h = Math.max(8, Math.min(200, Math.round(h || map.h)));
    const before = JSON.stringify(map), fit = (rows: string[], fill: string) => Array.from({ length: h }, (_, y) => (rows[y] ?? '').padEnd(w, fill).slice(0, w));
    map.tiles = fit(map.tiles, '#'); map.regions = fit(map.regions, '.'); map.w = w; map.h = h;
    map.npcs = map.npcs.filter((n) => n.x < w && n.y < h); map.gates = map.gates.filter((q) => q.x < w && q.y < h);
    map.start = { x: Math.min(map.start.x, w - 1), y: Math.min(map.start.y, h - 1) };
    commit(before);
  }

  // ---------- painting ----------
  const setChar = (rows: string[], x: number, y: number, ch: string) => { if (y < 0 || y >= map.h || x < 0 || x >= map.w) return; const r = rows[y]; rows[y] = r.slice(0, x) + ch + r.slice(x + 1); };
  const npcAt = (x: number, y: number) => map.npcs.findIndex((n) => n.x === x && n.y === y);
  const gateAt = (x: number, y: number) => map.gates.findIndex((q) => q.x === x && q.y === y);
  function paint(x: number, y: number) {
    if (tool === 'tile') setChar(map.tiles, x, y, brush);
    if (tool === 'region') setChar(map.regions, x, y, regionBrush);
  }
  function rect(a: [number, number], b: [number, number]) {
    for (let y = Math.min(a[1], b[1]); y <= Math.max(a[1], b[1]); y++) for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) paint(x, y);
  }
  function place(x: number, y: number) {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return;
    const before = JSON.stringify(map);
    if (tool === 'start') map.start = { x, y };
    if (tool === 'gate' && gateAt(x, y) < 0) { map.gates.push({ x, y, region: 'stillroom', says: 'Sealed with the Readers\' wax.' }); sel = { type: 'gate', i: map.gates.length - 1 }; }
    if (tool === 'npc' && npcAt(x, y) < 0) {
      let k = map.npcs.length + 1; while (map.npcs.some((n) => n.id === `c${k}`)) k++;
      map.npcs.push({ id: `c${k}`, x, y, sprite: npcSprite, name: `Stranger ${k}`, idle: 'looks at you' }); sel = { type: 'npc', i: map.npcs.length - 1 };
    }
    if (tool === 'erase') { const i = npcAt(x, y), j = gateAt(x, y); if (i >= 0) map.npcs.splice(i, 1); else if (j >= 0) map.gates.splice(j, 1); sel = null; }
    commit(before);
  }

  // ---------- view: pan and zoom ----------
  let zoom = 24, ox = 40, oy = 40, hover: [number, number] | null = null;
  let drag: { kind: 'paint' | 'rect' | 'pan' | 'move'; start: [number, number]; at: [number, number]; mx: number; my: number; before: string } | null = null;
  let spaceDown = false;
  const tileAt = (e: MouseEvent): [number, number] => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left - ox) / zoom), Math.floor((e.clientY - r.top - oy) / zoom)]; };
  function fit() {
    const w = cv.clientWidth, h = cv.clientHeight;
    zoom = Math.max(6, Math.floor(Math.min((w - 40) / map.w, (h - 40) / map.h)));
    ox = Math.round((w - map.w * zoom) / 2); oy = Math.round((h - map.h * zoom) / 2);
  }

  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('mousedown', (e) => {
    const t = tileAt(e), before = JSON.stringify(map);
    if (e.button === 2 || e.button === 1 || spaceDown) { drag = { kind: 'pan', start: t, at: t, mx: e.clientX, my: e.clientY, before }; return; }
    if (e.altKey && tool === 'tile') { brush = map.tiles[t[1]]?.[t[0]] ?? brush; tilesPanel(); return; }
    if (tool === 'tile' || tool === 'region') {
      drag = { kind: e.shiftKey ? 'rect' : 'paint', start: t, at: t, mx: e.clientX, my: e.clientY, before };
      if (!e.shiftKey) { paint(...t); built = build(map); layer = styles.pixel.layer(built.g); draw(); }
      return;
    }
    if (tool === 'select') {
      const i = npcAt(...t), j = gateAt(...t);
      sel = i >= 0 ? { type: 'npc', i } : j >= 0 ? { type: 'gate', i: j } : null;
      if (sel) drag = { kind: 'move', start: t, at: t, mx: e.clientX, my: e.clientY, before };
      panels(); draw(); return;
    }
    place(...t);
  });
  addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom) {
      hover = tileAt(e); $('#coord').textContent = `${hover[0]}, ${hover[1]}  ${kind(map.tiles[hover[1]]?.[hover[0]] ?? '#').name}${REGION_KEY[map.regions[hover[1]]?.[hover[0]] ?? '.'] ? ' · ' + region(REGION_KEY[map.regions[hover[1]][hover[0]]]).name : ''}`;
    } else hover = null;
    if (!drag) { draw(); return; }
    const t = tileAt(e);
    if (drag.kind === 'pan') { ox += e.clientX - drag.mx; oy += e.clientY - drag.my; drag.mx = e.clientX; drag.my = e.clientY; }
    else if (drag.kind === 'paint' && (t[0] !== drag.at[0] || t[1] !== drag.at[1])) {
      // paint along the line from the last tile, so fast strokes leave no gaps
      const n = Math.max(Math.abs(t[0] - drag.at[0]), Math.abs(t[1] - drag.at[1]));
      for (let i = 1; i <= n; i++) paint(Math.round(drag.at[0] + (t[0] - drag.at[0]) * i / n), Math.round(drag.at[1] + (t[1] - drag.at[1]) * i / n));
      built = build(map); layer = styles.pixel.layer(built.g);
    } else if (drag.kind === 'move' && sel) {
      const o = sel.type === 'npc' ? map.npcs[sel.i] : map.gates[sel.i];
      if (t[0] >= 0 && t[1] >= 0 && t[0] < map.w && t[1] < map.h) { o.x = t[0]; o.y = t[1]; }
    }
    drag.at = t; draw();
  });
  addEventListener('mouseup', () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.kind === 'rect') rect(d.start, d.at);
    if (d.kind !== 'pan') commit(d.before);
  });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, z = zoom;
    zoom = Math.max(6, Math.min(96, Math.round(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
    ox = mx - (mx - ox) * zoom / z; oy = my - (my - oy) * zoom / z; draw();
  }, { passive: false });
  addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    if (e.key === ' ') { spaceDown = true; e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); return e.shiftKey ? step(redo, undo) : step(undo, redo); }
    const t = TOOLS.find(([, , k]) => k === e.key.toUpperCase()); if (t && !e.ctrlKey && !e.metaKey) setTool(t[0]);
    if (e.key === 'Delete' || e.key === 'Backspace') root.querySelector<HTMLButtonElement>('#del')?.click();
  });
  addEventListener('keyup', (e) => { if (e.key === ' ') spaceDown = false; });

  // ---------- drawing ----------
  function draw() {
    const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const st = styles[view], img = view === 'pencil' ? pencilLayer : layer;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#141217'; ctx.fillRect(0, 0, w, h);
    ctx.translate(ox, oy);
    ctx.fillStyle = st.bg; ctx.fillRect(0, 0, map.w * zoom, map.h * zoom);
    ctx.imageSmoothingEnabled = view === 'pencil';
    if (img) ctx.drawImage(img, 0, 0, map.w * zoom, map.h * zoom);
    else { ctx.fillStyle = 'rgba(40,38,36,.5)'; ctx.font = '700 13px "Courier Prime", monospace'; ctx.fillText('Drawing in pencil...', 12, 22); }
    // rock that touches no floor shows as solid, so the shape of the rooms reads at a glance
    ctx.fillStyle = view === 'pixel' ? '#1d1a22' : 'rgba(40,38,36,.07)';
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.tiles[y][x] === '#') ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
    if (img && view === 'pixel') ctx.drawImage(img, 0, 0, map.w * zoom, map.h * zoom);
    if (showRegions) for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const r = REGION_KEY[map.regions[y]?.[x] ?? '.']; if (!r) continue;
      ctx.fillStyle = region(r).hue; ctx.globalAlpha = 0.16; ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
    }
    ctx.globalAlpha = 1;
    if (showGrid && zoom >= 10) {
      ctx.strokeStyle = view === 'pixel' ? 'rgba(236,232,241,.07)' : 'rgba(40,38,36,.1)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= map.w; x++) { ctx.moveTo(x * zoom + 0.5, 0); ctx.lineTo(x * zoom + 0.5, map.h * zoom); }
      for (let y = 0; y <= map.h; y++) { ctx.moveTo(0, y * zoom + 0.5); ctx.lineTo(map.w * zoom, y * zoom + 0.5); }
      ctx.stroke();
    }
    built.gates.forEach((q, i) => {
      ctx.drawImage(st.gate(false, '#ECE8F1'), q.x * zoom, q.y * zoom, zoom, zoom);
      if (sel?.type === 'gate' && sel.i === i) ring(q.x, q.y, '#F2BE6A');
    });
    map.npcs.forEach((n, i) => {
      ctx.drawImage(st.npc(n), n.x * zoom, (n.y + 1 - st.tall) * zoom, zoom, zoom * st.tall);
      if (sel?.type === 'npc' && sel.i === i) ring(n.x, n.y, '#F2BE6A');
    });
    // the start: a small flag
    const sx = map.start.x * zoom, sy = map.start.y * zoom;
    ctx.strokeStyle = '#5CC9B1'; ctx.lineWidth = 2; ctx.strokeRect(sx + 2, sy + 2, zoom - 4, zoom - 4);
    ctx.fillStyle = '#5CC9B1'; ctx.font = `700 ${Math.max(9, zoom * 0.42)}px "Courier Prime", monospace`; ctx.textAlign = 'center'; ctx.fillText('START', sx + zoom / 2, sy - 4);
    // what the tool would touch
    if (drag?.kind === 'rect') {
      const [a, b] = [drag.start, drag.at];
      ctx.strokeStyle = '#F2BE6A'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
      ctx.strokeRect(Math.min(a[0], b[0]) * zoom, Math.min(a[1], b[1]) * zoom, (Math.abs(a[0] - b[0]) + 1) * zoom, (Math.abs(a[1] - b[1]) + 1) * zoom); ctx.setLineDash([]);
    } else if (hover && tool !== 'select') ring(hover[0], hover[1], tool === 'erase' ? '#E58FA8' : '#ECE8F1');
  }
  function ring(x: number, y: number, c: string) { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(x * zoom + 1, y * zoom + 1, zoom - 2, zoom - 2); }

  // ---------- the top bar ----------
  $<HTMLInputElement>('#ed-name').onchange = (e) => { const before = JSON.stringify(map); map.name = (e.target as HTMLInputElement).value; commit(before); };
  $('#undo').onclick = () => step(undo, redo); $('#redo').onclick = () => step(redo, undo);
  root.querySelectorAll<HTMLButtonElement>('#views button').forEach((b) => b.onclick = () => {
    view = b.dataset.v as 'pixel' | 'pencil'; document.body.classList.toggle('pencil', view === 'pencil');
    root.querySelectorAll('#views button').forEach((o) => o.classList.toggle('on', o === b)); refresh();
  });
  root.querySelector<HTMLButtonElement>('#views button')!.classList.add('on');
  $<HTMLInputElement>('#o-reg').onchange = (e) => { showRegions = (e.target as HTMLInputElement).checked; draw(); };
  $<HTMLInputElement>('#o-grid').onchange = (e) => { showGrid = (e.target as HTMLInputElement).checked; draw(); };
  $('#export').onclick = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(map, null, 1)], { type: 'application/json' }));
    a.download = `${map.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'map'}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#import').onclick = () => $<HTMLInputElement>('#file').click();
  $<HTMLInputElement>('#file').onchange = async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    try { const m = JSON.parse(await f.text()); if (!m.tiles || !m.w) throw new Error('not a map'); const before = JSON.stringify(map); map = m; sel = null; commit(before); fit(); draw(); }
    catch (err) { alert(`Could not read that file as a map: ${(err as Error).message}`); }
  };
  $('#revert').onclick = () => { if (!confirm('Throw away this draft and load the built-in map?')) return; const before = JSON.stringify(map); map = clone(deep as MapData); sel = null; commit(before); fit(); draw(); };
  $('#play').onclick = () => { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* */ } open('/?map=draft#reset', '_blank'); };

  new ResizeObserver(() => draw()).observe(cv);
  tilesPanel(); refresh(); fit(); draw();
}

function loadDraft(): MapData | null {
  try { const m = JSON.parse(localStorage.getItem(KEY) || ''); return m?.tiles ? m : null; } catch { return null; }
}

