// Helpers for writing tutorials: Blockly JSON for starting blocks, solutions and checks, ready-made toolbox
// entries, and levels drawn from rows of characters.
import type { ToolboxEntry } from '../blocks/toolbox';
export { MAKE_VARIABLE } from '../blocks/toolbox';
import type { GameMode, Level } from '../model';
import { cellKey, newLevel } from '../model';

// ---------------------------------------------------------------- Blockly JSON

export type Wrapped = { block: { type: string; [key: string]: unknown } };
export const block = (type: string, rest: Record<string, unknown> = {}): Wrapped => ({ block: { type, ...rest } });
export const chain = (...blocks: Wrapped[]): Wrapped => {
  for (let i = blocks.length - 2; i >= 0; i--) blocks[i].block.next = blocks[i + 1];
  return blocks[0];
};
export const shadowNum = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
export const shadowText = (t: string) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
export const all = (selector: string) => block('sb_all', { fields: { SELECTOR: selector } });
export const player = () => block('sb_player');
export const thisSprite = () => block('sb_this_sprite');
export const other = () => block('sb_other_sprite');

/** A workspace (Blockly JSON) with these top blocks, and these variables (names, ids made from them). */
export const workspace = (...blocks: Record<string, unknown>[]) => ({ blocks: { languageVersion: 0, blocks } });
export const workspaceWithVars = (vars: string[], ...blocks: Record<string, unknown>[]) => ({
  variables: vars.map((name) => ({ name, id: varId(name) })),
  blocks: { languageVersion: 0, blocks },
});
export const varId = (name: string) => 'var_' + name.replace(/\W+/g, '_');

/** An event block at (x, y) with these steps inside. */
const hat = (type: string, x: number, y: number, fields: Record<string, unknown>, steps: Wrapped[]) => ({
  type,
  x,
  y,
  ...(Object.keys(fields).length ? { fields } : {}),
  ...(steps.length ? { inputs: { DO: chain(...steps) } } : {}),
});
export const touchRule = (x: number, y: number, b: string, ...steps: Wrapped[]) =>
  hat('sb_when_touch', x, y, { A: 'player', B: b }, steps);
export const touchRuleFor = (x: number, y: number, a: string, b: string, ...steps: Wrapped[]) =>
  hat('sb_when_touch', x, y, { A: a, B: b }, steps);
export const levelStartRule = (x: number, y: number, ...steps: Wrapped[]) => hat('sb_when_level_starts', x, y, {}, steps);
export const namedLevelRule = (x: number, y: number, levelId: string, ...steps: Wrapped[]) =>
  hat('sb_when_level_named_starts', x, y, { LEVEL: levelId }, steps);
export const gameStartRule = (x: number, y: number, ...steps: Wrapped[]) => hat('sb_when_game_starts', x, y, {}, steps);
export const healthZeroRule = (x: number, y: number, ...steps: Wrapped[]) => hat('sb_when_health_zero', x, y, {}, steps);
export const keyRule = (x: number, y: number, key: string, ...steps: Wrapped[]) =>
  hat('sb_when_key', x, y, { KEY: key, MODE: 'pressed' }, steps);

// Actions
export const win = () => block('sb_win');
export const removeOther = () => block('sb_remove', { inputs: { SPRITE: other() } });
export const remove = (sprite: Wrapped) => block('sb_remove', { inputs: { SPRITE: sprite } });
export const restart = () => block('sb_restart_level');
export const nextLevel = () => block('sb_next_level');
export const gotoLevel = (n: number) => block('sb_goto_level', { inputs: { N: shadowNum(n) } });
export const sound = (id: string) => block('sb_play_sound', { fields: { SOUND: id } });
export const message = (text: string | Wrapped) =>
  block('sb_message', { inputs: { TEXT: typeof text === 'string' ? shadowText(text) : { ...shadowText(''), ...text } } });
export const setPath = (selector: string, path: string) =>
  block('sb_set_path', { fields: { PATH: path }, inputs: { SPRITE: all(selector) } });
export const jumpHeight = (n: number) => block('sb_jump_height', { inputs: { N: shadowNum(n) } });
export const playerSpeed = (n: number) => block('sb_player_speed', { inputs: { N: shadowNum(n) } });
export const bounce = (height: string, sprite: Wrapped = player()) =>
  block('sb_bounce', { fields: { HEIGHT: height }, inputs: { SPRITE: sprite } });
export const turnInto = (sprite: Wrapped, asset: string) =>
  block('sb_set_costume', { fields: { ASSET: asset }, inputs: { SPRITE: sprite } });
