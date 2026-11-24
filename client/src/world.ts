// The Deep: regions, the paths between them, and what opens each. Positions are fractions of the map.
// See docs/premise.md for the map this draws.

export interface Region {
  id: string; n: number; name: string; hue: string; game: 'potions' | 'shapeshifters' | 'both';
  line: string; x: number; y: number; opens: string;
}

export const REGIONS: Region[] = [
  { id: 'antechamber', n: 1, name: 'The Antechamber', hue: '#ECE8F1', game: 'both', x: .5, y: .13,
    line: 'Where every Reader starts. One draught, one shift, and the rules.', opens: 'Open from the start' },
  { id: 'stillroom', n: 2, name: 'The Stillroom', hue: '#E8A65A', game: 'potions', x: .25, y: .33,
    line: 'The alchemists\' workshop. Single draughts, strong doses.', opens: 'Finish the Antechamber' },
  { id: 'masquerade', n: 3, name: 'The Masquerade', hue: '#E58FA8', game: 'shapeshifters', x: .75, y: .33,
    line: 'A hall of masks. Two changelings, plain souls.', opens: 'Finish the Antechamber' },
  { id: 'library', n: 4, name: 'The Drowned Library', hue: '#5CC9B1', game: 'both', x: .5, y: .5,
    line: 'Readings in your own words, weighed by the Archivist. Some vials are water.', opens: 'Pass the tutorial gates' },
  { id: 'underbrewery', n: 5, name: 'The Underbrewery', hue: '#9BCB6A', game: 'potions', x: .24, y: .69,
    line: 'Faint doses, anti-draughts and mixtures.', opens: 'Reach Journeyman' },
  { id: 'warrens', n: 6, name: 'The Mirror Warrens', hue: '#8FB0EE', game: 'shapeshifters', x: .76, y: .69,
    line: 'Up to five changelings, close souls, and mimics who hide.', opens: 'Reach Journeyman' },
  { id: 'wellspring', n: 7, name: 'The Wellspring', hue: '#B99AF2', game: 'both', x: .5, y: .87,
    line: 'Changelings who have drunk something. Read both.', opens: 'Reach Adept' },
];

export const PATHS: [string, string][] = [
  ['antechamber', 'stillroom'], ['antechamber', 'masquerade'], ['stillroom', 'library'], ['masquerade', 'library'],
  ['stillroom', 'underbrewery'], ['masquerade', 'warrens'], ['library', 'underbrewery'], ['library', 'warrens'],
  ['underbrewery', 'wellspring'], ['warrens', 'wellspring'],
];

export const RANKS = [
  { name: 'Novice', xp: 0 }, { name: 'Apprentice', xp: 100 }, { name: 'Journeyman', xp: 300 },
  { name: 'Adept', xp: 700 }, { name: 'Master Reader', xp: 1500 },
];

export interface State { xp: number; open: string[]; cleared: string[]; journal: { room: string; guess: string; truth: string; right: boolean }[] }

const KEY = 'changeling-deep:v1';
const fresh = (): State => ({ xp: 0, open: ['antechamber'], cleared: [], journal: [] });

export function load(): State {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return fresh(); }
}
export function save(s: State) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private window */ } }
export function reset() { try { localStorage.removeItem(KEY); } catch { /* */ } }

export const rank = (xp: number) => [...RANKS].reverse().find((r) => xp >= r.xp)!;
export const nextRank = (xp: number) => RANKS.find((r) => r.xp > xp);
export const region = (id: string) => REGIONS.find((r) => r.id === id)!;

// what clearing a region opens (prototype rules: the real gates are in docs/premise.md)
export function clear(s: State, id: string): string[] {
  if (!s.cleared.includes(id)) s.cleared.push(id);
  const opened: string[] = [];
  for (const [a, b] of PATHS) if (a === id && !s.open.includes(b) && gateMet(s, b)) { s.open.push(b); opened.push(b); }
  return opened;
}
function gateMet(s: State, id: string) {
  if (id === 'stillroom' || id === 'masquerade') return s.cleared.includes('antechamber');
  if (id === 'library') return s.cleared.includes('stillroom') && s.cleared.includes('masquerade');
  if (id === 'underbrewery' || id === 'warrens') return s.xp >= 300;
  if (id === 'wellspring') return s.xp >= 700;
  return false;
}
