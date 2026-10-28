// Blocks for the paths workspace. Each `sb_path_def` compiles to a generator function the engine
// steps once per frame, so moves and waits can span many frames.
import * as Blockly from 'blockly/core';
import { JavascriptGenerator, javascriptGenerator, Order } from 'blockly/javascript';
import { uniquePathName } from './path_registry';

const DIRECTIONS = [
  ['left', 'left'],
  ['right', 'right'],
  ['up', 'up'],
  ['down', 'down'],
];

export const PATH_BLOCKS = [
  {
    type: 'sb_path_def',
    message0: 'path %1',
    args0: [{ type: 'field_input', name: 'NAME', text: 'path' }],
    message1: 'when finished %1',
    args1: [{ type: 'field_dropdown', name: 'LOOP', options: [['repeat', 'repeat'], ['stop', 'stop']] }],
    message2: '%1',
    args2: [{ type: 'field_dropdown', name: 'GRAVITY', options: [['use gravity', 'use'], ['ignore gravity', 'ignore']] }],
    message3: 'at platform edges %1',
    args3: [{ type: 'field_dropdown', name: 'EDGES', options: [['stay on', 'stop'], ['walk off', 'fall']] }],
    message4: '%1',
    args4: [{ type: 'input_statement', name: 'STEPS' }],
    style: 'path_def_blocks',
    extensions: ['sb_unique_path_name'],
    tooltip:
      'A movement path. “ignore gravity” lets a sprite fly (and move up/down) in platformer levels. ' +
      '“stay on” skips moves that would step off a platform edge.',
  },
  {
    type: 'sb_path_move',
    message0: 'move %1 %2 spaces',
    args0: [
      { type: 'field_dropdown', name: 'DIR', options: DIRECTIONS },
      { type: 'input_value', name: 'N', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'path_blocks',
    tooltip: 'Moves one grid space at a time. Stops early if an obstacle (or a platform edge) is in the way.',
  },
  {
    type: 'sb_path_move_toward',
    message0: 'move %1 spaces toward the player',
    args0: [{ type: 'input_value', name: 'N', check: 'Number' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'path_blocks',
  },
  {
    type: 'sb_path_jump',
    message0: 'jump %1 spaces high',
    args0: [{ type: 'input_value', name: 'N', check: 'Number' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'path_blocks',
    tooltip: 'Platformer only: jumps straight up and waits until landing.',
  },
  {
    type: 'sb_path_wait',
    message0: 'wait %1 seconds',
    args0: [{ type: 'input_value', name: 'N', check: 'Number' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'path_blocks',
  },
  {
    type: 'sb_path_face',
    message0: 'face %1',
    args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRECTIONS }],
    previousStatement: null,
    nextStatement: null,
    style: 'path_blocks',
  },
  {
    type: 'sb_path_speed',
    message0: 'set speed to %1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'SPEED',
        options: [['normal', '2'], ['slow', '1'], ['fast', '4'], ['very fast', '8']],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'path_blocks',
  },
  {
    type: 'sb_path_can_move',
    message0: 'can move %1',
    args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRECTIONS }],
    output: 'Boolean',
    style: 'path_blocks',
    tooltip: 'True if the next space that way is free (and not past a platform edge).',
  },
  {
    type: 'sb_path_player_is',
    message0: 'player is %1 of me',
    args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRECTIONS }],
    output: 'Boolean',
    style: 'path_blocks',
  },
  {
    type: 'sb_path_on_ground',
    message0: 'on the ground',
    output: 'Boolean',
    style: 'path_blocks',
  },
];

export const pathGenerator = new JavascriptGenerator('PathJS');

const n = (b: Blockly.Block, g: JavascriptGenerator) => g.valueToCode(b, 'N', Order.NONE) || '0';
const dir = (b: Blockly.Block) => JSON.stringify(String(b.getFieldValue('DIR')));

const generators: Record<string, (b: Blockly.Block, g: JavascriptGenerator) => string | [string, Order]> = {
  sb_path_def: (b, g) => {
    const steps = g.statementToCode(b, 'STEPS');
    return (
      `$paths[${JSON.stringify(String(b.getFieldValue('NAME')))}] = {\n` +
      `  loop: ${b.getFieldValue('LOOP') === 'repeat'},\n` +
      `  ignoreGravity: ${b.getFieldValue('GRAVITY') === 'ignore'},\n` +
      `  edges: ${JSON.stringify(b.getFieldValue('EDGES'))},\n` +
      `  fn: function* ($p) {\n${g.prefixLines(steps, g.INDENT)}  },\n};\n`
    );
  },
  sb_path_move: (b, g) => `yield* $p.move(${dir(b)}, ${n(b, g)});\n`,
  sb_path_move_toward: (b, g) => `yield* $p.moveToward('player', ${n(b, g)});\n`,
  sb_path_jump: (b, g) => `yield* $p.jump(${n(b, g)});\n`,
  sb_path_wait: (b, g) => `yield* $p.wait(${n(b, g)});\n`,
  sb_path_face: (b) => `$p.face(${dir(b)});\n`,
  sb_path_speed: (b) => `$p.setSpeed(${Number(b.getFieldValue('SPEED'))});\n`,
  sb_path_can_move: (b) => [`$p.canMove(${dir(b)})`, Order.FUNCTION_CALL],
  sb_path_player_is: (b) => [`($p.playerDirection() === ${dir(b)})`, Order.ATOMIC],
  sb_path_on_ground: () => ['$p.isOnGround()', Order.FUNCTION_CALL],
};

export function registerPathBlocks(): void {
  if (!Blockly.Extensions.isRegistered('sb_unique_path_name')) {
    Blockly.Extensions.register('sb_unique_path_name', function (this: Blockly.Block) {
      // New or pasted path definitions get a unique name.
      const field = this.getField('NAME') as Blockly.FieldTextInput;
      field.setValidator((name: string) => {
        const trimmed = name.trim().replace(/\s+/g, ' ');
        if (!trimmed) return null;
        return this.isInFlyout ? trimmed : uniquePathName(trimmed, this);
      });
    });
  }
  Blockly.common.defineBlocksWithJsonArray(PATH_BLOCKS);
  // Standard blocks (loops, logic, math) reuse the stock JavaScript generators.
  Object.assign(pathGenerator.forBlock, javascriptGenerator.forBlock, generators);
  pathGenerator.addReservedWords('$g,$p,$paths');
  pathGenerator.INFINITE_LOOP_TRAP = 'if ($p.trap()) yield;\n';
}

/** Compiles the paths workspace to a function body that returns a record of path definitions. */
export function compilePaths(ws: Blockly.Workspace): string {
  pathGenerator.init(ws);
  let code = '';
  for (const block of ws.getTopBlocks(true)) {
    if (block.type !== 'sb_path_def' || !block.isEnabled()) continue;
    code += pathGenerator.blockToCode(block) as string;
  }
  code = pathGenerator.finish(code);
  return `const $paths = {};\n${code}\nreturn $paths;\n`;
}
