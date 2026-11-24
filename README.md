# Changeling Deep

A dungeon crawler where every creature is a steered language model. Working title.

- `docs/`: the premise and the two game specs (potions, shapeshifters)
- `client/`: the web prototype (Vite + TypeScript). `npm run dev`, or `npm run build` and
  `rsync -a --delete dist/ /var/www/changeling-deep/` for the preview at
  https://changeling.178-105-127-71.sslip.io (add `#reset` to the URL to start over)
- `art/`: Midjourney prompts; drop the images in `art/midjourney/`

The creature replies are canned (`client/src/mock.ts`) until the steering server exists.
