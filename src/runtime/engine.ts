// Game runtime: a p5.js sketch with a small grid-aware sprite engine.
//
// The engine owns sprites, physics, paths, events and rendering. Generated user code talks to it
// through the `GameApi` object (`$g` in generated code); generated path code uses `PathContext` (`$p`).
import p5 from 'p5';
import { allImageNames, cornerRects, getBackground, getSprite, imageUrl, joinPiece, type JoinPiece } from '../assets';
import type { GameMode, Level, SpriteAsset, ViewSize } from '../model';
import { viewCols } from '../model';
import { playSound } from './audio';

/** World units per grid cell. */
export const CELL = 32;
const CANVAS_W = 960;
const CANVAS_H = 540;
const GRAVITY = 0.55;
const MAX_FALL = 11;
const INVINCIBLE_FRAMES = 90;
const START_HEALTH = 3;
const LOOP_BUDGET = 200000;

export type Dir = 'left' | 'right' | 'up' | 'down';
const DIRS: Record<Dir, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
/** Colour of the area outside the level, visible when the level is smaller than the camera. */
const OUTSIDE_COLOR = '#3a4152';

/** A grid location. Location values in generated code may also be lists of locations. */
export interface Loc {
  x: number;
  y: number;
}
type LocRef = Loc | LocRef[] | null | undefined;

export interface PathDef {
  loop: boolean;
  ignoreGravity: boolean;
  edges: 'stop' | 'fall';
  fn: (p: PathContext) => Generator<unknown, void, unknown>;
}

export interface CompiledProgram {
  levels: Level[];
  /** Hidden setup code per level, generated from the level grid. */
  levelSetup: string[];
  /** User program generated from the main workspace. */
  main: string;
  /** Source of a function body returning a record of PathDefs. */
  paths: string;
}

type Box = { l: number; t: number; r: number; b: number };

function overlaps(a: Box, b: Box): boolean {
  return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
}

let nextSpriteId = 1;

export class Sprite {
  readonly id = nextSpriteId++;
  asset: SpriteAsset;
  x: number;
  y: number;
  w: number;
  h: number;
  vx = 0;
  vy = 0;
  prevX: number;
  prevY: number;
  /** Displacement requested by a path this frame. */
  ctrlX = 0;
  ctrlY = 0;
  gravity: boolean;
  /** Controlled by the keyboard and followed by the camera. */
  isPlayer = false;
  visible = true;
  removed = false;
  onGround = false;
  blockedX = false;
  blockedY = false;
  /** Last horizontal direction faced; decides mirroring even while moving up or down. */
  lookH: 'left' | 'right';
  private facingDir: Dir;
  path: PathRun | null = null;
  speed = 2;
  animTime = 0;
  invincible = 0;
  homeX: number;
  homeY: number;

  constructor(asset: SpriteAsset, col: number, row: number) {
    this.asset = asset;
    const solid = asset.cls === 'platform' || asset.cls === 'obstacle';
    this.w = solid ? CELL : CELL * 0.8;
    this.h = solid ? CELL : CELL * 0.9;
    this.x = col * CELL + CELL / 2;
    this.y = row * CELL + CELL - this.h / 2;
    this.prevX = this.x;
    this.prevY = this.y;
    this.homeX = this.x;
    this.homeY = this.y;
    this.gravity = asset.gravity ?? asset.cls === 'character';
    this.facingDir = asset.facing ?? (asset.turn === 'rotate' ? 'up' : 'right');
    this.lookH = asset.facing === 'left' ? 'left' : 'right';
  }

  get facing(): Dir {
    return this.facingDir;
  }

  set facing(dir: Dir) {
    this.facingDir = dir;
    if (dir === 'left' || dir === 'right') this.lookH = dir;
  }

  get cls(): SpriteAsset['cls'] {
    return this.asset.cls;
  }

  get solid(): boolean {
    return this.asset.cls === 'platform' || this.asset.cls === 'obstacle';
  }

  /** Platforms can be jumped through from below. */
  get oneWay(): boolean {
    return this.asset.cls === 'platform';
  }

  get col(): number {
    return Math.floor(this.x / CELL);
  }

  get row(): number {
    return Math.floor((this.y + this.h / 2 - 0.01) / CELL);
  }

  box(): Box {
    return { l: this.x - this.w / 2, t: this.y - this.h / 2, r: this.x + this.w / 2, b: this.y + this.h / 2 };
  }

  /** Smaller box used for overlap ("touch") checks between non-solid sprites. */
  touchBox(): Box {
    const b = this.box();
    const inset = CELL * 0.12;
    return { l: b.l + inset, t: b.t + inset, r: b.r - inset, b: b.b - inset };
  }

  /**
   * Sprites touch when their (slightly shrunken) boxes overlap. Solid sprites can never overlap anything,
   * so standing on or pushing against one counts as touching it.
   */
  touches(o: Sprite): boolean {
    if (!this.solid && !o.solid) return overlaps(this.touchBox(), o.touchBox());
    const a = this.box();
    const b = o.box();
    return overlaps({ l: a.l - 1, t: a.t - 1, r: a.r + 1, b: a.b + 1 }, b);
  }
}

/** Runs one path generator on one sprite. */
export class PathRun {
  gen: Generator<unknown, void, unknown> | null = null;
  readonly ctx: PathContext;

  constructor(
    readonly name: string,
    readonly def: PathDef,
    sprite: Sprite,
    game: Game,
  ) {
    this.ctx = new PathContext(sprite, game, this);
  }

  step(): void {
    for (let restarts = 0; restarts < 2; restarts++) {
      if (this.ctx.sprite.removed) return;
      if (!this.gen) this.gen = this.def.fn(this.ctx);
      this.ctx.budget = 5000;
      const r = this.gen.next();
      if (!r.done) return;
      this.gen = null;
      if (!this.def.loop) {
        this.ctx.sprite.path = null;
        return;
      }
      // Avoid spinning on an empty looping path: restart at most once per frame.
      if (restarts === 0 && this.ctx.frameMoves === 0) return;
    }
  }
}

/** API available to generated path code as `$p`. Generator methods are used with `yield*`. */
export class PathContext {
  budget = 5000;
  frameMoves = 0;

