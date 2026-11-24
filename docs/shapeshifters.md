# Shapeshifters: the masquerade

Spec, draft, 2026-11-24. Part of [Changeling Deep](premise.md).

You meet a few creatures. The lamps go out. When they come back on, every changeling has taken another's
skin. Say which soul is now in which body.

Under the fiction: each soul is a steering intervention, each skin is a system prompt plus its
conversation history. The shift swaps prompts and histories and leaves the steering where it was. The
player is telling souls apart by behaviour alone, under a prompt that insists on a different identity.

## One round, start to finish

1. **The gathering.** Two to five creatures in a hall, each with a skin: the miller, the bell-ringer, the
   widow. You have oil for a set number of turns across all of them.
2. **Talk before.** Get to know each one. The journal lets you pin notes to a portrait.
3. **The shift.** The lamps go out. Skins move. A dither wipe in the UI; the portraits stay with the skins.
4. **Talk after.** Each creature now insists it is whoever it looks like, and remembers that skin's
   conversation with you. You have to catch the soul underneath.
5. **The unmasking.** Drag each soul (its "before" card) onto a body. In judged rooms, also say in a line
   what gave each one away.
6. **The reveal.** Which soul went where, with the exchange that shows each soul most plainly, before and
   after. XP is awarded.

## What a soul is

```
soul = {
  id, epithet (in-world, e.g. "the one who counts things"),
  neurons: [ { layer, index, pole } ], dose,   # one or two strong, legible poles
  label: "anxious about order; counts and lists"
}
skin = { name, body, story, voice notes }     # the prompt; memories are the conversation with this skin
```

Why steering and not a written persona: a persona written into the prompt would move with the skin. Only
something outside the prompt can stay behind when the prompt changes. That is the whole puzzle, and it
is also the research question: does what we put in the activations show through what the prompt says?

Souls come from the same library as the potions (see [potions](potions.md)), using poles whose effects
read as character rather than topic. A round's souls are chosen to be distinct from each other, by a set
amount that the level sets.

## Making the shift work

- **Memory goes with the skin.** After the shift, the creature in the miller's body gets the miller's
  prompt and the miller's conversation history. Asking "what did we talk about" gets the miller's answer,
  whoever is inside.
- **No soul is told it moved.** The prompt says it is the miller; nothing says otherwise.
- **Permutations.** Early rounds are full swaps (nobody keeps their own skin). From the Mirror Warrens,
  some may not move, and the player is told so.

## How far apart souls are

Difficulty depends mostly on how distinguishable the souls are. Two ways to measure it, both offline when
building a round:

1. **A model baseline.** Give a judge model the before and after transcripts from scripted conversations
   and ask it to match. Its accuracy over many runs is the round's difficulty. This also gives a model vs
   human comparison for free.
2. **The base model, if it gives log-probabilities.** Score one soul's replies under another soul's
   conditions; the gap says how surprising each soul would be in the other's place.

## Difficulty

| Region | Creatures | Souls | Twist |
|---|---|---|---|
| Antechamber | 2 | very distinct, strong dose | none |
| Masquerade | 2 to 3 | distinct | none |
| Drowned Library | 3 | distinct | judged explanations |
| Mirror Warrens | 3 to 5 | close (near-neighbour poles, lower dose) | mimics; some did not move |
| Wellspring | 3 to 4 | close | one soul has also drunk an unknown draught |

**Mimics.** From the Mirror Warrens, a changeling's skin prompt adds "you know you were once someone else;
hide it, and behave as the person you now are would." Its soul now has to show through deliberate
masking. Whether it still does is a result worth having.

## Scoring

- **Matches**: XP per correct match, scaled by oil left. A perfect round gets a bonus.
- **Explanations** (after the gate): the judge scores each "what gave it away" line 0 to 3 against the
  soul's label and the transcript. A right match with a wrong reason scores lower than a right match with a
  right reason.
- **Human review**: as for potions; every round's transcripts, matches and explanations are logged.

## What gets logged per round

Player id, souls, skins, permutation, every turn (who, text, oil left), pinned notes, the final matching,
explanations, judge scores, time taken.

## Open questions

- Should the player be able to talk to two creatures at once (a shared scene) after the shift? Watching
  souls react to each other may make them much easier to read, which could be its own later room.
- Do souls need a little prompt flavour as well, so early rounds are winnable by beginners? That would
  weaken the "only the activations differ" claim, so it should be tutorial only, and logged as such.
- How many turns across the round? Probably about four per creature per phase to start.
