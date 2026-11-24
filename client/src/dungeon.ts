// The Deep as tiles. A map is plain JSON (src/maps/*.json, made in the map designer at /editor.html):
// a grid of tile characters, a grid of region letters, and lists of gates and characters. Sprites are
// indices into Kenney's 1-Bit Pack (CC0), monochrome_transparent_packed.png, a 48-wide sheet of 16px tiles.

export const COLS = 48, TILE = 16;

export const T = {
  floor: [0, 0, 0, 0, 0, 1, 5, 6, 7],
  wall: 727, wallB: 726, rough: 624,
  door: 434, locked: 528, stairs: 21, pillar: 147,
  candle: 723, candle2: 724, fire: 494,
  bottle: [656, 657, 658, 704, 705, 706, 567, 568],
  shelf: 488, table: 396, cauldron: 677, web: 722, skull: 566,
  mask: [505, 507, 509, 504, 511],
  books: 537, water: 61,
} as const;

// every tile a map can hold: its character in the JSON, its name in the designer, its sprite, whether it
// blocks walking, and whether it blocks the lantern's light
export interface Kind { ch: string; name: string; solid: boolean; sight?: boolean; deco?: (x: number) => number }
export const KINDS: Kind[] = [
  { ch: '#', name: 'Rock', solid: true, sight: true },
  { ch: '.', name: 'Floor', solid: false },
  { ch: '+', name: 'Doorway', solid: false, deco: () => T.door },
  { ch: 'S', name: 'Stairs up', solid: true, deco: () => T.stairs },
  { ch: 'c', name: 'Candle', solid: true, deco: () => T.candle },
  { ch: 'C', name: 'Candle (low)', solid: true, deco: () => T.candle2 },
  { ch: 'p', name: 'Pillar', solid: true, sight: true, deco: () => T.pillar },
  { ch: 'b', name: 'Bottles', solid: true, deco: (x) => T.bottle[x % T.bottle.length] },
  { ch: 'k', name: 'Cauldron', solid: true, deco: () => T.cauldron },
  { ch: 't', name: 'Table', solid: true, deco: () => T.table },
  { ch: 'm', name: 'Mask', solid: true, deco: (x) => T.mask[Math.floor(x / 2) % T.mask.length] },
  { ch: 'B', name: 'Bookshelf', solid: true, sight: true, deco: () => T.books },
  { ch: '~', name: 'Water', solid: true, deco: () => T.water },
  { ch: 'w', name: 'Cobweb', solid: false, deco: () => T.web },
  { ch: 'x', name: 'Skull', solid: false, deco: () => T.skull },
];
export const kind = (ch: string) => KINDS.find((k) => k.ch === ch) ?? KINDS[0];

// region letters in the regions grid ('.' is none)
export const REGION_KEY: Record<string, string> = {
  n: 'menagerie', a: 'antechamber', s: 'stillroom', q: 'masquerade', l: 'library', u: 'underbrewery', r: 'warrens', v: 'wellspring',
};

export interface Npc { id: string; x: number; y: number; sprite: number; name: string; room?: string; idle?: string; wander?: boolean; hue?: number }
export interface Gate { x: number; y: number; region: string; says: string }
export interface MapData { name: string; w: number; h: number; start: { x: number; y: number }; tiles: string[]; regions: string[]; gates: Gate[]; npcs: Npc[] }
export type Cell = { t: string; deco?: number; solid: boolean; sight: boolean };

let current: MapData | null = null;

export function build(m: MapData) {
  current = m;
  const g: Cell[][] = Array.from({ length: m.h }, (_, y) => Array.from({ length: m.w }, (_, x) => {
    const k = kind(m.tiles[y]?.[x] ?? '#'); return { t: k.ch, deco: k.deco?.(x), solid: k.solid, sight: !!k.sight };
  }));
  return { g, gates: m.gates.map((q) => ({ ...q })), npcs: m.npcs.map((n) => ({ ...n })), start: { ...m.start } };
}

// which region a tile belongs to, in the map last built
export const areaAt = (x: number, y: number) => current ? REGION_KEY[current.regions[y]?.[x] ?? '.'] : undefined;

// every character in the sheet: six rows of people, then the beasts and monsters
export const SPRITES: number[] = [
  ...[0, 1, 2, 3, 4, 6].flatMap((r) => Array.from({ length: 8 }, (_, c) => r * 48 + 24 + c)),
  ...[5, 7, 8].flatMap((r) => Array.from({ length: 8 }, (_, c) => r * 48 + 24 + c)),
];