  constructor(
    readonly sprite: Sprite,
    private game: Game,
    private run: PathRun,
  ) {}

  private get gravityOn(): boolean {
    return this.game.gravityActive(this.sprite);
  }

  /** Loop trap: pause a frame if a path loop runs without moving. */
  trap(): boolean {
    if (--this.budget < 0) {
      this.budget = 5000;
      return true;
    }
    return false;
  }

  canMove(dir: Dir): boolean {
    const s = this.sprite;
    const [dx, dy] = DIRS[dir] ?? [0, 0];
    if (this.gravityOn && dy !== 0) return false;
    const tx = s.col + dx;
    const ty = s.row + dy;
    if (!this.game.inBounds(tx, ty)) return false;
    if (this.game.solidAt(tx, ty, false)) return false;
    if (this.gravityOn && this.run.def.edges === 'stop' && s.onGround && !this.game.solidAt(tx, ty + 1, true)) {
      return false;
    }
    return true;
  }

  isOnGround(): boolean {
    return this.sprite.onGround;
  }

  face(dir: Dir): void {
    if (DIRS[dir]) this.sprite.facing = dir;
  }

  setSpeed(speed: number): void {
    this.sprite.speed = Math.max(0.25, Math.min(16, Number(speed) || 2));
  }

  /** Direction of the nearest player, preferring the axis with the larger distance. */
  playerDirection(): Dir {
    const s = this.sprite;
    const p = this.game.api.player();
    if (!p) return s.facing;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    if (this.gravityOn || Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    return dy < 0 ? 'up' : 'down';
  }

  /** Moves `count` grid spaces. `dir` may be 'forward': the way the sprite is facing. */
  *move(direction: Dir | 'forward', count: number): Generator<unknown, void, unknown> {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    const s = this.sprite;
    const dir = direction === 'forward' ? s.facing : direction;
    const [dx, dy] = DIRS[dir] ?? [0, 0];
    for (let i = 0; i < n; i++) {
      if (s.removed) return;
      if (dx !== 0 || s.asset.turn === 'rotate') s.facing = dir;
      if (!this.canMove(dir)) {
        // Skip the rest of this move, but wait a frame so blocked loops can't spin.
        yield;
        return;
      }
      this.frameMoves++;
      const targetX = (s.col + dx) * CELL + CELL / 2;
      const targetY = (s.row + dy) * CELL + CELL - s.h / 2;
      for (let guard = 0; guard < 600; guard++) {
        const rx = targetX - s.x;
        const ry = this.gravityOn ? 0 : targetY - s.y;
        if (Math.abs(rx) < 0.01 && Math.abs(ry) < 0.01) break;
        const sp = s.speed;
        s.ctrlX = Math.abs(rx) <= sp ? rx : Math.sign(rx) * sp;
        s.ctrlY = Math.abs(ry) <= sp ? ry : Math.sign(ry) * sp;
        yield;
        if (s.removed) return;
        if ((s.ctrlX !== 0 && s.blockedX) || (s.ctrlY !== 0 && s.blockedY)) return;
      }
    }
  }

  *moveToward(target: 'player', count: number): Generator<unknown, void, unknown> {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    for (let i = 0; i < n; i++) {
      if (target === 'player') yield* this.move(this.playerDirection(), 1);
    }
  }

  *jump(height = 2): Generator<unknown, void, unknown> {
    const s = this.sprite;
    if (!this.gravityOn || !s.onGround) {
      yield;
      return;
    }
    s.vy = -jumpVelocity(height);
    s.onGround = false;
    yield;
    for (let guard = 0; guard < 600 && !s.onGround && !s.removed; guard++) yield;
  }

  *wait(seconds: number): Generator<unknown, void, unknown> {
    const frames = Math.round((Number(seconds) || 0) * 60);
    for (let i = 0; i < frames; i++) yield;
  }

  /** Creates a sprite in the space in front of this one, facing the same way, and starts a path on it. */
  throw(assetId: string, path: string): void {
    this.game.throwFrom(this.sprite, assetId, path);
  }

  /** Removes this sprite. Generated code returns from the path right after. */
  disappear(): void {
    this.game.remove(this.sprite);
  }
}

function jumpVelocity(cells: number): number {
  return Math.sqrt(2 * GRAVITY * (cells * CELL + CELL * 0.35));
}

type Handler = () => void;

export type BuiltinSound = 'jump' | 'fall' | 'outOfHealth' | 'win' | 'gameOver';
export const DEFAULT_SOUNDS: Record<BuiltinSound, string> = {
  jump: 'jump',
  fall: 'hurt',
  outOfHealth: 'lose',
  win: 'win',
  gameOver: 'lose',
};
interface TouchHandler {
  a: string;
  b: string;
  mode: 'start' | 'while';
  fn: Handler;
  pairs: Set<string>;
}

export interface GameCallbacks {
  onError(message: string): void;
  onStatus(status: 'idle' | 'running' | 'stopped'): void;
}

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ' ': 'space',
  Enter: 'enter',
};

export function normalizeKey(key: string): string {
  return KEY_NAMES[key] ?? key.toLowerCase();
}

export class Game {
  readonly api: GameApi;
  private p!: p5;
  private images = new Map<string, p5.Image>();
  private ready = false;
  sprites: Sprite[] = [];
  private solidGrid = new Map<string, Sprite[]>();
  /** "col,row" -> asset id of joinable sprites, rebuilt every frame for drawing. */
  private joined = new Map<string, string>();

  // Level state
  levels: Level[] = [];
  levelIndex = 0;
  mode: GameMode = 'platformer';
  cols = 16;
  rows = 9;
  view: ViewSize = 9;
  background: string | null = null;
  color: string | null = null;
  /** Character asset starred as the player for the current level. */
  private levelPlayer: string | null = null;
  cam = { x: 0, y: 0 };

