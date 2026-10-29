# Sprite Blocks

A block-based game maker for grid-based platformers and top-down games. It is built on the latest
[Blockly](https://github.com/RaspberryPiFoundation/blockly) and [p5.js](https://p5js.org/), with a small
grid-aware sprite engine.

## Background

A grid-based game designer is something I've wanted to build for close to a decade. It shares some ideas with
Code.org's [Sprite Lab](https://github.com/code-dot-org/code-dot-org), including a few grid-based game blocks I
worked on there, but it's imagined as a tool of its own. Levels are painted on a grid, sprites follow paths built
from grid moves, and rules are written as event blocks.

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
  **Tour** button in the header replays it. A blank game starts with no sprites or sounds. **New** also offers two
  examples: Coin Run (platformer) and Garden Gem Hunt (top-down).
* **Sprites and sounds** are added from the built-in library on the Sprites tab. The tabs follow the usual order of
  making a game: Sprites, Levels, Rules, Paths.
* **Levels** are edited in a DOM grid (Levels tab). Each level has a background: a sky (scenery that scrolls more
  slowly than the level, some tinted for sunset or night), a floor (one tile repeated across the level) or a
  plain colour. It also has a size, a camera size and a starred player. When a game runs, each level becomes hidden setup code
  (`$g.setupLevel(...)` and one `$g.spawn(...)` per sprite). The `{ }` button shows this code next to the code
  generated from your blocks. Anything outside the level is drawn dark.
* **Rules** (main workspace) blocks are standard Blockly JSON definitions. Event blocks register handlers, and every
  action finishes within one frame. Blocks that are not inside an event are disabled. Locations are blocks too:
  a grid location (the default shadow), the location of a sprite, or a number of spaces from a sprite.
* **Paths** live on their own tab with a flyout toolbox. Each path definition compiles to a JavaScript generator
  function that the engine steps once per frame. `move left 3 spaces` moves one grid space at a time. It stops early
  at obstacles and, if the path says "stay on", at platform edges. `move forward` follows the way the sprite faces.
  `throw` creates a sprite in front of the thrower with a path of its own (projectiles); `disappear` removes the
  sprite. "set path" blocks start a path without blocking the code that called them.
* **Sprite classes** set the default behaviour:
  * character: falls in platformer levels (unless it flies) and turns to face its movement. The character starred
    in a level is the player: keyboard control, followed by the camera, has health. "make … the player" switches
    it at runtime. Class selectors such as "character" never include the player; use "the player" for that.
  * platform: one-way ground that can be jumped through from below.
  * obstacle: solid on every side. Standing on or pushing against a solid sprite counts as touching it.
  * item: no built-in behaviour. Each item is drawn either behind platforms (trees, doors) or in front of them.
* **Costumes:** a sprite with several costumes either animates while it moves (walkers) or all the time (coins,
  flags). Characters mirror their costume to face the way they move; planes and thrown daggers rotate instead.
* **Joining textures:** ground blocks, ledges, cakes, walls and fences join up with neighbouring sprites of the
  same kind. Water, ladders, candy canes and vines join in columns: a top piece over a repeated piece, for deep
  water and tall ladders. Their costumes are the pieces (ends, edges and corners), and the level editor and the game pick the
  piece for each space from its neighbours, so painting a row or a block draws one connected shape. Each
  piece's file name lists the sides that have an edge (for example `grass_block-TL` is a top-left corner).
  Where two sides join but the diagonal between them is empty, blocks get an inner corner: the art's own piece
  for grass, sand and snow, otherwise a small step drawn in the texture's outline colour. Some pieces are made
  from the art: the fence top middle and the closed mushroom top from halves of their end pieces, the pink cake
  block's plain middle row from its bottom row, the stone wall's top and bottom edges from its own outline, the
  sandstone and marble one-high and one-wide pieces from halves of their panel pieces, and the cloud and plank
  singles from halves of their ends, and the fence's T-junctions, cross and lone post from its own corner, rail
  and post pieces. Every row texture has a single, left end, middle and right end; every column texture has a
  top and a piece below it; every block texture (including the fence) has all 16 pieces.
* **Sounds:** only sounds added to the project appear in sound blocks, and blocks using a removed sound show a
  warning. The game plays some sounds by itself (jump, falling out, running out of health, winning, game over);
  the "set sound for … to …" block changes or silences them.
* **Warnings:** blocks warn about locations outside the level, missing sounds, sprites and paths, and
  platformer-only blocks (bounce, gravity, jumping) in games where every level is top-down.
* **Health:** losing health makes the player flash and ignore damage for a moment. At 0 health the level
  restarts, unless you use a "when health reaches 0" block. Falling out of the level costs 1 health and puts
  the player back at the start.

### Saving

Projects are saved in `localStorage` under keys prefixed with `spriteblocks:project:`. The current project is
also autosaved. **Export** writes a `.spriteblocks.json` file containing both workspaces, every level, and
metadata for the assets used (no image data). **Import** loads one of these files.

## Credits

Sprites and sound effects are by [Kenney](https://www.kenney.nl), released as CC0 (see
`public/assets/KENNEY-LICENSE.txt`). Packs used: Pixel Platformer, Pixel Platformer Blocks, Pixel Platformer Food
Expansion, Pixel Platformer Farm Expansion, Tiny Dungeon, Tiny Town, Tiny Farm, Pixel Shmup, Digital Audio,
Interface Sounds, Impact Sounds, and Music Jingles.
