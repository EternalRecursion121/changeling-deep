import { mapScreen } from './map';
import { roomScreen } from './room';
import { clear, load, reset, save } from './world';

const app = document.getElementById('app')!;
if (location.hash === '#reset') { reset(); history.replaceState(null, '', location.pathname); }
const s = load();

function toMap(opened: string[] = []) { mapScreen(app, s, toRoom, opened); }
function toRoom(id: string) {
  roomScreen(app, s, id, (xp, passed) => {
    s.xp += xp;
    const opened = passed ? clear(s, id) : [];
    save(s); toMap(opened);
  });
}

document.fonts.load('30px Chapbook').finally(() => toMap());
