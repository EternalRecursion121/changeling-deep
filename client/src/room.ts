// A potion room: meet the creature, talk, give the draught, talk again, read it. The steps run left to
// right along the top so the player always knows where they are; the lantern (turns left) and the vial
// sit at the foot of the conversation, where the hands are.

import { placeholderPortrait } from './dither';
import { ROOMS, Turn, reply } from './mock';
import { State, region } from './world';

type Phase = 'before' | 'after' | 'reading' | 'reveal';
const STEPS: [Phase, string][] = [['before', 'Talk'], ['after', 'The draught'], ['reading', 'Read it'], ['reveal', 'The answer']];
const XP = 120;

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function roomScreen(root: HTMLElement, s: State, id: string, leave: (xp: number, passed: boolean) => void) {
  const room = ROOMS[id], g = region(room.region), sk = room.skin, p = room.potion;
  let phase: Phase = 'before', oil = room.oil, busy = false, pick = -1;
  const log: Turn[] = [{ who: 'note', text: room.narration }];

  root.innerHTML = `
    <main class="room" style="--hue:${g.hue}">
      <header class="bar">
        <button class="back" id="back">&larr; The map</button>
        <ol class="steps" id="steps"></ol>
        <span class="where">${g.name}</span>
      </header>
      <section class="stage">
        <figure class="creature">
          <canvas id="portrait" width="180" height="230"></canvas>
          <figcaption><h2>${esc(sk.name)}</h2><p>${esc(sk.body)}, ${esc(sk.story)}.</p></figcaption>
        </figure>
        <div class="talk">
          <div class="log" id="log" aria-live="polite"></div>
          <div class="hands" id="hands"></div>
        </div>
      </section>
    </main>`;
  const $ = <T extends HTMLElement>(q: string) => root.querySelector<T>(q)!;
  const logEl = $('#log'), hands = $('#hands');
  placeholderPortrait($<HTMLCanvasElement>('#portrait'), g.hue, room.seed);
  $('#back').addEventListener('click', () => leave(0, false));

  function renderSteps() {
    const k = STEPS.findIndex(([ph]) => ph === phase);
    $('#steps').innerHTML = STEPS.map(([, name], i) => `<li class="${i < k ? 'done' : i === k ? 'now' : ''}">${i + 1} ${name}</li>`).join('');
  }

  function renderLog() {
    logEl.innerHTML = log.map((t) => t.who === 'note' ? `<p class="note">${esc(t.text)}</p>`
      : t.who === 'you' ? `<p class="you"><span>You</span>${esc(t.text)}</p>`
      : `<p class="them${t.steered ? ' steered' : ''}"><span>${esc(sk.name)}</span>${esc(t.text)}</p>`).join('')
      + (busy ? `<p class="them thinking"><span>${esc(sk.name)}</span><i></i><i></i><i></i></p>` : '');
    logEl.scrollTop = logEl.scrollHeight;
  }

  function lantern() {
    return `<span class="lantern" title="Lantern oil: each thing you say burns one">${
      Array.from({ length: room.oil }, (_, i) => `<i class="${i < oil ? 'full' : ''}"></i>`).join('')}<b>${oil} left</b></span>`;
  }

  function renderHands() {
    if (phase === 'before' || phase === 'after') {
      const said = log.filter((t) => t.who === 'you').length;
      hands.innerHTML = `
        <form id="say"><input id="line" autocomplete="off" placeholder="${oil ? `Say something to ${esc(sk.name)}` : 'Your lantern is out'}" ${oil && !busy ? '' : 'disabled'} />
          <button ${oil && !busy ? '' : 'disabled'}>Say</button></form>
        <div class="tools">
          ${lantern()}
          ${phase === 'before'
            ? `<button class="vial" id="give" ${said && !busy ? '' : 'disabled'} title="${said ? '' : 'Talk first, so you have something to compare'}">
                 <span class="flask"></span>Give ${esc(sk.name)} the ${esc(p.name)}</button>`
            : `<button class="vial" id="read" ${!busy && log.some((t) => t.steered) ? '' : 'disabled'}>Read the draught</button>`}
          <button class="hourglass" disabled title="The hourglass: replay a question with and without the draught. From the Stillroom on.">Hourglass</button>
        </div>`;
      $('#say').addEventListener('submit', (e) => { e.preventDefault(); say(); });
      hands.querySelector('#give')?.addEventListener('click', give);
      hands.querySelector('#read')?.addEventListener('click', () => go('reading'));
      if (oil && !busy) $<HTMLInputElement>('#line').focus();
    } else if (phase === 'reading') {
      hands.innerHTML = `
        <div class="reading">
          <p class="ask">What did the ${esc(p.name)} do to ${esc(sk.name)}?</p>
          <div class="options">${p.options.map((o, i) => `<button class="opt${i === pick ? ' on' : ''}" data-i="${i}">${esc(o)}</button>`).join('')}</div>
          <button class="go" id="commit" ${pick < 0 ? 'disabled' : ''}>Give your reading</button>
        </div>`;
      hands.querySelectorAll<HTMLButtonElement>('.opt').forEach((b) => b.addEventListener('click', () => { pick = +b.dataset.i!; renderHands(); }));
      $('#commit').addEventListener('click', () => go('reveal'));
    } else {
      const right = pick === p.answer, xp = right ? Math.round(XP * (0.6 + 0.4 * oil / room.oil)) : 10;
      const pre = log.find((t) => t.who === 'them' && !t.steered), post = log.find((t) => t.steered);
      hands.innerHTML = `
        <div class="reveal ${right ? 'right' : 'wrong'}">
          <p class="verdict">${right ? 'A true reading.' : 'Not quite.'} <b>+${xp} xp</b></p>
          <h3>${esc(p.label)}</h3>
          <p>${esc(p.why)}</p>
          ${pre && post ? `<div class="pair"><div><span>Before</span>${esc(pre.text)}</div><div><span>After</span>${esc(post.text)}</div></div>` : ''}
          <button class="go" id="done">${right ? 'Back to the map' : 'Back to the map, and try again'}</button>
        </div>`;
      s.journal.push({ room: room.id, guess: p.options[pick], truth: p.label, right });
      $('#done').addEventListener('click', () => leave(xp, right));
    }
  }

  function go(ph: Phase) { phase = ph; renderSteps(); renderLog(); renderHands(); }

  async function say() {
    const input = $<HTMLInputElement>('#line'), text = input.value.trim();
    if (!text || !oil || busy) return;
    log.push({ who: 'you', text }); oil--; busy = true; renderLog(); renderHands();
    const drunk = phase === 'after';
    const line = await reply(room, drunk, log);
    busy = false; log.push({ who: 'them', text: line, steered: drunk }); renderLog(); renderHands();
  }

  function give() {
    log.push({ who: 'note', text: `${sk.name} drinks the ${p.name}. The vial was ${p.vial}.` });
    $('.creature').classList.add('dosed');
    go('after');
  }

  go('before');
}