  // Game state
  running = false;
  finished: '' | 'won' | 'lost' = '';
  score = 0;
  health = START_HEALTH;
  private levelStartScore = 0;
  private healthZeroFired = false;
  playerSpeed = 3.5;
  jumpHeight = 3;
  /** Sounds the engine plays on its own. Users can change them with a block; '' means silent. */
  sounds: Record<BuiltinSound, string> = { ...DEFAULT_SOUNDS };
  frame = 0;
  private message = '';
  private messageFrames = 0;
  private pendingLevel: number | null = null;

  // Program
  private program: CompiledProgram | null = null;
  private paths: Record<string, PathDef> = {};
  private handlers: Record<string, Handler[]> = {};
  private keyHandlers: { key: string; mode: 'pressed' | 'down'; fn: Handler }[] = [];
  private touchHandlers: TouchHandler[] = [];
  private clickHandlers: { sel: string; fn: Handler }[] = [];
  ctxThis: Sprite | null = null;
  ctxOther: Sprite | null = null;
  budget = LOOP_BUDGET;

  // Input
  private keysDown = new Set<string>();
  private keysPressed = new Set<string>();
  private clicks: { x: number; y: number }[] = [];
  focused = false;

  private preview: Level | null = null;

  constructor(
    private container: HTMLElement,
    private callbacks: GameCallbacks,
  ) {
    this.api = new GameApi(this);
    new p5((p: p5) => {
      this.p = p;
      p.setup = async () => {
        const canvas = p.createCanvas(CANVAS_W, CANVAS_H);
        canvas.elt.removeAttribute('style');
        p.pixelDensity(1);
        p.noSmooth();
        p.frameRate(60);
        await Promise.all(
          allImageNames().map(async (name) => {
            try {
              this.images.set(name, await p.loadImage(imageUrl(name)));
            } catch {
              console.warn('Could not load image', name);
            }
          }),
        );
        this.ready = true;
      };
      p.draw = () => this.draw();
      p.mousePressed = () => {
        const rect = (p as unknown as { canvas: HTMLCanvasElement }).canvas.getBoundingClientRect();
        const mx = ((p.winMouseX - rect.left) / rect.width) * CANVAS_W;
        const my = ((p.winMouseY - rect.top) / rect.height) * CANVAS_H;
        if (mx >= 0 && my >= 0 && mx <= CANVAS_W && my <= CANVAS_H) this.clicks.push({ x: mx, y: my });
      };
    }, container);

    container.addEventListener('keydown', (e) => {
      if (!this.running) return;
      const k = normalizeKey(e.key);
      if (['left', 'right', 'up', 'down', 'space'].includes(k)) e.preventDefault();
      if (!this.keysDown.has(k)) this.keysPressed.add(k);
      this.keysDown.add(k);
    });
    container.addEventListener('keyup', (e) => this.keysDown.delete(normalizeKey(e.key)));
    container.addEventListener('focus', () => (this.focused = true));
    container.addEventListener('blur', () => {
      this.focused = false;
      this.keysDown.clear();
    });
  }

  // ---------------------------------------------------------------- lifecycle

  showPreview(level: Level): void {
    if (this.running) return;
    this.preview = level;
    this.program = null;
    this.paths = {};
    this.resetHandlers();
    this.loadLevelData(level, null);
  }

  start(program: CompiledProgram): void {
    this.stop(false);
    this.program = program;
    this.levels = program.levels;
    this.score = 0;
    this.health = START_HEALTH;
    this.playerSpeed = 3.5;
    this.jumpHeight = 3;
    this.sounds = { ...DEFAULT_SOUNDS };
    this.finished = '';
    this.message = '';
    this.healthZeroFired = false;
    this.resetHandlers();
    try {
      this.paths = new Function(program.paths)() as Record<string, PathDef>;
      this.budget = LOOP_BUDGET;
      new Function('$g', program.main)(this.api);
    } catch (e) {
      this.fail(e);
      return;
    }
    this.running = true;
    this.preview = null;
    this.loadLevel(0, true);
    this.callbacks.onStatus('running');
    this.container.focus();
  }

  stop(notify = true): void {
    const wasRunning = this.running;
    this.running = false;
    this.keysDown.clear();
    this.keysPressed.clear();
    if (notify && wasRunning) this.callbacks.onStatus('stopped');
  }

  private fail(e: unknown): void {
    console.error(e);
    this.stop();
    const msg = e instanceof Error ? e.message : String(e);
    this.callbacks.onError(msg);
  }

  private resetHandlers(): void {
    this.handlers = {};
    this.keyHandlers = [];
    this.touchHandlers = [];
    this.clickHandlers = [];
  }

  // ---------------------------------------------------------------- handlers

  on(event: string, fn: Handler): void {
    (this.handlers[event] ??= []).push(fn);
  }

  onKey(key: string, mode: 'pressed' | 'down', fn: Handler): void {
    this.keyHandlers.push({ key, mode, fn });
  }

  onTouch(a: string, b: string, mode: 'start' | 'while', fn: Handler): void {
    this.touchHandlers.push({ a, b, mode, fn, pairs: new Set() });
  }

  onClick(sel: string, fn: Handler): void {
    this.clickHandlers.push({ sel, fn });
  }

  private call(fn: Handler, self: Sprite | null = null, other: Sprite | null = null): void {
    if (!this.running) return;
    const prevThis = this.ctxThis;
    const prevOther = this.ctxOther;
    this.ctxThis = self;
    this.ctxOther = other;
    this.budget = LOOP_BUDGET;
    try {
      fn();
    } catch (e) {
      this.fail(e);
    } finally {
      this.ctxThis = prevThis;
      this.ctxOther = prevOther;
    }
  }

  private fire(event: string): void {
    for (const fn of this.handlers[event] ?? []) this.call(fn);
  }

  // ---------------------------------------------------------------- levels

  /** Applies level settings. Called from hidden level setup code. */
  setupLevel(opts: {
    cols: number;
    rows: number;
    mode: GameMode;
    view: ViewSize;
    background: string | null;
    color?: string | null;
    player?: string | null;
  }): void {
    this.cols = Math.max(1, opts.cols | 0);
    this.rows = Math.max(1, opts.rows | 0);
    this.mode = opts.mode;
    this.view = opts.view;
    this.background = opts.background;
    this.color = opts.color ?? null;
    this.levelPlayer = opts.player ?? null;
  }

