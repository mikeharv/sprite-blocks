// Built-in asset library. Artwork and sounds are CC0 assets by Kenney (www.kenney.nl).
import type { Asset, BackgroundAsset, Corner, SpriteAsset, SpriteClass } from './model';

const BASE = import.meta.env.BASE_URL + 'assets/';

export function imageUrl(name: string): string {
  return BASE + 'img/' + name + '.png';
}

export function soundUrl(name: string): string {
  return BASE + 'sfx/' + name + '.m4a';
}

function sprite(
  id: string,
  name: string,
  cls: SpriteClass,
  frames: string[],
  extra: Partial<SpriteAsset> = {},
): SpriteAsset {
  // Characters turn to face their movement; everything else is drawn as-is.
  const turn = cls === 'character' ? 'flip' : 'none';
  return { id, name, kind: 'sprite', cls, turn, animate: 'always', frames, ...extra };
}

function scenic(
  id: string,
  name: string,
  sky: string,
  strip: string[],
  ground: string,
  color: string,
  tint?: string,
): BackgroundAsset {
  return { id, name, kind: 'background', type: 'scenic', sky, strip, ground, color, tint };
}

function tiled(id: string, name: string, tile: string, color: string): BackgroundAsset {
  return { id, name, kind: 'background', type: 'tile', tile, color };
}

const anim = (base: string, n: number) => Array.from({ length: n }, (_, i) => `${base}_${i + 1}`);
/** Side-view walker: animates only while moving, mirrored to face its direction of travel. */
const walker = (facing: 'left' | 'right'): Partial<SpriteAsset> => ({ animate: 'move', facing });
/** Flies or stays put instead of falling in platformer levels. */
const floats: Partial<SpriteAsset> = { gravity: false };
/** Drawn behind platforms and characters. */
const back: Partial<SpriteAsset> = { layer: 'back' };

// Pieces of joinable textures, named by the sides that have an edge. Image files are `<texture>-<piece>`.
/** Single, left end, middle, right end. */
const ROW = ['TRBL', 'TBL', 'TB', 'TRB'];
/** A top piece and the piece repeated below it (deep water, ladder rungs, a stalk). */
const COLUMN = ['T', ''];
/** Rows of a 4×4 sheet: a one-high row, then the top, middle and bottom rows of a taller block. */
const GRID = ['TRBL', 'TBL', 'TB', 'TRB', 'TRL', 'TL', 'T', 'TR', 'RL', 'L', '', 'R', 'RBL', 'BL', 'B', 'RB'];

const CORNERS: Corner[] = ['TL', 'TR', 'BR', 'BL'];

/**
 * A sprite whose costume is chosen from its neighbours, so painted rows and blocks join up. Grid textures
 * name their outline colour for drawn inner corners, and can include inner-corner pieces from the art.
 */
function joined(
  id: string,
  name: string,
  cls: SpriteClass,
  texture: string,
  connect: 'row' | 'column' | 'grid',
  pieces: string[],
  corners: { outline?: string; artCorners?: boolean; pixels?: number } & Partial<SpriteAsset> = {},
): SpriteAsset {
  const frames = pieces.map((p) => `${texture}-${p || 'none'}`);
  const inner: Partial<Record<Corner, number>> = {};
  if (corners.artCorners) {
    for (const c of CORNERS) inner[c] = frames.push(`${texture}-inner-${c}`) - 1;
  }
  const { outline, artCorners: _art, pixels, ...extra } = corners;
  return sprite(id, name, cls, frames, {
    ...extra,
    join: { connect, edges: pieces, inner, outline, pixels: pixels ?? 18 },
  });
}

/** Outline colour of the Pixel Platformer packs, and those textures' dirt inner-corner pieces. */
const PIXEL_OUTLINE = { outline: '#434a5f' };
const DIRT_CORNERS = { ...PIXEL_OUTLINE, artCorners: true };

