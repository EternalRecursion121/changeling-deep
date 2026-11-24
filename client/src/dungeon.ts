// The Deep as tiles. Rooms are carved out of solid rock; each room belongs to a region and is drawn in
// that region's ink. Sprites are indices into Kenney's 1-Bit Pack (CC0), monochrome_transparent_packed.png,
// a 48-wide sheet of 16px tiles.

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

export interface Npc { id: string; x: number; y: number; sprite: number; name: string; room?: string; idle?: string; wander?: boolean; hue?: number }

// every character in the sheet: six rows of people, then the beasts and monsters
export const MENAGERIE: number[] = [
  ...[0, 1, 2, 3, 4, 6].flatMap((r) => Array.from({ length: 8 }, (_, c) => r * 48 + 24 + c)),
  ...[5, 7, 8].flatMap((r) => Array.from({ length: 8 }, (_, c) => r * 48 + 24 + c)),
];
export interface Gate { x: number; y: number; region: string; says: string }

// regions as rectangles of floor (inclusive); a tile takes the hue of the region it lies in
export const AREAS: { region: string; x0: number; y0: number; x1: number; y1: number }[] = [
  { region: 'menagerie', x0: 1, y0: 1, x1: 13, y1: 11 },
  { region: 'antechamber', x0: 16, y0: 2, x1: 27, y1: 9 },
  { region: 'stillroom', x0: 9, y0: 14, x1: 19, y1: 21 },
  { region: 'masquerade', x0: 24, y0: 14, x1: 34, y1: 21 },
  { region: 'library', x0: 13, y0: 26, x1: 30, y1: 32 },
];

export const W = 44, H = 36;
export type Cell = { t: string; deco?: number; solid: boolean };

export function build() {
  const g: Cell[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => ({ t: '#', solid: true })));
  const carve = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = { t: '.', solid: false };
  };
  const put = (x: number, y: number, t: string, deco?: number, solid = true) => { g[y][x] = { t, deco, solid }; };

  for (const a of AREAS) carve(a.x0, a.y0, a.x1, a.y1);
  // corridors
  carve(18, 10, 18, 13); carve(25, 10, 25, 13);           // antechamber down to the stillroom and the masquerade
  carve(14, 22, 14, 25); carve(29, 22, 29, 25);           // and on down to the library
  carve(21, 33, 21, 34);                                   // the way deeper
  carve(14, 6, 15, 6);                                     // west to the Menagerie

  // the Antechamber: stairs up to the lodge, a row of lamps, two pillars
  put(21, 2, 'S', T.stairs); put(22, 2, 'S', T.stairs);
  for (const x of [16, 19, 24, 27]) put(x, 2, 'c', T.candle);
  for (const x of [17, 26]) put(x, 9, 'c', T.candle2);
  put(18, 5, 'p', T.pillar); put(25, 5, 'p', T.pillar);
  put(16, 9, 'w', T.web, false);

  // the Stillroom: shelves of bottles along the top, a still and a table
  for (let x = 9; x <= 19; x++) if (x !== 14) put(x, 14, 'b', T.bottle[x % T.bottle.length]);
  put(11, 18, 'k', T.cauldron); put(16, 19, 't', T.table); put(17, 19, 'b', T.bottle[2]);
  put(19, 21, 'w', T.web, false);

  // the Masquerade: masks hung along the top wall
  for (let x = 24; x <= 34; x += 2) put(x, 14, 'm', T.mask[(x / 2) % T.mask.length]);
  for (const [x, y] of [[24, 21], [34, 21]]) put(x, y, 'c', T.candle);

  // the Drowned Library: shelves, and water across the lower half
  for (let x = 13; x <= 30; x++) if (x !== 14 && x !== 29) put(x, 26, 'B', T.books);
  for (let y = 30; y <= 32; y++) for (let x = 13; x <= 30; x++) if (x < 20 || x > 22) put(x, y, '~', T.water, true);

  // doors: open ones are just floor with a door frame; locked ones are gates
  put(15, 6, '+', T.door, false);
  put(18, 10, '+', T.door, false); put(25, 10, '+', T.door, false);
  const gates: Gate[] = [
    { x: 18, y: 11, region: 'stillroom', says: 'Sealed with the Readers\' wax. Finish the Antechamber first.' },
    { x: 25, y: 11, region: 'masquerade', says: 'Sealed with the Readers\' wax. Finish the Antechamber first.' },
    { x: 14, y: 25, region: 'library', says: 'The Archivist lets in only those who have passed both tutorials: the Stillroom and the Masquerade.' },
    { x: 29, y: 25, region: 'library', says: 'The Archivist lets in only those who have passed both tutorials: the Stillroom and the Masquerade.' },
    { x: 21, y: 34, region: 'deeper', says: 'The way down. The Underbrewery and the Mirror Warrens open at Journeyman; the Wellspring at Adept.' },
  ];

  const npcs: Npc[] = [
    { id: 'odile', x: 21, y: 6, sprite: 74, name: 'Odile', room: 'antechamber', idle: 'trims a wick' },
    { id: 'aldous', x: 14, y: 17, sprite: 77, name: 'Brother Aldous', idle: 'counts bottles under his breath' },
    { id: 'miller', x: 26, y: 17, sprite: 216, name: 'The miller', idle: 'stands very still' },
    { id: 'bellringer', x: 29, y: 16, sprite: 218, name: 'The bell-ringer', idle: 'watches you' },
    { id: 'widow', x: 32, y: 18, sprite: 219, name: 'The widow', idle: 'does not turn round' },
    { id: 'archivist', x: 21, y: 28, sprite: 411, name: 'The Archivist', idle: 'drifts over the water' },
  ];
  // the Menagerie: a room of everyone in the sheet, for looking at the art. They wander.
  const free: [number, number][] = [];
  for (let y = 2; y <= 10; y++) for (let x = 2; x <= 12; x++) if ((x + y) % 2 === 0) free.push([x, y]);
  MENAGERIE.forEach((sprite, i) => {
    if (i >= free.length) return;
    const [x, y] = free[(i * 37) % free.length];
    if (npcs.some((n) => n.x === x && n.y === y)) return;
    npcs.push({ id: `m${i}`, x, y, sprite, name: `Resident ${i + 1}`, idle: 'looks back at you', wander: true, hue: i });
  });
  put(1, 1, 'c', T.candle); put(13, 1, 'c', T.candle); put(1, 11, 'c', T.candle2); put(13, 11, 'c', T.candle2);
  return { g, gates, npcs, start: { x: 21, y: 3 } };
}

export const areaAt = (x: number, y: number) =>
  AREAS.find((a) => x >= a.x0 - 1 && x <= a.x1 + 1 && y >= a.y0 - 1 && y <= a.y1 + 1)?.region;