export const gridLoc = (loc: string) => ({ shadow: { type: 'sb_location', fields: { LOC: loc } } });
export const locationOf = (sprite: Wrapped) => ({ ...gridLoc('0,0'), block: { type: 'sb_location_of', inputs: { SPRITE: sprite } } });
export const spacesFrom = (n: number, dir: string, sprite: Wrapped) => ({
  ...gridLoc('0,0'),
  block: { type: 'sb_location_relative', fields: { DIR: dir }, inputs: { N: shadowNum(n), SPRITE: sprite } },
});
export const moveTo = (sprite: Wrapped, loc: object) => block('sb_move_to_location', { inputs: { SPRITE: sprite, LOC: loc } });
export const create = (asset: string, loc: object) => block('sb_create', { fields: { ASSET: asset }, inputs: { LOC: loc } });
export const throwFrom = (asset: string, path: string, sprite: Wrapped = player()) =>
  block('sb_throw', { fields: { ASSET: asset, PATH: path }, inputs: { SPRITE: sprite } });
export const isAbove = (a: Wrapped, b: Wrapped) => block('sb_is_above', { inputs: { A: a, B: b } });
export const randomSprite = (selector: string) => block('sb_random_sprite', { fields: { SELECTOR: selector } });
export const countOf = (selector: string) => block('sb_count', { fields: { SELECTOR: selector } });

// Game values and variables
export const score = () => block('sb_score');
export const health = () => block('sb_health');
export const changeScore = (n: number | Wrapped) =>
  block('sb_change_score', { inputs: { N: typeof n === 'number' ? shadowNum(n) : { ...shadowNum(0), ...n } } });
export const setHealth = (n: number) => block('sb_set_health', { inputs: { N: shadowNum(n) } });
export const changeHealth = (n: number) => block('sb_change_health', { inputs: { N: shadowNum(n) } });
export const getVar = (name: string) => block('variables_get', { fields: { VAR: { id: varId(name) } } });
export const setVar = (name: string, value: number | Wrapped) =>
  block('variables_set', { fields: { VAR: { id: varId(name) } }, inputs: { VALUE: typeof value === 'number' ? shadowNum(value) : value } });
export const changeVar = (name: string, by: number) =>
  block('math_change', { fields: { VAR: { id: varId(name) } }, inputs: { DELTA: shadowNum(by) } });
export const join = (...parts: (string | Wrapped)[]) =>
  block('text_join', {
    extraState: { itemCount: parts.length },
    inputs: Object.fromEntries(parts.map((p, i) => [`ADD${i}`, typeof p === 'string' ? { block: { type: 'text', fields: { TEXT: p } } } : p])),
  });

// Logic and loops
export const num = (n: number) => block('math_number', { fields: { NUM: n } });
export const text = (t: string) => block('text', { fields: { TEXT: t } });
export const ifThen = (cond: Wrapped, then: Wrapped[], otherwise?: Wrapped[]) =>
  block('controls_if', {
    ...(otherwise ? { extraState: { hasElse: true } } : {}),
    inputs: { IF0: cond, DO0: chain(...then), ...(otherwise ? { ELSE: chain(...otherwise) } : {}) },
  });
export const repeat = (times: number, ...steps: Wrapped[]) =>
  block('controls_repeat_ext', { inputs: { TIMES: shadowNum(times), DO: chain(...steps) } });
export const whileDo = (cond: Wrapped, ...steps: Wrapped[]) =>
  block('controls_whileUntil', { fields: { MODE: 'WHILE' }, inputs: { BOOL: cond, DO: chain(...steps) } });
export const compare = (a: Wrapped, op: string, b: Wrapped) =>
  block('logic_compare', { fields: { OP: op }, inputs: { A: a, B: b } });
export const and = (a: Wrapped, b: Wrapped) => block('logic_operation', { fields: { OP: 'AND' }, inputs: { A: a, B: b } });
export const or = (a: Wrapped, b: Wrapped) => block('logic_operation', { fields: { OP: 'OR' }, inputs: { A: a, B: b } });
export const not = (a: Wrapped) => block('logic_negate', { inputs: { BOOL: a } });
export const plus = (a: Wrapped, b: Wrapped) => block('math_arithmetic', { fields: { OP: 'ADD' }, inputs: { A: a, B: b } });