export const ASSETS: Asset[] = [
  // Characters. Star one in the level editor to make it the player.
  // People
  sprite('princess', 'princess', 'character', ['princess'], { facing: 'right' }),
  sprite('adventurer', 'adventurer', 'character', ['adventurer'], { facing: 'right' }),
  sprite('farmer_girl', 'farm girl', 'character', ['farmer_girl'], { facing: 'right' }),
  sprite('farmer', 'farmer', 'character', ['farmer'], { facing: 'right' }),
  sprite('hero', 'hero', 'character', ['hero'], { facing: 'right' }),
  sprite('knight', 'knight', 'character', ['knight'], { facing: 'right' }),
  sprite('wizard', 'wizard', 'character', ['wizard'], { facing: 'right' }),
  // Aliens
  sprite('alien_green', 'green alien', 'character', anim('alien_green', 2), walker('left')),
  sprite('alien_blue', 'blue alien', 'character', anim('alien_blue', 2), walker('left')),
  sprite('alien_pink', 'pink alien', 'character', anim('alien_pink', 2), walker('left')),
  sprite('alien_yellow', 'yellow alien', 'character', anim('alien_yellow', 2), walker('left')),
  sprite('alien_beige', 'beige alien', 'character', anim('alien_beige', 2), walker('left')),
  // Animals
  sprite('sheep', 'sheep', 'character', ['sheep'], { facing: 'right' }),
  sprite('cow', 'cow', 'character', ['cow'], { facing: 'right' }),
  sprite('chicken', 'chicken', 'character', ['chicken'], { facing: 'right' }),
  sprite('crab', 'crab', 'character', ['crab']),
  sprite('spider', 'spider', 'character', ['spider'], { turn: 'none' }),
  sprite('bat', 'bat', 'character', anim('bat', 3), floats),
  sprite('bat_dungeon', 'cave bat', 'character', ['bat_dungeon'], floats),
  // Monsters
  sprite('jelly', 'jelly', 'character', anim('jelly', 2), walker('right')),
  sprite('ghost', 'ghost', 'character', ['ghost'], { facing: 'left', ...floats }),
  sprite('cyclops', 'cyclops', 'character', ['cyclops'], { facing: 'right' }),
  sprite('block_angry', 'angry block', 'character', anim('block_angry', 2), { turn: 'none' }),
  sprite('spikeball', 'spike ball', 'character', ['spikeball'], { turn: 'none', ...floats }),
  // Machines
  sprite('robot', 'robot', 'character', anim('robot', 2), walker('right')),
  sprite('drill', 'drill bot', 'character', anim('drill', 2), walker('right')),
  sprite('plane_blue', 'blue plane', 'character', ['plane_blue'], { turn: 'rotate', facing: 'up', ...floats }),
  sprite('plane_red', 'red plane', 'character', ['plane_red'], { turn: 'rotate', facing: 'up', ...floats }),
  sprite('plane_grey', 'grey plane', 'character', ['plane_grey'], { turn: 'rotate', facing: 'down', ...floats }),

  // Platforms: stand on top, jump up through from below. Most join up into longer ledges.
  joined('grass_ledge', 'grassy ledge', 'platform', 'grass_ledge', 'row', ROW),
  joined('sand_ledge', 'sandy ledge', 'platform', 'sand_ledge', 'row', ROW),
  joined('snow_ledge', 'snowy ledge', 'platform', 'snow_ledge', 'row', ROW),
  joined('mushroom_top', 'mushroom top', 'platform', 'mushroom_top', 'row', ROW),
  joined('cloud', 'cloud', 'platform', 'cloud', 'row', ROW),
  joined('plank', 'wooden plank', 'platform', 'plank', 'row', ROW),
  joined('fence_wood', 'fence top', 'platform', 'fence_wood', 'row', ROW),
  joined('cake_pink', 'pink cake', 'platform', 'cake_pink', 'row', ROW),
  joined('cake_choc', 'chocolate cake', 'platform', 'cake_choc', 'row', ROW),

  // Obstacles: solid on every side.
  // Joining textures: paint rows, columns or any shape and the pieces join up.
  joined('grass', 'grass block', 'obstacle', 'grass_block', 'grid', GRID, DIRT_CORNERS),
  joined('sand_block', 'sand block', 'obstacle', 'sand_block', 'grid', GRID, DIRT_CORNERS),
  joined('snow_block', 'snow block', 'obstacle', 'snow_block', 'grid', GRID, DIRT_CORNERS),
  joined('farm_block', 'farm ground', 'obstacle', 'farm_block', 'grid', GRID, PIXEL_OUTLINE),
  joined('wall_stone', 'stone wall', 'obstacle', 'wall_stone', 'grid', GRID, { outline: '#3f2631', pixels: 16 }),
  joined('sandstone', 'sandstone block', 'obstacle', 'sandstone', 'grid', GRID, { outline: '#6f3e43' }),
  joined('marble', 'marble block', 'obstacle', 'marble', 'grid', GRID, { outline: '#565656' }),
  joined('cake_block', 'pink cake block', 'obstacle', 'cake_block', 'grid', GRID, PIXEL_OUTLINE),
  joined('cake_choc_block', 'chocolate cake block', 'obstacle', 'cake_choc_block', 'grid', GRID, PIXEL_OUTLINE),
  joined('fence', 'fence', 'obstacle', 'fence', 'grid', GRID, { pixels: 16 }),
  // Single blocks
  sprite('stone_block', 'stone block', 'obstacle', ['stone_block']),
  sprite('brick', 'brick', 'obstacle', ['brick']),
  sprite('brick_small', 'small bricks', 'obstacle', ['brick_small']),
  sprite('brick_dark', 'dark bricks', 'obstacle', ['brick_dark']),
  sprite('block_yellow', 'yellow block', 'obstacle', ['block_yellow']),
  sprite('block_lock', 'locked block', 'obstacle', ['block_lock']),
  // Containers
  sprite('crate', 'crate', 'obstacle', ['crate']),
  sprite('barrel', 'barrel', 'obstacle', ['barrel']),
  sprite('chest', 'chest', 'obstacle', ['chest']),
  sprite('chest_open', 'open chest', 'obstacle', ['chest_open']),
  // Outdoors
  sprite('hedge', 'hedge', 'obstacle', ['hedge']),
  sprite('rock', 'rock', 'obstacle', ['rock']),

  // Items: things to collect, throw, avoid, reach or decorate with.
  // Treasure
  sprite('coin', 'coin', 'item', anim('coin', 2)),
  sprite('gem', 'gem', 'item', ['gem']),
  sprite('medal', 'medal', 'item', anim('medal', 2)),
  sprite('heart', 'heart', 'item', ['heart']),
  sprite('key', 'key', 'item', ['key']),
  sprite('potion', 'red potion', 'item', ['potion']),
  sprite('potion_blue', 'blue potion', 'item', ['potion_blue']),
  // Food
  sprite('donut', 'donut', 'item', ['donut']),
  sprite('ice_cream', 'ice cream', 'item', ['ice_cream']),
  joined('candy_cane', 'candy cane', 'item', 'candy_cane', 'column', COLUMN),
  sprite('pizza', 'pizza', 'item', ['pizza']),
  sprite('tomato', 'tomato', 'item', ['tomato']),
  sprite('carrot', 'carrot', 'item', ['carrot']),
  sprite('pumpkin', 'pumpkin', 'item', ['pumpkin']),
  // Flowers
  sprite('sunflower', 'sunflower', 'item', ['sunflower']),
  sprite('flowers_red', 'red flowers', 'item', ['flowers_red']),
  sprite('flowers_yellow', 'yellow flowers', 'item', ['flowers_yellow']),
  // Things to throw
  sprite('sparkle', 'magic sparkle', 'item', anim('sparkle', 3)),
  sprite('laser', 'laser', 'item', ['laser'], { turn: 'rotate', facing: 'up' }),
  sprite('dagger', 'dagger', 'item', ['dagger'], { turn: 'rotate', facing: 'up' }),
  // Traps
  sprite('spikes', 'spikes', 'item', ['spikes']),
  joined('water', 'water', 'item', 'water', 'column', COLUMN),
  sprite('trap', 'floor trap', 'item', ['trap']),
  sprite('spring', 'spring', 'item', ['spring']),
  // Doors and goals
  sprite('door_closed', 'closed door', 'item', ['door_closed'], back),
  sprite('door_open', 'open door', 'item', ['door_open'], back),
  sprite('door_wood', 'wooden door', 'item', ['door_wood'], back),
  sprite('flag', 'flag', 'item', anim('flag', 2), back),
  // Plants
  sprite('tree', 'tree', 'item', ['tree'], back),
  sprite('tree_round', 'small tree', 'item', ['tree_round'], back),
  sprite('cactus', 'cactus', 'item', ['cactus'], back),
  joined('plant', 'vine', 'item', 'plant', 'column', COLUMN, back),
  sprite('sprout', 'sprout', 'item', ['sprout'], back),
  sprite('mushroom', 'mushroom', 'item', ['mushroom'], back),
  sprite('toadstools', 'toadstools', 'item', ['toadstools'], back),
  // Decorations
  sprite('sign', 'sign', 'item', ['sign'], back),
  sprite('sign_arrow', 'arrow sign', 'item', ['sign_arrow'], back),
  joined('ladder', 'ladder', 'item', 'ladder', 'column', COLUMN, back),
  sprite('beehive', 'beehive', 'item', ['beehive'], back),
  sprite('snowman', 'snowman', 'item', ['snowman'], back),

  // Scenic skies: a sky, a horizon strip that scrolls slower than the level, and ground below.
  scenic('bg_sky', 'sky with trees', 'bg_0000', ['bg_0008', 'bg_0009'], 'bg_0016', '#dcf3f1'),
  scenic('bg_clouds', 'cloudy sky', 'bg_0000', ['bg_0008', 'bg_0010'], 'bg_0016', '#dcf3f1'),
  scenic('bg_pines', 'pine hills', 'bg_0000', ['bg_0010', 'bg_0011'], 'bg_0016', '#dcf3f1'),
  scenic('bg_forest', 'forest', 'bg_0006', ['bg_0014', 'bg_0015'], 'bg_0022', '#88e8a6'),
  scenic('bg_desert', 'desert', 'bg_0004', ['bg_0012', 'bg_0013'], 'bg_0020', '#f7c87e'),
  scenic('bg_sunset', 'sunset', 'bg_0000', ['bg_0008', 'bg_0009'], 'bg_0016', '#f6b9a0', '#ffb08a'),
  scenic('bg_night', 'night', 'bg_0000', ['bg_0010', 'bg_0011'], 'bg_0016', '#3b4378', '#4a55a0'),
  // Floors: one tile repeated across the whole level.
  tiled('bg_floor_grass', 'grass', 'floor_grass', '#8fd16a'),
  tiled('bg_floor_meadow', 'flower meadow', 'floor_meadow', '#8fd16a'),
  tiled('bg_floor_dirt', 'dirt', 'floor_dirt', '#6b3a2e'),
  tiled('bg_floor_sand', 'sand', 'floor_sand', '#e6b26a'),
  tiled('bg_floor_gravel', 'gravel', 'floor_gravel', '#9aa3b5'),
  tiled('bg_floor_stone', 'stone floor', 'floor_stone', '#9aa3b5'),
  tiled('bg_floor_tiles', 'sand tiles', 'floor_tiles', '#e6b26a'),
  tiled('bg_floor_marble', 'marble tiles', 'floor_marble', '#d9dde6'),
];

