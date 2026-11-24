# Changeling Deep: premise

Working title. Draft, 2026-11-24.

A dungeon crawler where every creature is a language model whose soul you can read. You play an apprentice
of the Readers, the guild that goes down into the Deep to tell what a creature *is* from how it talks. You
earn XP, lift the fog off more of the map, and the souls get harder to read.

There are two games, both specced separately:

- [Potions](potions.md): an alchemist's draught changes a creature's soul. Work out what it did.
- [Shapeshifters](shapeshifters.md): changelings swap skins. Work out who is who.

## Skin and soul

The one rule of the world: **everything in the Deep has a skin and a soul.**

- The **skin** is what a creature wears: its body, its name, its story, its memories. Skins can be taken
  off and put on.
- The **soul** is what it is. It shows through any skin, in what the creature notices, what it reaches
  for, what it avoids.

The rule is the research question under the game. Skin is the prompt; soul is what sits in the
activations.

| In the world | In the model |
|---|---|
| Skin: body, name, story | System prompt (or a base-model document frame) |
| A creature's memories | The conversation so far, which belongs to the skin |
| Soul | A steering intervention: neuron poles at a dose, added to the residual stream |
| Potion | A steering intervention applied mid-conversation |
| Changeling's shift | The prompt and history are swapped; the steering stays where it was |
| Lantern oil | The player's budget of turns |

Memory travels with the skin, not the soul. A changeling wearing the miller's skin remembers the miller's
conversation with you. So you cannot catch it out with "what did we just talk about"; you can only catch
its nature.

## The map

The Deep is under the city of Ostry, entered through the Readers' lodge. Fog covers every region you
have not earned. Each region is one colour on the map and in its rooms.

```
                          THE LODGE (surface)
                                |
                         [1] ANTECHAMBER
                       tutorial: one potion,
                     multiple choice, one shift
                         /               \
                        /                 \
          [2] THE STILLROOM           [3] THE MASQUERADE
          single draughts,            two changelings,
          strong doses                plain souls
          (rank: Novice)              (rank: Novice)
               |    \                 /     |
               |     \               /      |
               |    [4] THE DROWNED LIBRARY |
               |    free-text readings      |
               |    open; judged guesses    |
               |    (gate: pass both        |
               |     tutorials)             |
               |       /         \          |
          [5] THE UNDERBREWERY   [6] THE MIRROR WARRENS
          low doses, anti-        three to five changelings,
          draughts (negative      closer souls, some
          poles), mixtures        that mimic their skin
          (rank: Journeyman)      (rank: Journeyman)
                      \            /
                       \          /
                   [7] THE WELLSPRING
                   changelings who drank an
                   unknown draught: read both
                   (rank: Adept)
```

| Region | Game | What is new there | Opens at |
|---|---|---|---|
| 1 Antechamber | both | the rules; multiple choice only | start |
| 2 Stillroom | potions | one neuron, strong dose, easy distractors | finishing the Antechamber |
| 3 Masquerade | shapeshifters | two creatures, distinct souls | finishing the Antechamber |
| 4 Drowned Library | both | free-text answers, judged; a placebo vial | passing the tutorial gates in 2 and 3 |
| 5 Underbrewery | potions | low doses, negative poles, two-neuron mixtures, near-neighbour distractors | Journeyman |
| 6 Mirror Warrens | shapeshifters | 3 to 5 creatures, close souls, mimics, some who did not move | Journeyman |
| 7 Wellspring | both at once | a shapeshifter round where one soul has also been dosed | Adept |

Each region is a short run of rooms (four to six) ending in a harder one: the region's keeper. Clearing
the keeper lifts the fog off the paths beyond.

## Progression

- **XP** comes from correct readings. Fewer turns used means more XP, so reading quickly is the skill.
- **Ranks**: Novice, Apprentice, Journeyman, Adept, Master Reader. Ranks open regions; XP buys ranks.
- **The tutorial gate.** Every reading starts as multiple choice. Once a player gets three of four right
  in a region's first rooms, the Drowned Library opens and readings become free text, judged by a model.
  Multiple choice stays available as an easier, lower-XP option.
- **Lantern oil** is the turn budget. Each thing you say to a creature burns a little. It caps the play
  (and the compute), and it makes the questions you choose part of the score.
- **The Reader's journal** keeps every reading: what you asked, what you guessed, and what the answer was.
  It is also the record a human reviewer reads.

## How the two games meet

They share the rule, so they can stack. A potion changes a soul; a shift moves a soul to a new skin. By
the Wellspring the player meets changelings one of whom has drunk something, and has to say both who is
who and what the draught did. That is the end of the main path.

## Look and feel

The Deep is walked, not clicked: a top-down tile dungeon, WASD to move a tile at a time, E to talk to
whoever you face. The lantern lights a radius around you; ground you have seen stays on the map,
dimmed. Regions are physically joined, and an unearned region is behind a sealed door. Talking to a
creature opens the conversation over the dungeon (portrait left, talk right, vial and lantern at the
foot).

Two art directions are in the prototype, switchable in play with 1 and 2, to choose between:

- **Pixel**: Kenney's 1-Bit Pack (CC0), one ink per region on black, close to the Mindscapes agenda page.
- **Pencil**: graphite on paper. Cave walls in Dyson-style hatching, characters as rough doodles
  with Mervyn Peake's Gormenghast sketches as the reference. Unseen ground is blank paper, so the
  map draws itself as you explore.

The Menagerie, west of the Antechamber, holds every character the art can make, for looking at.

## Technical shape

- **Client**: a static web app (TypeScript, no heavy framework). The map, rooms, journal and state.
- **Steering server**: Python, Qwen3.5-9B with forward hooks that add neuron output vectors to the
  residual stream. One endpoint: skin, soul, potion (with the turn it was drunk on), conversation; it
  returns the reply. `enable_thinking=False` on every call. Hosted on Modal to start.
- **Base model (ACS infra)**: the world, not the suspects. It writes room narration and background
  inhabitants as document continuations, and later can host changeling souls written as documents.
  If it returns log-probabilities, it also measures how far apart two souls are, which orders the levels.
- **Judge**: a model scores free-text readings against the potion's true label and a rubric. Every judged
  reading is logged for human review; the judge's score is a proxy, not the decision.

## Open questions

- Is this for an application process from the start, or a public game that also produces application
  data? It changes how much the journal records and whether players have accounts.
- What exactly does ACS give: which base models, log-probabilities or not, activations or only an API?
- Qwen3.5-9B neuron labels do not exist yet. We would make our own (auto-interp descriptions plus a
  behaviour screen in character contexts). See the potions spec.
- Single player only, or a shared leaderboard per region?
