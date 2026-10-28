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
  const turn = cls === 'player' || cls === 'hazard' ? 'flip' : 'none';
  return { id, name, kind: 'sprite', cls, turn, animate: 'always', frames, ...extra };
}

function scenic(id: string, name: string, sky: string, strip: string[], ground: string, color: string): BackgroundAsset {
  return { id, name, kind: 'background', type: 'scenic', sky, strip, ground, color };
}

function tiled(id: string, name: string, tile: string, color: string): BackgroundAsset {
  return { id, name, kind: 'background', type: 'tile', tile, color };
}

const anim = (base: string, n: number) => Array.from({ length: n }, (_, i) => `${base}_${i + 1}`);
/** Side-view walker: animates only while moving, mirrored to face its direction of travel. */
const walker = (facing: 'left' | 'right'): Partial<SpriteAsset> => ({ animate: 'move', facing });

export const ASSETS: Asset[] = [
  // Players
  sprite('alien_green', 'green alien', 'player', anim('alien_green', 2), walker('left')),
  sprite('alien_blue', 'blue alien', 'player', anim('alien_blue', 2), walker('left')),
  sprite('alien_pink', 'pink alien', 'player', anim('alien_pink', 2), walker('left')),
  sprite('alien_yellow', 'yellow alien', 'player', anim('alien_yellow', 2), walker('left')),
  sprite('alien_beige', 'beige alien', 'player', anim('alien_beige', 2), walker('left')),
  sprite('hero', 'hero', 'player', ['hero'], { facing: 'right' }),
  sprite('knight', 'knight', 'player', ['knight'], { facing: 'right' }),
  sprite('wizard', 'wizard', 'player', ['wizard'], { facing: 'right' }),
  sprite('princess', 'princess', 'player', ['princess'], { facing: 'right' }),
  sprite('plane_blue', 'blue plane', 'player', ['plane_blue'], { turn: 'rotate', facing: 'up' }),
  sprite('plane_red', 'red plane', 'player', ['plane_red'], { turn: 'rotate', facing: 'up' }),

  // Platforms (solid ground you can stand on)
  sprite('brick', 'brick', 'platform', ['brick']),
  sprite('brick_small', 'small bricks', 'platform', ['brick_small']),
  sprite('brick_dark', 'dark bricks', 'platform', ['brick_dark']),
  sprite('stone_block', 'stone block', 'platform', ['stone_block']),
  sprite('grass', 'grass', 'platform', ['grass']),
  sprite('dirt', 'dirt', 'platform', ['dirt']),
  sprite('plank', 'plank (one-way)', 'platform', ['plank'], { oneWay: true }),

  // Obstacles (solid blocks)
  sprite('crate', 'crate', 'obstacle', ['crate']),
  sprite('block_yellow', 'yellow block', 'obstacle', ['block_yellow']),
  sprite('block_lock', 'locked block', 'obstacle', ['block_lock']),
  sprite('wall', 'brick wall', 'obstacle', ['wall']),
  sprite('wall_stone', 'stone wall', 'obstacle', ['wall_stone']),

  // Collectibles
  sprite('coin', 'coin', 'collectible', anim('coin', 2)),
  sprite('gem', 'gem', 'collectible', ['gem']),
  sprite('heart', 'heart', 'collectible', ['heart']),
  sprite('key', 'key', 'collectible', ['key']),
  sprite('medal', 'medal', 'collectible', anim('medal', 2)),
  sprite('potion', 'potion', 'collectible', ['potion']),
  sprite('chest', 'chest', 'collectible', ['chest']),

  // Hazards
  sprite('jelly', 'jelly', 'hazard', anim('jelly', 2), walker('right')),
  sprite('drill', 'drill bot', 'hazard', anim('drill', 2), walker('right')),
  sprite('robot', 'robot', 'hazard', anim('robot', 2), walker('right')),
  sprite('bat', 'bat', 'hazard', anim('bat', 3)),
  sprite('spikeball', 'spike ball', 'hazard', ['spikeball'], { turn: 'none' }),
  sprite('block_angry', 'angry block', 'hazard', anim('block_angry', 2), { turn: 'none' }),
  sprite('spikes', 'spikes', 'hazard', ['spikes'], { turn: 'none' }),
  sprite('water', 'water', 'hazard', ['water'], { turn: 'none' }),
  sprite('ghost', 'ghost', 'hazard', ['ghost'], { facing: 'left' }),
  sprite('crab', 'crab', 'hazard', ['crab']),
  sprite('cyclops', 'cyclops', 'hazard', ['cyclops'], { facing: 'right' }),
  sprite('bat_dungeon', 'cave bat', 'hazard', ['bat_dungeon']),
  sprite('trap', 'floor trap', 'hazard', ['trap'], { turn: 'none' }),
  sprite('plane_grey', 'grey plane', 'hazard', ['plane_grey'], { turn: 'rotate', facing: 'down' }),

  // Scenery
  sprite('door_closed', 'closed door', 'scenery', ['door_closed']),
  sprite('door_wood', 'wooden door', 'scenery', ['door_wood']),
  sprite('tree', 'tree', 'scenery', ['tree']),
  sprite('plant', 'plant', 'scenery', ['plant']),
  sprite('sprout', 'sprout', 'scenery', ['sprout']),
  sprite('cactus', 'cactus', 'scenery', ['cactus']),
  sprite('mushroom', 'mushroom', 'scenery', ['mushroom']),
  sprite('snowman', 'snowman', 'scenery', ['snowman']),
  sprite('sign', 'sign', 'scenery', ['sign']),
  sprite('sign_arrow', 'arrow sign', 'scenery', ['sign_arrow']),
  sprite('ladder', 'ladder', 'scenery', ['ladder']),
  sprite('spring', 'spring', 'scenery', ['spring']),

  // Goals
  sprite('door_open', 'open door', 'goal', ['door_open']),
  sprite('flag', 'flag', 'goal', anim('flag', 2)),

  // Backgrounds
  scenic('bg_sky', 'sky', 'bg_0000', ['bg_0008', 'bg_0009'], 'bg_0016', '#dcf3f1'),
  scenic('bg_desert', 'desert', 'bg_0004', ['bg_0012', 'bg_0013'], 'bg_0020', '#f7c87e'),
  scenic('bg_forest', 'forest', 'bg_0006', ['bg_0014', 'bg_0015'], 'bg_0022', '#88e8a6'),
  tiled('bg_floor_stone', 'stone floor', 'floor_stone', '#9aa3b5'),
  tiled('bg_floor_sand', 'sand floor', 'floor_sand', '#e6b26a'),
  tiled('bg_floor_dirt', 'dirt floor', 'floor_dirt', '#6b3a2e'),
];

export const SOUNDS: { id: string; name: string }[] = [
  { id: 'coin', name: 'coin' },
  { id: 'jump', name: 'jump' },
  { id: 'hurt', name: 'hurt' },
  { id: 'stomp', name: 'stomp' },
  { id: 'powerup', name: 'power up' },
  { id: 'door', name: 'door' },
  { id: 'win', name: 'win jingle' },
  { id: 'lose', name: 'lose jingle' },
  { id: 'level', name: 'level jingle' },
  { id: 'laser', name: 'laser' },
  { id: 'zap', name: 'zap' },
  { id: 'pop', name: 'pop' },
  { id: 'chime', name: 'chime' },
  { id: 'bell', name: 'bell' },
  { id: 'click', name: 'click' },
  { id: 'confirm', name: 'confirm' },
  { id: 'error', name: 'error' },
  { id: 'step', name: 'step' },
];

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