export interface SoundInfo {
  id: string;
  name: string;
  /** 'tune' for short melodies, 'effect' for everything else. */
  kind: 'effect' | 'tune';
}

const effect = (id: string, name = id): SoundInfo => ({ id, name, kind: 'effect' });
const tune = (id: string, name: string): SoundInfo => ({ id, name, kind: 'tune' });

export const SOUNDS: SoundInfo[] = [
  effect('coin'),
  effect('jump'),
  effect('hurt'),
  effect('stomp'),
  effect('powerup', 'power up'),
  effect('door'),
  effect('laser'),
  effect('zap'),
  effect('pop'),
  effect('chime'),
  effect('bell'),
  effect('click'),
  effect('confirm'),
  effect('error'),
  effect('step'),
  tune('win', 'win jingle'),
  tune('lose', 'lose jingle'),
  tune('level', 'level jingle'),
];

export function getSound(id: string | null | undefined): SoundInfo | undefined {
  return SOUNDS.find((s) => s.id === id);
}

const byId = new Map(ASSETS.map((a) => [a.id, a]));

export function getAsset(id: string | null | undefined): Asset | undefined {
  return id ? byId.get(id) : undefined;
}

export function getSprite(id: string | null | undefined): SpriteAsset | undefined {
  const a = getAsset(id);
  return a && a.kind === 'sprite' ? a : undefined;
}

