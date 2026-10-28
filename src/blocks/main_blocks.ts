// Blocks for the main workspace: events, sprites, game rules. Defined in standard Blockly JSON.
import * as Blockly from 'blockly/core';
import { javascriptGenerator, Order, type JavascriptGenerator } from 'blockly/javascript';

const DIRECTIONS = [
  ['left', 'left'],
  ['right', 'right'],
  ['up', 'up'],
  ['down', 'down'],
];

const KEYS = [
  ['space', 'space'],
  ['up arrow', 'up'],
  ['down arrow', 'down'],
  ['left arrow', 'left'],
  ['right arrow', 'right'],
  ['enter', 'enter'],
  ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('').map((c) => [c.toUpperCase(), c]),
];

const sprite = (name = 'SPRITE') => ({ type: 'input_value', name, check: ['Sprite', 'Array'] });
const selector = (name = 'SELECTOR', value = 'class:player') => ({ type: 'field_sprite_selector', name, value });
const number = (name: string) => ({ type: 'input_value', name, check: 'Number' });

export const MAIN_BLOCKS = [
  // ---------------------------------------------------------------- Events
  {
    type: 'sb_when_game_starts',
    message0: 'when game starts %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    style: 'event_blocks',
    tooltip: 'Runs once, after the first level has been set up.',
  },
  {
    type: 'sb_when_level_starts',
    message0: 'when a level starts %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    style: 'event_blocks',
    tooltip: 'Runs each time a level is loaded (including restarts).',
  },
  {
    type: 'sb_every_frame',
    message0: 'every frame %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    style: 'event_blocks',
    tooltip: 'Runs 60 times a second.',
  },
  {
    type: 'sb_when_key',
    message0: 'when %1 key %2 %3 %4',
    args0: [
      { type: 'field_dropdown', name: 'KEY', options: KEYS },
      { type: 'field_dropdown', name: 'MODE', options: [['is pressed', 'pressed'], ['is held down', 'down']] },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    style: 'event_blocks',
    tooltip: '“is pressed” runs once per key press; “is held down” runs every frame while held.',
  },
  {
    type: 'sb_when_touch',
    message0: 'when %1 touches %2 %3 %4',
    args0: [
      selector('A', 'class:player'),
      selector('B', 'class:collectible'),
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    style: 'event_blocks',
    tooltip: 'Runs once when two sprites start touching. Use “this sprite” and “other sprite” inside.',
  },
  {
    type: 'sb_while_touch',
    message0: 'while %1 is touching %2 %3 %4',
    args0: [
      selector('A', 'class:player'),
      selector('B', 'class:hazard'),
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    style: 'event_blocks',
    tooltip: 'Runs every frame while two sprites touch. Use “this sprite” and “other sprite” inside.',
  },
  {
    type: 'sb_when_clicked',
    message0: 'when %1 is clicked %2 %3',
    args0: [selector('SELECTOR', 'class:player'), { type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    style: 'event_blocks',
    tooltip: 'Runs when a sprite is clicked. Use “this sprite” inside.',
  },
  {
    type: 'sb_when_health_zero',
    message0: 'when health reaches 0 %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
    style: 'event_blocks',
    tooltip: 'Replaces the default (restart the level) when the player runs out of health.',
  },
  {
    type: 'sb_this_sprite',
    message0: 'this sprite',
    output: 'Sprite',
    style: 'event_blocks',
    extensions: ['sb_event_context'],
    tooltip: 'In a touch or click event: the first sprite.',
  },
  {
    type: 'sb_other_sprite',
    message0: 'other sprite',
    output: 'Sprite',
    style: 'event_blocks',
    extensions: ['sb_event_context'],
    tooltip: 'In a touch event: the sprite that was touched.',
  },

  // ---------------------------------------------------------------- Sprites
  {
    type: 'sb_create_at',
    message0: 'create %1 at %2',
    args0: [{ type: 'field_sprite_asset', name: 'ASSET' }, { type: 'field_grid_location', name: 'LOC', value: '0,0' }],
    previousStatement: null,
    nextStatement: null,
    style: 'sprite_blocks',
    tooltip: 'Creates a sprite at a grid location in the level.',
  },
  {
    type: 'sb_create_at_sprite',
    message0: 'create %1 at location of %2',
    args0: [{ type: 'field_sprite_asset', name: 'ASSET' }, sprite()],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'sprite_blocks',
    tooltip: 'Creates a sprite in the same grid space as each given sprite.',
  },
  {
    type: 'sb_create_relative',
    message0: 'create %1 %2 spaces %3 of %4',
    args0: [
      { type: 'field_sprite_asset', name: 'ASSET' },
      number('N'),
      { type: 'field_dropdown', name: 'DIR', options: DIRECTIONS },
      sprite(),
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'sprite_blocks',
    tooltip: 'Creates a sprite a number of grid spaces away from another sprite.',
  },
  {
    type: 'sb_remove',
    message0: 'remove %1',
    args0: [sprite()],
    previousStatement: null,
    nextStatement: null,
    style: 'sprite_blocks',
  },
  {
    type: 'sb_set_costume',
    message0: 'change %1 costume to %2',
    args0: [sprite(), { type: 'field_sprite_asset', name: 'ASSET' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'sprite_blocks',
    tooltip: 'Changes how a sprite looks. Its class (player, hazard…) changes to match the new costume.',
  },
  {
    type: 'sb_move_to',
    message0: 'move %1 to %2',
    args0: [sprite(), { type: 'field_grid_location', name: 'LOC', value: '0,0' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'sprite_blocks',
  },
  {
    type: 'sb_bounce',
    message0: 'make %1 bounce',
    args0: [sprite()],
    previousStatement: null,
    nextStatement: null,
    style: 'sprite_blocks',
  },
  {
    type: 'sb_face',
    message0: 'make %1 face %2',
    args0: [sprite(), { type: 'field_dropdown', name: 'DIR', options: DIRECTIONS }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'sprite_blocks',
  },
  {
    type: 'sb_set_gravity',
    message0: 'turn %1 gravity for %2',
    args0: [{ type: 'field_dropdown', name: 'ON', options: [['on', 'true'], ['off', 'false']] }, sprite()],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'sprite_blocks',
    tooltip: 'Platformer levels only. Players and hazards have gravity on by default.',
  },
  {
    type: 'sb_set_visible',
    message0: '%1 %2',
    args0: [{ type: 'field_dropdown', name: 'ON', options: [['show', 'true'], ['hide', 'false']] }, sprite()],
    previousStatement: null,
    nextStatement: null,
    style: 'sprite_blocks',
  },
  {
    type: 'sb_player',
    message0: 'the player',
    output: 'Sprite',
    style: 'sprite_blocks',
  },
  {
    type: 'sb_all',
    message0: 'all %1 sprites',
    args0: [selector('SELECTOR', 'class:hazard')],
    output: 'Array',
    style: 'sprite_blocks',
  },
  {
    type: 'sb_random_sprite',
    message0: 'a random %1 sprite',
    args0: [selector('SELECTOR', 'class:hazard')],
    output: 'Sprite',
    style: 'sprite_blocks',
  },
  {
    type: 'sb_count',
    message0: 'number of %1 sprites',
    args0: [selector('SELECTOR', 'class:collectible')],
    output: 'Number',
    style: 'sprite_blocks',
  },
  {
    type: 'sb_grid_pos',
    message0: 'grid %1 of %2',
    args0: [{ type: 'field_dropdown', name: 'AXIS', options: [['x', 'x'], ['y', 'y']] }, sprite()],
    output: 'Number',
    style: 'sprite_blocks',
  },
  {
    type: 'sb_is_above',
    message0: '%1 is above %2',
    args0: [sprite('A'), sprite('B')],
    inputsInline: true,
    output: 'Boolean',
    style: 'sprite_blocks',
    tooltip: 'True when the first sprite is landing on (or standing over) the second one.',
  },
  {
    type: 'sb_is_touching',
    message0: '%1 is touching %2',
    args0: [sprite(), selector('SELECTOR', 'class:hazard')],
    inputsInline: true,
    output: 'Boolean',
    style: 'sprite_blocks',
  },
  {
    type: 'sb_on_ground',
    message0: '%1 is on the ground',
    args0: [sprite()],
    output: 'Boolean',
    style: 'sprite_blocks',
  },
  {
    type: 'sb_exists',
    message0: '%1 exists',
    args0: [sprite()],
    output: 'Boolean',
    style: 'sprite_blocks',
  },

  // ---------------------------------------------------------------- Paths (main workspace)
  {
    type: 'sb_set_path',
    message0: 'set %1 path to %2',
    args0: [sprite(), { type: 'field_path', name: 'PATH' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'path_blocks',
    tooltip: 'Starts a path on the sprite(s). The path runs on its own; code keeps going right away.',
  },
  {
    type: 'sb_stop_path',
    message0: 'stop %1 path',
    args0: [sprite()],
    previousStatement: null,
    nextStatement: null,
    style: 'path_blocks',
  },
  {
    type: 'sb_set_speed',
    message0: 'set %1 path speed to %2',
    args0: [sprite(), number('SPEED')],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'path_blocks',
    tooltip: 'Path movement speed: 1 is slow, 2 is normal, 4 is fast.',
  },

  // ---------------------------------------------------------------- Game
  {
    type: 'sb_change_score',
    message0: 'change score by %1',
    args0: [number('N')],
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
  },
  {
    type: 'sb_set_score',
    message0: 'set score to %1',
    args0: [number('N')],
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
  },
  { type: 'sb_score', message0: 'score', output: 'Number', style: 'game_blocks' },
  {
    type: 'sb_change_health',
    message0: 'change health by %1',
    args0: [number('N')],
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
    tooltip: 'Losing health makes the player flash and ignore damage for a moment.',
  },
  {
    type: 'sb_set_health',
    message0: 'set health to %1',
    args0: [number('N')],
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
  },
  { type: 'sb_health', message0: 'health', output: 'Number', style: 'game_blocks' },
  {
    type: 'sb_next_level',
    message0: 'go to next level',
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
    tooltip: 'Loads the next level, or wins the game after the last level.',
  },
  {
    type: 'sb_goto_level',
    message0: 'go to level %1',
    args0: [number('N')],
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
  },
  {
    type: 'sb_restart_level',
    message0: 'restart level',
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
  },
  { type: 'sb_level_number', message0: 'level number', output: 'Number', style: 'game_blocks' },
  { type: 'sb_win', message0: 'win the game', previousStatement: null, style: 'game_blocks' },
  { type: 'sb_lose', message0: 'game over', previousStatement: null, style: 'game_blocks' },
  {
    type: 'sb_message',
    message0: 'show message %1',
    args0: [{ type: 'input_value', name: 'TEXT' }],
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
  },
  {
    type: 'sb_play_sound',
    message0: 'play sound %1',
    args0: [{ type: 'field_sound', name: 'SOUND' }],
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
  },
  {
    type: 'sb_builtin_sound',
    message0: 'set sound for %1 to %2',
    args0: [
      {
        type: 'field_dropdown',
        name: 'WHICH',
        options: [
          ['player jump', 'jump'],
          ['falling out of the level', 'fall'],
          ['running out of health', 'outOfHealth'],
          ['winning', 'win'],
          ['game over', 'gameOver'],
        ],
      },
      { type: 'field_sound_or_none', name: 'SOUND', value: 'chime' },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
    tooltip: 'Changes a sound the game plays by itself. Defaults: jump, hurt, lose jingle, win jingle, lose jingle.',
  },
  {
    type: 'sb_set_background',
    message0: 'set background to %1',
    args0: [{ type: 'field_background', name: 'BG' }],
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
  },
  {
    type: 'sb_player_speed',
    message0: 'set player speed to %1',
    args0: [number('N')],
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
    tooltip: 'Default is 3.5.',
  },
  {
    type: 'sb_jump_height',
    message0: 'set jump height to %1 spaces',
    args0: [number('N')],
    previousStatement: null,
    nextStatement: null,
    style: 'game_blocks',
    tooltip: 'Default is 3.',
  },
];

const CONTEXT_PARENTS = ['sb_when_touch', 'sb_while_touch', 'sb_when_clicked', 'procedures_defnoreturn', 'procedures_defreturn'];

function registerExtensions(): void {
  if (Blockly.Extensions.isRegistered('sb_event_context')) return;
  Blockly.Extensions.register('sb_event_context', function (this: Blockly.Block) {
    this.setOnChange(function (this: Blockly.BlockSvg, e: Blockly.Events.Abstract) {
      if (!this.workspace || this.isInFlyout || e.isUiEvent) return;
      const root = this.getRootBlock();
      const ok =
        root === this ||
        CONTEXT_PARENTS.includes(root.type) &&
          !(this.type === 'sb_other_sprite' && root.type === 'sb_when_clicked');
      this.setWarningText(ok ? null : 'Use this block inside a “when … touches …” or “when … is clicked” event.');
    });
  });
}

type Gen = JavascriptGenerator;
const q = (s: unknown) => JSON.stringify(String(s ?? ''));
const val = (b: Blockly.Block, g: Gen, name: string, fallback = 'null') =>
  g.valueToCode(b, name, Order.NONE) || fallback;
const num = (b: Blockly.Block, g: Gen, name: string) => val(b, g, name, '0');
const loc = (b: Blockly.Block) => String(b.getFieldValue('LOC') ?? '0,0').split(',').map(Number);

function eventBody(b: Blockly.Block, g: Gen): string {
  return g.statementToCode(b, 'DO');
}

const generators: Record<string, (b: Blockly.Block, g: Gen) => string | [string, Order]> = {
  sb_when_game_starts: (b, g) => `$g.on('start', function () {\n${eventBody(b, g)}});\n`,
  sb_when_level_starts: (b, g) => `$g.on('levelStart', function () {\n${eventBody(b, g)}});\n`,
  sb_every_frame: (b, g) => `$g.on('tick', function () {\n${eventBody(b, g)}});\n`,
  sb_when_health_zero: (b, g) => `$g.on('healthZero', function () {\n${eventBody(b, g)}});\n`,
  sb_when_key: (b, g) =>
    `$g.onKey(${q(b.getFieldValue('KEY'))}, ${q(b.getFieldValue('MODE'))}, function () {\n${eventBody(b, g)}});\n`,
  sb_when_touch: (b, g) =>
    `$g.onTouch(${q(b.getFieldValue('A'))}, ${q(b.getFieldValue('B'))}, 'start', function () {\n${eventBody(b, g)}});\n`,
  sb_while_touch: (b, g) =>
    `$g.onTouch(${q(b.getFieldValue('A'))}, ${q(b.getFieldValue('B'))}, 'while', function () {\n${eventBody(b, g)}});\n`,
  sb_when_clicked: (b, g) => `$g.onClick(${q(b.getFieldValue('SELECTOR'))}, function () {\n${eventBody(b, g)}});\n`,
  sb_this_sprite: () => [`$g.ctx('this')`, Order.FUNCTION_CALL],
  sb_other_sprite: () => [`$g.ctx('other')`, Order.FUNCTION_CALL],

  sb_create_at: (b) => {
    const [x, y] = loc(b);
    return `$g.spawn(${q(b.getFieldValue('ASSET'))}, ${x}, ${y});\n`;
  },
  sb_create_at_sprite: (b, g) => `$g.spawnAt(${q(b.getFieldValue('ASSET'))}, ${val(b, g, 'SPRITE')});\n`,
  sb_create_relative: (b, g) =>
    `$g.spawnRelative(${q(b.getFieldValue('ASSET'))}, ${val(b, g, 'SPRITE')}, ${q(b.getFieldValue('DIR'))}, ${num(b, g, 'N')});\n`,
  sb_remove: (b, g) => `$g.remove(${val(b, g, 'SPRITE')});\n`,
  sb_set_costume: (b, g) => `$g.setCostume(${val(b, g, 'SPRITE')}, ${q(b.getFieldValue('ASSET'))});\n`,
  sb_move_to: (b, g) => {
    const [x, y] = loc(b);
    return `$g.moveTo(${val(b, g, 'SPRITE')}, ${x}, ${y});\n`;
  },
  sb_bounce: (b, g) => `$g.bounce(${val(b, g, 'SPRITE')});\n`,
  sb_face: (b, g) => `$g.face(${val(b, g, 'SPRITE')}, ${q(b.getFieldValue('DIR'))});\n`,
  sb_set_gravity: (b, g) => `$g.setGravity(${val(b, g, 'SPRITE')}, ${b.getFieldValue('ON')});\n`,
  sb_set_visible: (b, g) => `$g.setVisible(${val(b, g, 'SPRITE')}, ${b.getFieldValue('ON')});\n`,
  sb_player: () => ['$g.player()', Order.FUNCTION_CALL],
  sb_all: (b) => [`$g.find(${q(b.getFieldValue('SELECTOR'))})`, Order.FUNCTION_CALL],
  sb_random_sprite: (b) => [`$g.random(${q(b.getFieldValue('SELECTOR'))})`, Order.FUNCTION_CALL],
  sb_count: (b) => [`$g.count(${q(b.getFieldValue('SELECTOR'))})`, Order.FUNCTION_CALL],
  sb_grid_pos: (b, g) => [
    `$g.grid${String(b.getFieldValue('AXIS')).toUpperCase()}(${val(b, g, 'SPRITE')})`,
    Order.FUNCTION_CALL,
  ],
  sb_is_above: (b, g) => [`$g.isAbove(${val(b, g, 'A')}, ${val(b, g, 'B')})`, Order.FUNCTION_CALL],
  sb_is_touching: (b, g) => [
    `$g.isTouching(${val(b, g, 'SPRITE')}, ${q(b.getFieldValue('SELECTOR'))})`,
    Order.FUNCTION_CALL,
  ],
  sb_on_ground: (b, g) => [`$g.isOnGround(${val(b, g, 'SPRITE')})`, Order.FUNCTION_CALL],
  sb_exists: (b, g) => [`$g.exists(${val(b, g, 'SPRITE')})`, Order.FUNCTION_CALL],

  sb_set_path: (b, g) => `$g.setPath(${val(b, g, 'SPRITE')}, ${q(b.getFieldValue('PATH'))});\n`,
  sb_stop_path: (b, g) => `$g.stopPath(${val(b, g, 'SPRITE')});\n`,
  sb_set_speed: (b, g) => `$g.setSpeed(${val(b, g, 'SPRITE')}, ${num(b, g, 'SPEED')});\n`,

  sb_change_score: (b, g) => `$g.changeScore(${num(b, g, 'N')});\n`,
  sb_set_score: (b, g) => `$g.setScore(${num(b, g, 'N')});\n`,
  sb_score: () => ['$g.getScore()', Order.FUNCTION_CALL],
  sb_change_health: (b, g) => `$g.changeHealth(${num(b, g, 'N')});\n`,
  sb_set_health: (b, g) => `$g.setHealth(${num(b, g, 'N')});\n`,
  sb_health: () => ['$g.getHealth()', Order.FUNCTION_CALL],
  sb_next_level: () => '$g.nextLevel();\n',
  sb_goto_level: (b, g) => `$g.gotoLevel(${num(b, g, 'N')});\n`,
  sb_restart_level: () => '$g.restartLevel();\n',
  sb_level_number: () => ['$g.levelNumber()', Order.FUNCTION_CALL],
  sb_win: () => '$g.win();\n',
  sb_lose: () => '$g.lose();\n',
  sb_message: (b, g) => `$g.message(${val(b, g, 'TEXT', "''")});\n`,
  sb_play_sound: (b) => `$g.sound(${q(b.getFieldValue('SOUND'))});\n`,
  sb_builtin_sound: (b) =>
    `$g.setBuiltinSound(${q(b.getFieldValue('WHICH'))}, ${q(b.getFieldValue('SOUND'))});\n`,
  sb_set_background: (b) => `$g.setBackground(${q(b.getFieldValue('BG'))});\n`,
  sb_player_speed: (b, g) => `$g.setPlayerSpeed(${num(b, g, 'N')});\n`,
  sb_jump_height: (b, g) => `$g.setJumpHeight(${num(b, g, 'N')});\n`,
};

export function registerMainBlocks(): void {
  registerExtensions();
  Blockly.common.defineBlocksWithJsonArray(MAIN_BLOCKS);
  Object.assign(javascriptGenerator.forBlock, generators);
  javascriptGenerator.addReservedWords('$g,$p,$paths');
  javascriptGenerator.INFINITE_LOOP_TRAP =
    'if (--$g.$budget < 0) throw new Error("A loop ran too long. Does it ever stop?");\n';
}