  private loadLevelData(level: Level, setupCode: string | null): void {
    this.sprites = [];
    this.message = '';
    this.setupLevel(level);
    if (setupCode) {
      new Function('$g', setupCode)(this.api);
    } else {
      for (const [key, assetId] of Object.entries(level.cells)) {
        const [x, y] = key.split(',').map(Number);
        this.spawn(assetId, x, y);
      }
    }
    // Every sprite of the starred character is a player.
    for (const s of this.sprites) s.isPlayer = s.cls === 'character' && s.asset.id === this.levelPlayer;
    this.rebuildSolids();
    this.updateCamera(true);
  }

  loadLevel(index: number, first = false): void {
    if (!this.program) return;
    if (index >= this.levels.length) {
      this.win();
      return;
    }
    this.levelIndex = Math.max(0, index);
    for (const h of this.touchHandlers) h.pairs.clear();
    this.levelStartScore = this.score;
    try {
      this.loadLevelData(this.levels[this.levelIndex], this.program.levelSetup[this.levelIndex]);
    } catch (e) {
      this.fail(e);
      return;
    }
    if (first) this.fire('start');
    this.fire('levelStart');
  }

  requestLevel(index: number): void {
    this.pendingLevel = index;
  }

  restartLevel(): void {
    this.score = this.levelStartScore;
    this.health = START_HEALTH;
    this.healthZeroFired = false;
    this.requestLevel(this.levelIndex);
  }

  win(): void {
    this.finished = 'won';
    this.showMessage('You win!', 0);
    this.playBuiltin('win');
  }

  lose(): void {
    this.finished = 'lost';
    this.showMessage('Game over', 0);
    this.playBuiltin('gameOver');
  }

  playBuiltin(which: BuiltinSound, volume?: number): void {
    const id = this.sounds[which];
    if (id) playSound(id, volume);
  }

  showMessage(text: string, seconds = 2.5): void {
    this.message = String(text);
    this.messageFrames = seconds > 0 ? Math.round(seconds * 60) : Infinity;
  }

  // ---------------------------------------------------------------- sprites

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  spawn(assetId: string, x: number, y: number): Sprite | null {
    const asset = getSprite(assetId);
    x = Math.floor(Number(x));
    y = Math.floor(Number(y));
    if (!asset || !this.inBounds(x, y)) {
      console.warn(`Cannot create ${assetId} at (${x}, ${y}): ${asset ? 'outside the level' : 'unknown sprite'}`);
      return null;
    }
    const s = new Sprite(asset, x, y);
    this.sprites.push(s);
    if (s.solid) this.addSolid(s);
    return s;
  }

  remove(s: Sprite): void {
    if (s.removed) return;
    s.removed = true;
    s.path = null;
    if (s.solid) this.rebuildSolids();
  }

  setCostume(s: Sprite, assetId: string): void {
    const asset = getSprite(assetId);
    if (!asset) return;
    const wasSolid = s.solid;
    s.asset = asset;
    if (wasSolid || s.solid) this.rebuildSolids();
  }

  /** Creates a sprite in the space in front of `s`, facing the same way, and starts `path` on it. */
  throwFrom(s: Sprite, assetId: string, path: string): Sprite | null {
    if (s.removed) return null;
    const [dx, dy] = DIRS[s.facing];
    const x = s.col + dx;
    const y = s.row + dy;
    if (!this.inBounds(x, y) || this.solidAt(x, y, false)) return null;
    const thrown = this.spawn(assetId, x, y);
    if (!thrown) return null;
    thrown.facing = s.facing;
    this.api.setPath(thrown, path);
    return thrown;
  }

  moveTo(s: Sprite, x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    s.x = x * CELL + CELL / 2;
    s.y = y * CELL + CELL - s.h / 2;
    s.vx = s.vy = 0;
    if (s.solid) this.rebuildSolids();
  }

  private addSolid(s: Sprite): void {
    const key = s.col + ',' + s.row;
    const list = this.solidGrid.get(key);
    if (list) list.push(s);
    else this.solidGrid.set(key, [s]);
  }

  private rebuildSolids(): void {
    this.solidGrid.clear();
    for (const s of this.sprites) if (s.solid && !s.removed) this.addSolid(s);
  }

  /** Is there a solid sprite in this cell? One-way platforms count only when `includeOneWay`. */
  solidAt(x: number, y: number, includeOneWay: boolean): boolean {
    const list = this.solidGrid.get(x + ',' + y);
    return !!list && list.some((s) => !s.removed && (includeOneWay || !s.oneWay));
  }