export function getBackground(id: string | null | undefined): BackgroundAsset | undefined {
  const a = getAsset(id);
  return a && a.kind === 'background' ? a : undefined;
}

export const BACKGROUNDS = ASSETS.filter((a): a is BackgroundAsset => a.kind === 'background');

/** The piece a joinable sprite wears, and any inner corners to draw over it. */
export interface JoinPiece {
  frame: number;
  corners: Corner[];
}

const DIAGONALS: Record<Corner, [number, number]> = { TL: [-1, -1], TR: [1, -1], BR: [1, 1], BL: [-1, 1] };

/**
 * Chooses the piece a joinable sprite should wear, given whether the neighbouring space at (dx, dy) holds
 * the same texture. Prefers a piece with an extra edge over one with a missing edge, so a shape the art does
 * not cover still looks closed. Grid textures also get inner corners where two sides join but the diagonal
 * between them is empty.
 */
export function joinPiece(asset: SpriteAsset, same: (dx: number, dy: number) => boolean): JoinPiece {
  const join = asset.join;
  if (!join) return { frame: 0, corners: [] };
  const grid = join.connect === 'grid';
  const vertical = join.connect !== 'row';
  const horizontal = join.connect !== 'column';
  const wantEdge: Record<string, boolean> = {
    T: !(vertical && same(0, -1)),
    R: !(horizontal && same(1, 0)),
    B: !(vertical && same(0, 1)),
    L: !(horizontal && same(-1, 0)),
  };
  // Only the sides a texture joins on decide its piece.
  const sides = grid ? 'TRBL' : vertical ? 'TB' : 'RL';
  let frame = 0;
  let bestCost = Infinity;
  join.edges.forEach((edges, i) => {
    let cost = 0;
    for (const side of sides) {
      const has = edges.includes(side);
      if (wantEdge[side] && !has) cost += 3;
      else if (!wantEdge[side] && has) cost += 2;
    }
    if (cost < bestCost) {
      frame = i;
      bestCost = cost;
    }
  });
  if (!grid) return { frame, corners: [] };
  const corners = (Object.keys(DIAGONALS) as Corner[]).filter((c) => {
    const [dx, dy] = DIAGONALS[c];
    return same(dx, 0) && same(0, dy) && !same(dx, dy);
  });
  // The art's own inner-corner piece fits a middle piece with exactly one inner corner.
  const art = corners.length === 1 ? join.inner?.[corners[0]] : undefined;
  if (art !== undefined && join.edges[frame] === '') return { frame: art, corners: [] };
  return { frame, corners: join.outline ? corners : [] };
}

