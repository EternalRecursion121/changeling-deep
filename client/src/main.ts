import { game } from './game';
import { load, reset } from './world';

const app = document.getElementById('app')!;
if (location.hash === '#reset') { reset(); history.replaceState(null, '', location.pathname); }
const s = load();

const sheet = new Image();
sheet.src = '/tiles/1bit.png';
Promise.all([sheet.decode(), document.fonts.load('30px Chapbook')]).finally(() => game(app, s, sheet));
