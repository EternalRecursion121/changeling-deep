import deep from './maps/deep.json';
import { MapData } from './dungeon';
import { game } from './game';
import { load, reset } from './world';

// ?map=draft plays the map open in the designer (saved in this browser); otherwise the built-in Deep
const app = document.getElementById('app')!;
if (location.hash === '#reset') { reset(); history.replaceState(null, '', location.pathname + location.search); }
const s = load();

function pickMap(): MapData {
  if (new URLSearchParams(location.search).get('map') === 'draft') {
    try { const m = JSON.parse(localStorage.getItem('cd-map-draft') || ''); if (m?.tiles) return m; } catch { /* fall through */ }
  }
  return deep as MapData;
}

const sheet = new Image();
sheet.src = '/tiles/1bit.png';
Promise.all([sheet.decode(), document.fonts.load('30px Chapbook')]).finally(() => game(app, s, sheet, pickMap()));
