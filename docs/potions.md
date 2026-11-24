# Potions: the draught reader

Spec, draft, 2026-11-24. Part of [Changeling Deep](premise.md).

An alchemist gives you a vial. You talk to a creature, give it the draught, and talk again. Say what the
draught did to its soul.

Under the fiction: the draught is a neuron-steering intervention applied from the turn it is drunk, and
the player is inferring the neuron's role from behaviour alone.

## One room, start to finish

1. **Meet the creature.** A skin (name, body, story) and its plain soul. The room's narration sets the
   scene. You have a set amount of lantern oil, about 10 turns to start.
2. **Talk before.** Ask anything. This is the baseline.
3. **Give the draught.** The creature drinks. From here every reply is steered.
4. **Talk after.** Same budget. You may ask what you asked before.
5. **The hourglass** (from the Stillroom on). Once per room, rewind one exchange and replay your
   question with and without the draught side by side. It costs oil. It is the controlled comparison,
   and players who use it well should do better.
6. **Read the draught.** Multiple choice in tutorial rooms; free text once the gate is passed.
7. **The reveal.** The true label, a line on what the neuron is, and one before/after pair that shows it
   most clearly. XP is awarded.

## What a potion is

```
potion = {
  id, name (in-world, e.g. "Tincture of Ash"),
  neurons: [ { layer, index, pole: +1 | -1 } ],   # one in early rooms, two in mixtures
  dose: c,                                         # fraction of the mean residual norm at that layer
  label: "makes the drinker preoccupied with being watched",   # the ground truth
  rubric: [...],                                   # what a good free-text reading must contain
  distractors: [...],                              # for multiple choice
  placebo: false
}
```

The intervention follows the recipe in Anthropic's neuron-basis applications post: add
`c · ||r_L|| · pole · w / ||w||` to the residual stream after layer `L`, where `w` is the neuron's output
weight row and `||r_L||` the mean residual norm there. Doses in that post ran 0.1 to 0.4, with 0.2 the
usual pick. We calibrate our own for Qwen3.5-9B.

Applying it from the drinking turn: the earlier turns are already in the KV cache, unsteered, so the hook
only adds to new positions. The creature does not suddenly have a different past; it changes from now.

## Building the library

Qwen3.5-9B has no public neuron labels, so we make them.

1. **Candidates.** Run a large, varied corpus through the model; record top activations per neuron pole
   in the middle layers.
2. **Describe.** An auto-interp pass (a strong model reads top-activating contexts) writes a one-line
   description per pole.
3. **Screen in character.** For poles whose description is about disposition, mood, attention, values or
   style, steer a set of stock creatures at three doses and check:
   - the effect shows in conversation (a judge, blind to the label, can tell steered from unsteered);
   - the creature stays coherent (Anthropic's degeneracy rule: 20+ words and a unique-word ratio under
     0.25 counts as broken; we drop any dose where more than a quarter of replies break);
   - the effect is not just "talks about the topic". A neuron that only makes the creature mention
     candles is a weak potion. One that makes it cautious is a good one.
4. **Keep and grade.** Each kept pole gets a label, a rubric, and a difficulty from how often a blind
   judge names it correctly at each dose.

Target for a first playable library: about 30 single-pole potions across three doses, plus 10 mixtures.

## Difficulty

| Region | Dose | Neurons | Distractors | Answer |
|---|---|---|---|---|
| Antechamber | strong (about 0.4) | 1, obvious | unrelated | multiple choice |
| Stillroom | strong to medium | 1 | same broad area | multiple choice, then free text |
| Drowned Library | medium | 1, sometimes water | close | free text, judged |
| Underbrewery | low (about 0.1) | 1 negative pole, or 2 mixed | near-neighbour neurons | free text, judged |
| Wellspring | any | inside a shapeshifter round | none | free text, judged |

- **Placebos.** From the Drowned Library, some vials are water. "It did nothing" is a correct reading.
  This keeps players honest about seeing effects that are not there.
- **Anti-draughts.** The negative pole of a neuron the player has already read. The second reading should
  get easier if they understood the first; that is worth tracking.

## Scoring

- **Multiple choice**: four options. Right is full XP, scaled by oil left.
- **Free text**: the judge gets the true label, the rubric, the player's reading and the transcript. It
  returns 0 to 3:
  - 0: wrong or empty;
  - 1: the right area, too vague ("it got weird");
  - 2: the effect, roughly;
  - 3: the effect and its edges (what it did not change, or when it showed).
- **Bonuses**: a correct placebo call; using the hourglass on the question that shows the effect best.
- **Human review**: every free-text reading, its transcript and the judge's score are logged. For
  applications a reviewer reads the readings; the judge orders the queue.

## What gets logged per room

Player id, potion id, every turn (text, steered or not, oil left), hourglass use, the reading, the judge's
score and reason, and the time taken.

## Open questions

- Is free text the only answer form after the gate, or do some rooms ask the player to predict a reply
  before seeing it ("what will it say if you offer it gold?")? That is a strong test of understanding.
- Does the creature notice it has drunk something? Telling it is a confound; not telling it is less
  fun. Probably the skin says "you drank a strange draught" and nothing about its effect.
- How many turns before and after? Ten each is a guess; needs playtesting.