  private solidsNear(box: Box): Sprite[] {
    const out: Sprite[] = [];
    const x0 = Math.floor(box.l / CELL) - 1;
    const x1 = Math.floor(box.r / CELL) + 1;
    const y0 = Math.floor(box.t / CELL) - 1;
    const y1 = Math.floor(box.b / CELL) + 1;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const list = this.solidGrid.get(x + ',' + y);
        if (list) for (const s of list) if (!s.removed) out.push(s);
      }
    }
    return out;
  }

  gravityActive(s: Sprite): boolean {
    return this.mode === 'platformer' && s.gravity && !(s.path && s.path.def.ignoreGravity);
  }

  // ---------------------------------------------------------------- update

  private update(): void {
    this.frame++;

    // Keyboard events
    for (const h of this.keyHandlers) {
      const active = h.mode === 'pressed' ? this.keysPressed.has(h.key) : this.keysDown.has(h.key);
      if (active) this.call(h.fn);
    }
    this.keysPressed.clear();

    this.controlPlayers();

    // Paths
    for (const s of this.sprites) {
      s.ctrlX = s.ctrlY = 0;
      if (s.path && !s.removed) {
        s.path.ctx.frameMoves = 0;
        try {
          s.path.step();
        } catch (e) {
          this.fail(e);
          return;
        }
      }
    }

    // Physics
    let solidsMoved = false;
    for (const s of this.sprites) {
      if (s.removed) continue;
      s.prevX = s.x;
      s.prevY = s.y;
      if (s.solid) {
        if (s.ctrlX || s.ctrlY) {
          s.x += s.ctrlX;
          s.y += s.ctrlY;
          solidsMoved = true;
        }
        continue;
      }
      this.integrate(s);
      if (s.invincible > 0) s.invincible--;
    }
    if (solidsMoved) this.rebuildSolids();

    // Falling out of the level
    for (const s of this.sprites) {
      if (s.removed || s.y - s.h / 2 < this.rows * CELL + CELL * 2) continue;
      if (s.isPlayer) {
        s.x = s.homeX;
        s.y = s.homeY;
        s.vx = s.vy = 0;
        this.playBuiltin('fall');
        this.changeHealth(-1, true);
      } else {
        this.remove(s);
      }
    }

    this.checkTouches();
    this.fire('tick');
    this.handleClicks();

    if (this.sprites.some((s) => s.removed)) this.sprites = this.sprites.filter((s) => !s.removed);
    if (this.messageFrames > 0 && this.messageFrames !== Infinity) {
      if (--this.messageFrames === 0) this.message = '';
    }
    if (this.pendingLevel !== null) {
      const index = this.pendingLevel;
      this.pendingLevel = null;
      this.loadLevel(index);
    }
  }

  private controlPlayers(): void {
    const k = this.keysDown;
    const left = k.has('left') || k.has('a');
    const right = k.has('right') || k.has('d');
    const up = k.has('up') || k.has('w');
    const down = k.has('down') || k.has('s');
    const jump = up || k.has('space');
    for (const s of this.sprites) {
      if (!s.isPlayer || s.removed || s.path) continue;
      s.vx = (right ? 1 : 0) - (left ? 1 : 0);
      if (s.vx !== 0) s.facing = s.vx < 0 ? 'left' : 'right';
      s.vx *= this.playerSpeed;
      if (this.gravityActive(s)) {
        if (jump && s.onGround) {
          s.vy = -jumpVelocity(this.jumpHeight);
          s.onGround = false;
          this.playBuiltin('jump', 0.35);
        }
      } else {
        s.vy = ((down ? 1 : 0) - (up ? 1 : 0)) * this.playerSpeed;
        if (s.vy !== 0 && s.vx === 0) s.facing = s.vy < 0 ? 'up' : 'down';
      }
    }
  }

  private integrate(s: Sprite): void {
    const grav = this.gravityActive(s);
    if (grav) s.vy = Math.min(s.vy + GRAVITY, MAX_FALL);
    else if (!(s.isPlayer && !s.path)) s.vy = 0;
    const dx = s.vx + s.ctrlX;
    const dy = s.vy + (grav ? 0 : s.ctrlY);

    // Horizontal
    s.blockedX = false;
    s.x += dx;
    if (dx !== 0) {
      for (const o of this.solidsNear(s.box())) {
        if (o.oneWay || !overlaps(s.box(), o.box())) continue;
        s.x = dx > 0 ? o.box().l - s.w / 2 : o.box().r + s.w / 2;
        s.blockedX = true;
      }
    }
    const maxX = this.cols * CELL - s.w / 2;
    if (s.x < s.w / 2 || s.x > maxX) {
      s.x = Math.max(s.w / 2, Math.min(maxX, s.x));
      s.blockedX = true;
    }

    // Vertical
    s.blockedY = false;
    s.onGround = false;
    const prevBottom = s.y + s.h / 2;
    s.y += dy;
    for (const o of this.solidsNear(s.box())) {
      const ob = o.box();
      if (!overlaps(s.box(), ob)) continue;
      if (o.oneWay && !(dy > 0 && prevBottom <= ob.t + 0.01)) continue;
      if (dy > 0) {
        s.y = ob.t - s.h / 2;
        s.onGround = true;
      } else if (dy < 0) {
        s.y = ob.b + s.h / 2;
      } else {
        continue;
      }
      s.vy = 0;
      s.blockedY = true;
    }
    if (dy === 0 && grav) {
      // Resting: check for ground directly below.
      const below: Box = { l: s.x - s.w / 2, t: s.y + s.h / 2, r: s.x + s.w / 2, b: s.y + s.h / 2 + 1 };
      s.onGround = this.solidsNear(below).some((o) => overlaps(below, o.box()));
    }
    if (!grav) {
      const maxY = this.rows * CELL - s.h / 2;
      if (s.y < s.h / 2 || s.y > maxY) {
        s.y = Math.max(s.h / 2, Math.min(maxY, s.y));
        s.blockedY = true;
      }
    }
    const moving = Math.abs(s.x - s.prevX) > 0.1 || (!grav && Math.abs(s.y - s.prevY) > 0.1);
    s.animTime = moving ? s.animTime + 1 : 0;
  }

  private checkTouches(): void {
    for (const h of this.touchHandlers) {
      const as = this.api.find(h.a);
      const bs = this.api.find(h.b);
      const now = new Set<string>();
      for (const a of as) {
        if (a.removed) continue;
        for (const b of bs) {
          if (a === b || b.removed || a.removed) continue;
          if (!a.touches(b)) continue;
          const key = a.id + ':' + b.id;
          now.add(key);
          if (h.mode === 'while' || !h.pairs.has(key)) this.call(h.fn, a, b);
          if (!this.running) return;
        }
      }
      h.pairs = now;
    }
  }

  private handleClicks(): void {
    if (!this.clicks.length) return;
    const clicks = this.clicks;
    this.clicks = [];
    const scale = CANVAS_H / (this.view * CELL);
    for (const c of clicks) {
      const wx = c.x / scale + this.cam.x;
      const wy = c.y / scale + this.cam.y;
      for (const h of this.clickHandlers) {
        for (const s of this.api.find(h.sel)) {
          const b = s.box();
          if (!s.removed && wx >= b.l && wx <= b.r && wy >= b.t && wy <= b.b) this.call(h.fn, s, null);
        }
      }
    }
  }

  changeHealth(delta: number, force = false): void {
    delta = Number(delta) || 0;
    if (delta < 0) {
      const players = this.api.find('player');
      if (!force && players.some((p) => p.invincible > 0)) return;
      players.forEach((p) => (p.invincible = INVINCIBLE_FRAMES));
    }
    this.setHealth(this.health + delta);
  }

  setHealth(value: number): void {
    this.health = Math.max(0, Math.round(Number(value) || 0));
    if (this.health > 0) {
      this.healthZeroFired = false;
      return;
    }
    if (this.healthZeroFired) return;
    this.healthZeroFired = true;
    if (this.handlers['healthZero']?.length) {
      this.fire('healthZero');
    } else {
      this.playBuiltin('outOfHealth');
      this.showMessage('Out of health! Try again.');
      this.restartLevel();
    }
  }

  // ---------------------------------------------------------------- rendering

  private updateCamera(snap = false): void {
    const vw = viewCols(this.view) * CELL;
    const vh = this.view * CELL;
    const lw = this.cols * CELL;
    const lh = this.rows * CELL;
    const target = this.sprites.find((s) => s.isPlayer && !s.removed);
    let tx = target ? target.x - vw / 2 : 0;
    let ty = target ? target.y - vh / 2 : lh - vh;
    tx = lw <= vw ? (lw - vw) / 2 : Math.max(0, Math.min(lw - vw, tx));
    ty = lh <= vh ? lh - vh : Math.max(0, Math.min(lh - vh, ty));
    if (snap) {
      this.cam.x = tx;
      this.cam.y = ty;
    } else {
      this.cam.x += (tx - this.cam.x) * 0.2;
      this.cam.y += (ty - this.cam.y) * 0.2;
    }
  }

  private draw(): void {
    const p = this.p;
    if (!this.ready) {
      p.background('#20242c');
      p.fill(255);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(24);
      p.text('Loading…', CANVAS_W / 2, CANVAS_H / 2);
      return;
    }
    if (this.running && !this.finished) this.update();
    this.updateCamera();
    const scale = CANVAS_H / (this.view * CELL);

    this.drawBackground(scale);
    p.push();
    p.scale(scale);
    p.translate(-Math.round(this.cam.x * scale) / scale, -Math.round(this.cam.y * scale) / scale);
    p.noStroke();
    // Where joinable textures are, so each piece can match its neighbours (sprites can move or be created).
    this.joined.clear();
    for (const s of this.sprites) if (s.asset.join && !s.removed) this.joined.set(s.col + ',' + s.row, s.asset.id);
    const sorted = [...this.sprites].sort((a, b) => drawLayer(a) - drawLayer(b));
    for (const s of sorted) if (!s.removed && s.visible) this.drawSprite(s);
    p.pop();
    this.drawHud();
  }

  /** Fills the level area with its background and everything outside it with a dark colour. */
  private drawBackground(scale: number): void {
    const p = this.p;
    const bg = getBackground(this.background);
    p.background(OUTSIDE_COLOR);
    p.push();
    p.noStroke();
    p.clip(() =>
      p.rect(-Math.round(this.cam.x * scale), -Math.round(this.cam.y * scale), this.cols * CELL * scale, this.rows * CELL * scale),
    );
    p.fill(bg?.color ?? this.color ?? '#9fd8f0');
    p.rect(0, 0, CANVAS_W, CANVAS_H);
    if (bg) this.drawBackgroundImages(bg, scale);
    p.pop();
  }

  private drawBackgroundImages(bg: NonNullable<ReturnType<typeof getBackground>>, scale: number): void {
    const p = this.p;
    if (bg.type === 'tile') {
      const img = this.images.get(bg.tile!);
      if (!img) return;
      const size = CELL * scale;
      const ox = -((this.cam.x * scale) % size);
      const oy = -((this.cam.y * scale) % size);
      for (let y = oy - size; y < CANVAS_H; y += size) {
        for (let x = ox - size; x < CANVAS_W; x += size) p.image(img, x, y, size + 0.5, size + 0.5);
      }
      return;
    }
    // Scenic: sky, a parallax horizon strip, then ground below.
    if (bg.tint) p.tint(bg.tint);
    const t = Math.ceil(CANVAS_H / 6);
    const stripY = Math.round(CANVAS_H * 0.55);
    const sky = this.images.get(bg.sky!);
    const ground = this.images.get(bg.ground!);
    const strip = (bg.strip ?? []).map((n) => this.images.get(n)).filter(Boolean) as p5.Image[];
    const ox = -((this.cam.x * scale * 0.3) % (t * Math.max(1, strip.length)));
    for (let x = ox - t * 2; x < CANVAS_W + t; x += t) {
      if (sky) for (let y = stripY - t; y > -t; y -= t) p.image(sky, x, y, t + 1, t + 1);
      const i = Math.round((x - ox) / t);
      const img = strip[((i % strip.length) + strip.length) % strip.length];
      if (img) p.image(img, x, stripY, t + 1, t + 1);
      if (ground) for (let y = stripY + t; y < CANVAS_H; y += t) p.image(ground, x, y, t + 1, t + 1);
    }
  }

  private drawSprite(s: Sprite): void {
    const p = this.p;
    if (s.invincible > 0 && Math.floor(s.invincible / 5) % 2 === 0) return;
    const a = s.asset;
    let frameIndex = 0;
    let piece: JoinPiece | null = null;
    if (a.join) {
      piece = joinPiece(a, (dx, dy) => this.joined.get(s.col + dx + ',' + (s.row + dy)) === a.id);
      frameIndex = piece.frame;
    } else if (a.frames.length > 1) {
      if (a.animate === 'move') {
        if (this.gravityActive(s) && !s.onGround) frameIndex = 1;
        else if (s.animTime > 0) frameIndex = Math.floor(s.animTime / 8) % a.frames.length;
      } else {
        frameIndex = Math.floor(this.frame / 15) % a.frames.length;
      }
    }
    const img = this.images.get(a.frames[frameIndex]);
    if (!img) return;
    // Images fill one cell, bottom-aligned with the sprite's box.
    const cx = s.x;
    const cy = s.y + s.h / 2 - CELL / 2;
    p.push();
    p.translate(cx, cy);
    if (a.turn === 'flip') {
      const art = a.facing === 'left' ? 'left' : 'right';
      if (s.lookH !== art) p.scale(-1, 1);
    } else if (a.turn === 'rotate') {
      const angle: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };
      p.rotate(((angle[s.facing] - angle[a.facing ?? 'up']) * Math.PI) / 180);
    }
    const aspect = img.width / img.height;
    const w = aspect >= 1 ? CELL : CELL * aspect;
    const h = aspect >= 1 ? CELL / aspect : CELL;
    p.image(img, -w / 2, CELL / 2 - h, w, h);
    if (piece?.corners.length && a.join?.outline) {
      // Inner corners: small steps in the outline colour, in the texture's own pixel size.
      const unit = CELL / (a.join.pixels ?? 18);
      p.noStroke();
      p.fill(a.join.outline);
      for (const [x, y, rw, rh] of cornerRects(piece.corners, a.join.pixels ?? 18)) {
        p.rect(-CELL / 2 + x * unit, -CELL / 2 + y * unit, rw * unit, rh * unit);
      }
    }
    p.pop();
  }

  private drawHud(): void {
    const p = this.p;
    if (this.preview) return;
    p.push();
    p.textFont('system-ui, sans-serif');
    p.textStyle(p.BOLD);
    p.textSize(26);
    p.textAlign(p.LEFT, p.TOP);
    p.stroke(255);
    p.strokeWeight(5);
    p.fill('#1f2633');
    p.text(`Score: ${this.score}`, 16, 14);
    p.noStroke();
    const heart = this.images.get('heart');
    if (heart) {
      const n = Math.min(this.health, 12);
      for (let i = 0; i < n; i++) p.image(heart, CANVAS_W - 44 - i * 38, 12, 34, 34);
    }
    if (this.levels.length > 1) {
      p.textAlign(p.CENTER, p.TOP);
      p.textSize(18);
      p.stroke(255);
      p.strokeWeight(4);
      p.fill('#1f2633');
      p.text(this.levels[this.levelIndex]?.name ?? '', CANVAS_W / 2, 16);
      p.noStroke();
    }
    if (this.message) {
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(40);
      const w = Math.min(CANVAS_W - 40, p.textWidth(this.message) + 60);
      p.fill(0, 150);
      p.rect((CANVAS_W - w) / 2, CANVAS_H / 2 - 40, w, 80, 16);
      p.fill(255);
      p.text(this.message, CANVAS_W / 2, CANVAS_H / 2);
    }
    if (this.running && !this.focused && !this.finished) {
      p.textAlign(p.CENTER, p.BOTTOM);
      p.textSize(18);
      p.fill(0, 140);
      p.rect(CANVAS_W / 2 - 170, CANVAS_H - 44, 340, 32, 8);
      p.fill(255);
      p.text('Click the game to use the keyboard', CANVAS_W / 2, CANVAS_H - 19);
    }
    p.pop();
  }
}

