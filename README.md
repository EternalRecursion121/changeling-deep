# Changeling Deep

A dungeon crawler where every creature is a steered language model. Working title.

- `docs/`: the premise and the two game specs (potions, shapeshifters)
- `client/`: the web prototype (Vite + TypeScript). The game is `index.html`; the map designer is
  `editor.html` (`/editor` on the preview). Maps are JSON in `client/src/maps/`: design one, Export
  it, and save it over `deep.json` to make it the built-in map. "Play this map" in the designer plays
  the draft without exporting. `npm run dev`, or `npm run build` and
  `rsync -a --delete dist/ /var/www/changeling-deep/` for the preview at
  https://changeling.178-105-127-71.sslip.io (add `#reset` to the URL to start over)
- `art/`: Midjourney prompts; drop the images in `art/midjourney/`

The creature replies are canned (`client/src/mock.ts`) until the steering server exists.

Controls: WASD or arrows to walk, E to talk, 1 / 2 to switch between the pixel and pencil art.
Pixel tiles: Kenney's 1-Bit Pack, CC0 (`client/public/tiles/1bit-LICENSE.txt`).
