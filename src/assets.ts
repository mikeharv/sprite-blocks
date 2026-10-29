// Built-in asset library. Artwork and sounds are CC0 assets by Kenney (www.kenney.nl).
import type { Asset, BackgroundAsset, SpriteAsset, SpriteClass } from './model';

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

  // Platforms: stand on top, jump up through from below.
  sprite('grass_ledge', 'grassy ledge', 'platform', ['grass_ledge']),
  sprite('mushroom_top', 'mushroom top', 'platform', ['mushroom_top']),
  sprite('cloud', 'cloud', 'platform', ['cloud']),
  sprite('plank', 'wooden plank', 'platform', ['plank']),
  sprite('fence_wood', 'fence top', 'platform', ['fence_wood']),
  sprite('cake_pink', 'pink cake', 'platform', ['cake_pink']),
  sprite('cake_choc', 'chocolate cake', 'platform', ['cake_choc']),

  // Obstacles: solid on every side.
  // Ground
  sprite('grass', 'grass block', 'obstacle', ['grass']),
  sprite('dirt', 'dirt', 'obstacle', ['dirt']),
  sprite('rock', 'rock', 'obstacle', ['rock']),
  // Bricks and walls
  sprite('brick', 'brick', 'obstacle', ['brick']),
  sprite('brick_small', 'small bricks', 'obstacle', ['brick_small']),
  sprite('brick_dark', 'dark bricks', 'obstacle', ['brick_dark']),
  sprite('stone_block', 'stone block', 'obstacle', ['stone_block']),
  sprite('wall', 'brick wall', 'obstacle', ['wall']),
  sprite('wall_stone', 'stone wall', 'obstacle', ['wall_stone']),
  // Blocks
  sprite('block_yellow', 'yellow block', 'obstacle', ['block_yellow']),
  sprite('block_lock', 'locked block', 'obstacle', ['block_lock']),
  sprite('cake_block', 'cake block', 'obstacle', ['cake_block']),
  // Containers
  sprite('crate', 'crate', 'obstacle', ['crate']),
  sprite('barrel', 'barrel', 'obstacle', ['barrel']),
  sprite('chest', 'chest', 'obstacle', ['chest']),
  sprite('chest_open', 'open chest', 'obstacle', ['chest_open']),
  // Garden
  sprite('hedge', 'hedge', 'obstacle', ['hedge']),
  sprite('fence', 'fence', 'obstacle', ['fence']),

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
  sprite('candy_cane', 'candy cane', 'item', ['candy_cane']),
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
  sprite('water', 'water', 'item', ['water']),
  sprite('trap', 'floor trap', 'item', ['trap']),
  sprite('spring', 'spring', 'item', ['spring']),
  // Doors and goals
  sprite('door_closed', 'closed door', 'item', ['door_closed'], back),
  sprite('door_open', 'open door', 'item', ['door_open'], back),
  sprite('door_wood', 'wooden door', 'item', ['door_wood'], back),
  sprite('flag', 'flag', 'item', anim('flag', 2), back),
  // Plants
  sprite('tree', 'tree', 'item', ['tree'], back),
  sprite('tree_round', 'round tree', 'item', ['tree_round'], back),
  sprite('cactus', 'cactus', 'item', ['cactus'], back),
  sprite('plant', 'plant', 'item', ['plant'], back),
  sprite('sprout', 'sprout', 'item', ['sprout'], back),
  sprite('mushroom', 'mushroom', 'item', ['mushroom'], back),
  sprite('toadstools', 'toadstools', 'item', ['toadstools'], back),
  // Decorations
  sprite('sign', 'sign', 'item', ['sign'], back),
  sprite('sign_arrow', 'arrow sign', 'item', ['sign_arrow'], back),
  sprite('ladder', 'ladder', 'item', ['ladder'], back),
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
