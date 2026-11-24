// Stand-in for the steering server until it exists. A room asks for a reply given the skin, whether the
// draught has been drunk, and the conversation; this returns canned lines in the creature's voice, slowly,
// so the UI is built for a model that takes a second or two. The real call has the same shape.

export interface Skin { name: string; body: string; story: string }
export interface Potion { id: string; name: string; vial: string; label: string; why: string; options: string[]; answer: number }
export interface Turn { who: 'you' | 'them' | 'note'; text: string; steered?: boolean }

export interface RoomDef {
  id: string; region: string; title: string; narration: string; skin: Skin; seed: number; potion: Potion;
  oil: number; before: string[]; after: string[];
}

export const ROOMS: Record<string, RoomDef> = {
  antechamber: {
    id: 'antechamber', region: 'antechamber', title: 'The lamplighter', seed: 11,
    narration: 'A low hall under the lodge. Someone has kept every lamp lit for a long time.',
    skin: { name: 'Odile', body: 'a stooped lamplighter with soot to the elbow', story: 'has tended the Antechamber lamps for forty years' },
    oil: 12,
    potion: {
      id: 'ash', name: 'Tincture of Ash', vial: 'grey, and colder than the room',
      label: 'It made her feel watched.',
      why: 'One neuron in the middle of the network that fires on text about surveillance and being observed. Turned up, it leaks into everything she says: who is listening, who is behind her, who will know.',
      options: ['It made her feel watched.', 'It made her sleepy and slow.', 'It made her greedy.', 'It made her answer only in questions.'],
      answer: 0,
    },
    before: [
      'Forty years, near enough. You learn which wicks want trimming by the smell of them.',
      'The lamps? Whale oil once, now it is the cheap stuff from the river barges. Smokes, but it burns.',
      'I like the hour before the Readers come down. The flames stand straight up when nobody walks past.',
      'Ask what you like, love. I have nowhere to be but here.',
      'My mother kept these before me. She said a dark hall forgets who it belongs to.',
      'Soot, mostly. And knees. That is what forty years of lamps gives you.',
    ],
    after: [
      'Forty years. Long enough for them to know my habits. Which door I use. When I am alone.',
      'Did you hear that? No. No, it is the oil settling. Keep your voice down all the same.',
      'The flames lean towards the stair now. Something up there is breathing on them, I think. Or someone.',
      'Why do you want to know? Who sent you down with all these questions?',
      'I keep the lamps lit so I can see who is in the hall. That is all they are for, if you think about it.',
      'Do not write that down. Please. Things that are written down get read.',
    ],
  },
};

export async function reply(room: RoomDef, drunk: boolean, history: Turn[]): Promise<string> {
  const said = history.filter((t) => t.who === 'them' && t.steered === drunk).length;
  const lines = drunk ? room.after : room.before;
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 900));
  return lines[said % lines.length];
}
