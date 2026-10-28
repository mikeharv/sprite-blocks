// Project data model shared by the editors, storage and the runtime.

export type SpriteClass =
  | 'player'
  | 'platform'
  | 'obstacle'
  | 'collectible'
  | 'hazard'
  | 'scenery'
  | 'goal';

export const SPRITE_CLASSES: { id: SpriteClass; label: string; plural: string }[] = [
  { id: 'player', label: 'player', plural: 'players' },
  { id: 'platform', label: 'platform', plural: 'platforms' },
  { id: 'obstacle', label: 'obstacle', plural: 'obstacles' },
  { id: 'collectible', label: 'collectible', plural: 'collectibles' },
  { id: 'hazard', label: 'hazard', plural: 'hazards' },
  { id: 'scenery', label: 'scenery', plural: 'scenery' },
  { id: 'goal', label: 'goal', plural: 'goals' },
];

/**
 * How a sprite turns to face the way it moves.
 * - flip: the costume is mirrored when moving the opposite way from the artwork's `facing`.
 * - rotate: top-down art rotated to point in the direction of travel.
 * - none: always drawn as-is.
 */
export type TurnStyle = 'flip' | 'rotate' | 'none';

/**
 * When a sprite with several costumes animates.
 * - move: first costume while standing, cycles while moving (second costume while in the air).
 * - always: cycles continuously (spinning coins, flapping bats, waving flags).
 */
export type AnimateStyle = 'move' | 'always';

export interface SpriteAsset {
  id: string;
  name: string;
  kind: 'sprite';
  cls: SpriteClass;
  turn: TurnStyle;
  animate: AnimateStyle;
  /** Image names under assets/img (without extension). First frame is the standing costume. */
  frames: string[];
  /** Direction the artwork faces. */
  facing?: 'up' | 'down' | 'left' | 'right';
  /** One-way platforms can be jumped through from below. */
  oneWay?: boolean;
}

export interface BackgroundAsset {
  id: string;
  name: string;
  kind: 'background';
  /** 'scenic': sky / horizon strip / ground tiles drawn with parallax. 'tile': one tile repeated in world space. */
  type: 'scenic' | 'tile';
  sky?: string;
  strip?: string[];
  ground?: string;
  tile?: string;
  color: string;
}

export type Asset = SpriteAsset | BackgroundAsset;

export type GameMode = 'platformer' | 'topdown';

/** Number of grid rows visible in the 16:9 camera. Columns are always rows * 16 / 9. */
export type ViewSize = 9 | 18;

export interface Level {
  id: string;
  name: string;
  cols: number;
  rows: number;
  mode: GameMode;
  view: ViewSize;
  background: string | null;
  /** Sparse map of "x,y" -> sprite asset id. Origin is the top-left cell. */
  cells: Record<string, string>;
}

export interface Project {
  format: 'sprite-blocks';
  version: 1;
  name: string;
  /** Asset ids added to this project from the library. */
  assets: string[];
  levels: Level[];
  /** Blockly JSON serialization of the main workspace. */
  main: object;
  /** Blockly JSON serialization of the paths workspace. */
  paths: object;
  /** Present in exported files only: metadata of the assets used (no image data). */
  assetMeta?: Asset[];
}

export function uid(prefix = 'id'): string {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

export function cellKey(x: number, y: number): string {
  return x + ',' + y;
}

export function parseCellKey(key: string): [number, number] {
  const [x, y] = key.split(',').map(Number);
  return [x, y];
}

export function newLevel(name: string, mode: GameMode = 'platformer'): Level {
  return {
    id: uid('level'),
    name,
    cols: 32,
    rows: 9,
    mode,
    view: 9,
    background: mode === 'platformer' ? 'bg_sky' : 'bg_floor_stone',
    cells: {},
  };
}

export function viewCols(view: ViewSize): number {
  return (view * 16) / 9;
}