// Paths
export const pathDef = (name: string, x: number, y: number, fields: Record<string, string>, steps: Wrapped) => ({
  type: 'sb_path_def',
  x,
  y,
  fields: { NAME: name, LOOP: 'repeat', GRAVITY: 'use', EDGES: 'stop', ...fields },
  inputs: { STEPS: steps },
});
export const move = (dir: string, n: number) => block('sb_path_move', { fields: { DIR: dir }, inputs: { N: shadowNum(n) } });
export const moveToward = (n: number, target = 'player') =>
  block('sb_path_move_toward', { fields: { TARGET: target }, inputs: { N: shadowNum(n) } });
export const canMove = (dir: string) => block('sb_path_can_move', { fields: { DIR: dir } });
export const pathSpeed = (speed: string) => block('sb_path_speed', { fields: { SPEED: speed } });
export const disappear = () => block('sb_path_disappear');

/** The paths every tutorial offers: back and forth, and up and down. */
export const PATROL = () => pathDef('patrol', 20, 20, {}, chain(move('left', 3), move('right', 3)));
export const UP_AND_DOWN = () => pathDef('up and down', 20, 180, { GRAVITY: 'ignore' }, chain(move('up', 2), move('down', 2)));
export const tutorialPaths = (...more: Record<string, unknown>[]) => workspace(PATROL(), UP_AND_DOWN(), ...more);

// ---------------------------------------------------------------- toolbox entries
// Ready-made blocks, so the right sprites and values are already chosen.

export const touchBlock = (b: string, a = 'player'): ToolboxEntry => ({ type: 'sb_when_touch', fields: { A: a, B: b } });
export const soundBlock = (id: string): ToolboxEntry => ({ type: 'sb_play_sound', fields: { SOUND: id } });
export const setPathBlock = (selector: string, path: string): ToolboxEntry => ({
  type: 'sb_set_path',
  fields: { PATH: path },
  inputs: { SPRITE: { block: { type: 'sb_all', fields: { SELECTOR: selector } } } },
});
export const numberBlock = (type: string, n: number): ToolboxEntry => ({ type, inputs: { N: shadowNum(n) } });
export const messageBlock = (t: string): ToolboxEntry => ({ type: 'sb_message', inputs: { TEXT: shadowText(t) } });
export const turnIntoBlock = (selector: string, asset: string): ToolboxEntry => ({
  type: 'sb_set_costume',
  fields: { ASSET: asset },
  inputs: { SPRITE: { block: { type: 'sb_all', fields: { SELECTOR: selector } } } },
});

// ---------------------------------------------------------------- checks

export const checks = (...criteria: Wrapped[]) =>
  workspace({ type: 'sbv_checks', x: 20, y: 20, inputs: { CRITERIA: chain(...criteria) } });
export const criterion = (description: string, check: Wrapped) =>
  block('sbv_criterion', { fields: { DESCRIPTION: description }, inputs: { CHECK: check } });
export const touched = (selector: string) => block('sbv_player_touched', { fields: { SELECTOR: selector } });
export const won = () => block('sbv_game_won');
export const restarted = () => block('sbv_level_restarted');
export const hasPath = (selector: string) => block('sbv_has_path', { fields: { SELECTOR: selector } });
export const followsPath = (selector: string, name: string) =>
  block('sbv_follows_path', { fields: { SELECTOR: selector, NAME: name } });
export const hasPlayer = () => block('sbv_has_player');
export const playerIs = (asset: string) => block('sbv_player_is', { fields: { ASSET: asset } });
export const count = (selector: string) => block('sbv_count', { fields: { SELECTOR: selector } });
export const value = (name: string) => block('sbv_value', { fields: { VALUE: name } });
export const variable = (name: string) => block('sbv_variable', { fields: { NAME: name } });
export const happened = (what: string) => block('sbv_happened', { fields: { WHAT: what } });
export const uses = (kind: string) => block('sbv_uses_block', { fields: { BLOCK: kind } });
export const spriteTouched = (a: string, b: string) => block('sbv_sprite_touched', { fields: { A: a, B: b } });

// ---------------------------------------------------------------- levels

/** Builds a level from rows of characters; `legend` maps each character to a sprite. */
export function mapLevel(
  name: string,
  mode: GameMode,
  background: string,
  player: string,
  rows: string[],
  legend: Record<string, string>,
  id = `level_${name.toLowerCase().replace(/\W+/g, '_')}`,
): Level {
  const level: Level = { ...newLevel(name, mode), id, rows: rows.length, cols: Math.max(...rows.map((r) => r.length)), background, player };
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (legend[ch]) level.cells[cellKey(x, y)] = legend[ch];
    }),
  );
  return level;
}