/** Index of the costume a joinable sprite should wear (see joinPiece). */
export function joinFrame(asset: SpriteAsset, same: (dx: number, dy: number) => boolean): number {
  return joinPiece(asset, same).frame;
}

/**
 * Rectangles, in art pixels from the cell's top-left, that draw the given inner corners: the same small step
 * the art uses (a corner pixel and the pixel beside it in each direction).
 */
export function cornerRects(corners: Corner[], pixels: number): [number, number, number, number][] {
  const far = pixels - 2;
  const rects: [number, number, number, number][] = [];
  for (const c of corners) {
    const x = c === 'TL' || c === 'BL' ? 0 : far;
    const y = c === 'TL' || c === 'TR' ? 0 : far;
    const cx = c === 'TL' || c === 'BL' ? 0 : pixels - 1;
    const cy = c === 'TL' || c === 'TR' ? 0 : pixels - 1;
    rects.push([x, cy, 2, 1], [cx, y, 1, 2]);
  }
  return rects;
}

/** What a level cell shows: its image, and inner corners for joinable textures. */
export interface CellLook {
  image: string;
  corners: Corner[];
  outline?: string;
  pixels: number;
}

/** Image and inner corners for the sprite in a level cell. */
export function cellLook(cells: Record<string, string>, x: number, y: number): CellLook | undefined {
  const asset = getSprite(cells[x + ',' + y]);
  if (!asset) return undefined;
  const piece = joinPiece(asset, (dx, dy) => cells[x + dx + ',' + (y + dy)] === asset.id);
  return {
    image: asset.frames[piece.frame],
    corners: piece.corners,
    outline: asset.join?.outline,
    pixels: asset.join?.pixels ?? 18,
  };
}

/** CSS background layers that draw a cell look at `size` pixels: corner steps over the image. */
export function cellBackground(look: CellLook | undefined, size: number): string {
  if (!look) return '';
  const unit = size / look.pixels;
  const layers = cornerRects(look.corners, look.pixels).map(
    ([x, y, w, h]) =>
      `linear-gradient(${look.outline}, ${look.outline}) ${x * unit}px ${y * unit}px / ${w * unit}px ${h * unit}px no-repeat`,
  );
  return [...layers, `url(${imageUrl(look.image)}) center / contain no-repeat`].join(', ');
}

/** Image for the sprite in a level cell, choosing the joined piece for joinable textures. */
export function cellImage(cells: Record<string, string>, x: number, y: number): string | undefined {
  return cellLook(cells, x, y)?.image;
}

export function thumbUrl(asset: Asset): string {
  if (asset.kind === 'sprite') return imageUrl(asset.frames[0]);
  return imageUrl(asset.type === 'tile' ? asset.tile! : asset.strip![0]);
}

/** All image names referenced by the catalog, for preloading. */
export function allImageNames(): string[] {
  const names = new Set<string>();
  for (const a of ASSETS) {
    if (a.kind === 'sprite') a.frames.forEach((f) => names.add(f));
    else [a.sky, a.ground, a.tile, ...(a.strip ?? [])].forEach((f) => f && names.add(f));
  }
  return [...names];
}