/** Back items, then platforms and obstacles, front items, characters and finally the player. */
function drawLayer(s: Sprite): number {
  if (s.isPlayer) return 4;
  if (s.cls === 'character') return 3;
  if (s.cls === 'item') return s.asset.layer === 'back' ? 0 : 2;
  return 1;
}

type SpriteRef = Sprite | SpriteRef[] | null | undefined;

/**
 * The object generated user code calls as `$g`. Every method finishes within the current frame.
 * Selectors: "player", "any", "class:<cls>" (never includes the player), "asset:<assetId>".
 */
export class GameApi {
  constructor(private g: Game) {}

  get $budget(): number {
    return this.g.budget;
  }

  set $budget(v: number) {
    this.g.budget = v;
  }

  // Events
  on(event: 'start' | 'levelStart' | 'tick' | 'healthZero', fn: Handler): void {
    this.g.on(event, fn);
  }
  onKey(key: string, mode: 'pressed' | 'down', fn: Handler): void {
    this.g.onKey(key, mode, fn);
  }
  onTouch(a: string, b: string, mode: 'start' | 'while', fn: Handler): void {
    this.g.onTouch(a, b, mode, fn);
  }
  onClick(sel: string, fn: Handler): void {
    this.g.onClick(sel, fn);
  }
  ctx(which: 'this' | 'other'): Sprite | null {
    return which === 'this' ? this.g.ctxThis : this.g.ctxOther;
  }

