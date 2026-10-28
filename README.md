# Sprite Blocks

A block-based game maker for grid-based platformers and top-down games, inspired by Code.org's
[Sprite Lab](https://github.com/code-dot-org/code-dot-org). It is built on the latest
[Blockly](https://github.com/RaspberryPiFoundation/blockly) and [p5.js](https://p5js.org/), with a small
grid-aware sprite engine.

## Getting started

```bash
npm install
npm run dev
```

`npm run build` type-checks and writes a static site to `dist/`. Pushing to `main` deploys it to GitHub
Pages through `.github/workflows/deploy.yml`. In the repository settings, set **Pages → Source** to
"GitHub Actions".

## How it works

| Area | Where |
| --- | --- |
| Project model (levels, assets, serialized workspaces) | `src/model.ts` |
| Asset catalog (sprite classes, costumes, backgrounds, sounds) | `src/assets.ts`, `public/assets/` |
| Main-workspace blocks (events, sprites, game rules) and generators | `src/blocks/main_blocks.ts` |
| Path blocks and generator | `src/blocks/path_blocks.ts` |
| Custom fields (sprite and asset pickers, grid location picker) | `src/blocks/fields.ts` |
| Toolboxes and theme | `src/blocks/toolbox.ts` |
| Workspace setup, path rename sync, warnings, compilation | `src/workspaces.ts`, `src/compile.ts` |
| Game runtime (p5.js sketch, physics, paths, events, HUD) | `src/runtime/engine.ts` |
| Level editor, asset library, dialogs | `src/ui/` |
| Save, open, import and export | `src/storage.ts` |

### Program flow

* **Getting started:** first-time visitors and new blank games are offered a short guided tour of the tabs. The
  **Tour** button in the header replays it. A blank game starts with no sprites.
* **Sprites** are added from the built-in library on the Sprites tab. The tabs follow the usual order of making a
  game: Sprites, Levels, Code, Paths.
* **Levels** are edited in a DOM grid (Levels tab). When a game runs, each level becomes hidden setup code
  (`$g.setupLevel(...)` and one `$g.spawn(...)` per sprite). The `{ }` button shows this code next to the code
  generated from your blocks.
* **Main workspace** blocks are standard Blockly JSON definitions. Event blocks register handlers, and every
  action finishes within one frame. Blocks that are not inside an event are disabled.
* **Paths** live in their own workspace (Paths tab) with a flyout toolbox. Each path definition compiles to a
  JavaScript generator function that the engine steps once per frame. `move left 3 spaces` moves one grid space
  at a time. It stops early at obstacles and, if the path says "stay on", at platform edges. "set path" blocks
  start a path without blocking the code that called them.
* **Sprite classes** set the default behaviour:
  * player: keyboard control, followed by the camera, has gravity in platformer levels.
  * platform and obstacle: solid. Planks are one-way platforms.
  * collectible, hazard, scenery, goal: no built-in behaviour beyond class defaults (hazards have gravity in
    platformer levels). Your event blocks give them meaning.
* **Costumes:** a sprite with several costumes either animates while it moves (walkers) or all the time (coins,
  flags). Characters mirror their costume to face the way they move; top-down planes rotate instead.
* **Sounds:** the game plays some sounds by itself (jump, falling out, running out of health, winning, game over).
  The "set sound for … to …" block changes or silences them. Sounds can be previewed on the Sprites tab and by
  choosing them in a sound dropdown.
* **Health:** losing health makes the player flash and ignore damage for a moment. At 0 health the level
  restarts, unless you use a "when health reaches 0" block. Falling out of the level costs 1 health and puts
  the player back at the start.

### Saving

Projects are saved in `localStorage` under keys prefixed with `spriteblocks:project:`. The current project is
also autosaved. **Export** writes a `.spriteblocks.json` file containing both workspaces, every level, and
metadata for the assets used (no image data). **Import** loads one of these files.

## Credits

Sprites and sound effects are by [Kenney](https://www.kenney.nl), released as CC0 (see
`public/assets/KENNEY-LICENSE.txt`). Packs used: Pixel Platformer, Pixel Platformer Blocks, Tiny Dungeon,
Pixel Shmup, Digital Audio, Interface Sounds, Impact Sounds, and Music Jingles.
