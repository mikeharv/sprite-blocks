// Project data model shared by the editors, storage and the runtime.

/**
 * - character: moves around; one character per level is starred as the player.
 * - platform: one-way ground that can be jumped through from below.
 * - obstacle: solid on every side.
 * - item: everything else (coins, doors, trees…). Your rules give items meaning.
 */
export type SpriteClass = 'character' | 'platform' | 'obstacle' | 'item';

export const SPRITE_CLASSES: { id: SpriteClass; label: string; plural: string }[] = [
  { id: 'character', label: 'character', plural: 'characters' },
  { id: 'platform', label: 'platform', plural: 'platforms' },
  { id: 'obstacle', label: 'obstacle', plural: 'obstacles' },
  { id: 'item', label: 'item', plural: 'items' },
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
  /** Overrides the class default (characters fall in platformer levels, other sprites float). */
  gravity?: boolean;
  /** Items only: drawn behind platforms ('back', e.g. trees and doors) or in front of them (default). */
  layer?: 'back' | 'front';
  /**
   * A texture that joins up with neighbouring sprites of the same kind. Each costume is one piece, and
   * `edges[i]` lists the sides (T, R, B, L) that costume `i` draws an edge on. 'row' textures join left and
   * right only, 'column' textures up and down only, and 'grid' textures in all four directions.
   */
  join?: {
    connect: 'row' | 'column' | 'grid';
    edges: string[];
    /**
     * Grid textures: a space whose two neighbours around a corner match but whose diagonal neighbour does not
     * gets an inner corner. Pieces drawn with one (index into `frames`) are used where the art has them;
     * otherwise a small step in the `outline` colour is drawn, sized for art `pixels` wide.
     */
    inner?: Partial<Record<Corner, number>>;
    outline?: string;
    pixels?: number;
  };
}

export type Corner = 'TL' | 'TR' | 'BR' | 'BL';

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
  /** Colour multiplied over the images, so one set of art can make a sunset or a night sky. */
  tint?: string;
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
  /** Background asset id, or null for a plain `color`. */
  background: string | null;
  color?: string;
  /** Character asset that the keyboard controls in this level. */
  player?: string | null;
  /** Sparse map of "x,y" -> sprite asset id. Origin is the top-left cell. */
  cells: Record<string, string>;
}

export interface Project {
  format: 'sprite-blocks';
  version: 1;
  name: string;
  /** Sprite asset ids added to this project from the library. */
  assets: string[];
  /** Sound ids added to this project. */
  sounds: string[];
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
    cols: 16,
    rows: 9,
    mode,
    view: 9,
    background: mode === 'platformer' ? 'bg_sky' : 'bg_floor_grass',
    player: null,
    cells: {},
  };
}

/** Curated colours for plain backgrounds. */
export const BACKGROUND_COLORS = [
  '#9fd8f0', '#cfe8ff', '#ffe3ef', '#f3dcff', '#fff3c4', '#d8f5d0', '#ffd8b8', '#2e3350', '#1b1f2b',
];

export function viewCols(view: ViewSize): number {
  return (view * 16) / 9;
}