  // Hidden level setup
  setupLevel(opts: Parameters<Game['setupLevel']>[0]): void {
    this.g.setupLevel(opts);
  }

  // Sprite lookup
  refs(r: SpriteRef): Sprite[] {
    if (!r) return [];
    if (r instanceof Sprite) return r.removed ? [] : [r];
    if (Array.isArray(r)) return r.flatMap((x) => this.refs(x));
    return [];
  }
  first(r: SpriteRef): Sprite | null {
    return this.refs(r)[0] ?? null;
  }
  find(sel: string): Sprite[] {
    const all = this.g.sprites.filter((s) => !s.removed);
    if (sel === 'any') return all;
    if (sel === 'player') return all.filter((s) => s.isPlayer);
    const [kind, value] = String(sel).split(':');
    // "character" means the other characters: the player is chosen with its own selector.
    if (kind === 'class') return all.filter((s) => s.cls === value && !s.isPlayer);
    if (kind === 'asset') return all.filter((s) => s.asset.id === value);
    return [];
  }
  player(): Sprite | null {
    return this.find('player')[0] ?? null;
  }
  count(sel: string): number {
    return this.find(sel).length;
  }
  random(sel: string): Sprite | null {
    const list = this.find(sel);
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  // Locations
  loc(x: number, y: number): Loc {
    return { x: Math.floor(Number(x) || 0), y: Math.floor(Number(y) || 0) };
  }
  locs(r: LocRef): Loc[] {
    if (!r) return [];
    if (Array.isArray(r)) return r.flatMap((x) => this.locs(x));
    return typeof r.x === 'number' && typeof r.y === 'number' ? [r] : [];
  }
  locationOf(ref: SpriteRef): Loc[] {
    return this.refs(ref).map((s) => ({ x: s.col, y: s.row }));
  }
  relative(ref: SpriteRef, dir: Dir, n: number): Loc[] {
    const [dx, dy] = DIRS[dir] ?? [0, 0];
    const k = Math.floor(Number(n) || 0);
    return this.refs(ref).map((s) => ({ x: s.col + dx * k, y: s.row + dy * k }));
  }
  closest(sel: string, at: LocRef): Sprite | null {
    const target = this.locs(at)[0];
    if (!target) return null;
    const cx = (target.x + 0.5) * CELL;
    const cy = (target.y + 0.5) * CELL;
    let best: Sprite | null = null;
    let bestDist = Infinity;
    for (const s of this.find(sel)) {
      const d = (s.x - cx) ** 2 + (s.y - cy) ** 2;
      if (d < bestDist) {
        best = s;
        bestDist = d;
      }
    }
    return best;
  }

  // Creating and removing
  spawn(assetId: string, x: number, y: number): Sprite | null {
    return this.g.spawn(assetId, x, y);
  }
  create(assetId: string, at: LocRef): Sprite[] {
    return this.locs(at)
      .map((l) => this.g.spawn(assetId, l.x, l.y))
      .filter((s): s is Sprite => !!s);
  }
  throwFrom(ref: SpriteRef, assetId: string, path: string): Sprite[] {
    return this.refs(ref)
      .map((s) => this.g.throwFrom(s, assetId, path))
      .filter((s): s is Sprite => !!s);
  }
  remove(ref: SpriteRef): void {
    this.refs(ref).forEach((s) => this.g.remove(s));
  }

  // Sprite properties
  setPath(ref: SpriteRef, name: string): void {
    const def = this.g['paths'][name] as PathDef | undefined;
    for (const s of this.refs(ref)) {
      if (!def) {
        s.path = null;
        continue;
      }
      if (s.path?.name === name) continue;
      s.path = new PathRun(name, def, s, this.g);
    }
  }
  stopPath(ref: SpriteRef): void {
    this.refs(ref).forEach((s) => (s.path = null));
  }
  setCostume(ref: SpriteRef, assetId: string): void {
    this.refs(ref).forEach((s) => this.g.setCostume(s, assetId));
  }
  moveTo(ref: SpriteRef, x: number, y: number): void {
    this.refs(ref).forEach((s) => this.g.moveTo(s, Math.floor(Number(x)), Math.floor(Number(y))));
  }
  moveToLocation(ref: SpriteRef, at: LocRef): void {
    const l = this.locs(at)[0];
    if (l) this.moveTo(ref, l.x, l.y);
  }
  /** Makes the given character(s) the player; the previous player becomes an ordinary character. */
  makePlayer(ref: SpriteRef): void {
    const next = this.refs(ref).filter((s) => s.cls === 'character');
    if (!next.length) return;
    for (const s of this.g.sprites) s.isPlayer = next.includes(s);
  }
  setGravity(ref: SpriteRef, on: boolean): void {
    this.refs(ref).forEach((s) => (s.gravity = !!on));
  }
  setVisible(ref: SpriteRef, on: boolean): void {
    this.refs(ref).forEach((s) => (s.visible = !!on));
  }
  setSpeed(ref: SpriteRef, speed: number): void {
    this.refs(ref).forEach((s) => (s.speed = Math.max(0.25, Math.min(16, Number(speed) || 2))));
  }
  /** Platformer levels only: launches the sprite(s) upward about `height` spaces. */
  bounce(ref: SpriteRef, height = 1.5): void {
    if (this.g.mode !== 'platformer') return;
    this.refs(ref).forEach((s) => {
      s.vy = -jumpVelocity(Number(height) || 1.5);
      s.onGround = false;
    });
  }
  face(ref: SpriteRef, dir: Dir): void {
    this.refs(ref).forEach((s) => (s.facing = dir));
  }

  // Sprite questions
  isAbove(a: SpriteRef, b: SpriteRef): boolean {
    const s = this.first(a);
    const o = this.first(b);
    if (!s || !o) return false;
    const feet = Math.min(s.y, s.prevY) + s.h / 2;
    return feet - (o.y - o.h / 2) < CELL * 0.5 && s.y < o.y;
  }
  isTouching(a: SpriteRef, sel: string): boolean {
    const others = this.find(sel);
    return this.refs(a).some((s) => others.some((o) => o !== s && s.touches(o)));
  }
  isOnGround(ref: SpriteRef): boolean {
    return this.refs(ref).some((s) => s.onGround);
  }
  exists(ref: SpriteRef): boolean {
    return this.refs(ref).length > 0;
  }
  gridX(ref: SpriteRef): number {
    return this.first(ref)?.col ?? -1;
  }
  gridY(ref: SpriteRef): number {
    return this.first(ref)?.row ?? -1;
  }

  // Score and health
  changeScore(n: number): void {
    this.g.score += Number(n) || 0;
  }
  setScore(n: number): void {
    this.g.score = Number(n) || 0;
  }
  getScore(): number {
    return this.g.score;
  }
  changeHealth(n: number): void {
    this.g.changeHealth(n);
  }
  setHealth(n: number): void {
    this.g.setHealth(n);
  }
  getHealth(): number {
    return this.g.health;
  }

  // Game flow
  nextLevel(): void {
    this.g.requestLevel(this.g.levelIndex + 1);
  }
  gotoLevel(n: number): void {
    const i = Math.floor(Number(n) || 1) - 1;
    if (i >= 0 && i < this.g.levels.length) this.g.requestLevel(i);
  }
  restartLevel(): void {
    this.g.restartLevel();
  }
  levelNumber(): number {
    return this.g.levelIndex + 1;
  }
  win(): void {
    this.g.win();
  }
  lose(): void {
    this.g.lose();
  }
  message(text: unknown): void {
    this.g.showMessage(String(text));
  }
  sound(id: string): void {
    playSound(id);
  }
  setBackground(id: string): void {
    this.g.background = id;
  }
  setBuiltinSound(which: BuiltinSound, id: string): void {
    if (which in this.g.sounds) this.g.sounds[which] = String(id ?? '');
  }
  setPlayerSpeed(n: number): void {
    this.g.playerSpeed = Math.max(0.5, Math.min(12, Number(n) || 3.5));
  }
  setJumpHeight(n: number): void {
    this.g.jumpHeight = Math.max(0, Math.min(12, Number(n) || 3));
  }
}
