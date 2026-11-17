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
      { type: 'field_dropdown', name: 'DIR', options: [...DIRECTIONS, ['forward', 'forward']] },
      { type: 'input_value', name: 'N', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'path_action_blocks',
    tooltip:
      'Moves one grid space at a time. Stops early if an obstacle (or a platform edge) is in the way. ' +
      '“forward” is the way the sprite is facing.',
  },
  {
    type: 'sb_path_throw',
    message0: 'throw %1 with path %2',
    args0: [
      { type: 'field_sprite_asset', name: 'ASSET' },
      { type: 'field_path', name: 'PATH' },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'path_action_blocks',
    tooltip: 'Creates a sprite in the space in front of this one, facing the same way, and starts a path on it.',
  },
  {
    type: 'sb_path_disappear',
    message0: 'disappear',
    previousStatement: null,
    style: 'path_action_blocks',
    tooltip: 'Removes this sprite, for example when a thrown sprite has gone far enough.',
  },
  {
    type: 'sb_path_move_toward',
    message0: 'move %1 spaces toward %2',
    args0: [
      { type: 'input_value', name: 'N', check: 'Number' },
      { type: 'field_sprite_selector', name: 'TARGET', value: 'player' },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'path_action_blocks',
    tooltip: 'Moves one space at a time toward the nearest matching sprite, such as the player or an open door.',
  },
  {
    type: 'sb_path_jump',
    message0: 'jump %1 spaces high',
    args0: [{ type: 'input_value', name: 'N', check: 'Number' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'path_action_blocks',
    tooltip: 'Platformer only: jumps straight up and waits until landing.',
  },
  {
    type: 'sb_path_wait',
    message0: 'wait %1 seconds',
    args0: [{ type: 'input_value', name: 'N', check: 'Number' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'path_action_blocks',
  },
  {
    type: 'sb_path_face',
    message0: 'face %1',
    args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRECTIONS }],
    previousStatement: null,
    nextStatement: null,
    style: 'path_action_blocks',
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
    style: 'path_action_blocks',
  },
  {
    type: 'sb_path_can_move',
    message0: 'can move %1',
    args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRECTIONS }],
    output: 'Boolean',
    style: 'path_sensing_blocks',
    tooltip: 'True if the next space that way is free (and not past a platform edge).',
  },
  {
    type: 'sb_path_player_is',
    message0: 'player is %1 of me',
    args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRECTIONS }],
    output: 'Boolean',
    style: 'path_sensing_blocks',
  },
  {
    type: 'sb_path_on_ground',
    message0: 'on the ground',
    output: 'Boolean',
    style: 'path_sensing_blocks',
  },
  {
    type: 'sb_path_position',
    message0: 'my %1',
    args0: [{ type: 'field_dropdown', name: 'AXIS', options: [['x', 'x'], ['y', 'y']] }],
    output: 'Number',
    style: 'path_sensing_blocks',
    tooltip: 'The space this sprite is in: x counts across from the left, y counts down from the top.',
  },
  {
    type: 'sb_path_player_position',
    message0: 'player %1',
    args0: [{ type: 'field_dropdown', name: 'AXIS', options: [['x', 'x'], ['y', 'y']] }],
    output: 'Number',
    style: 'path_sensing_blocks',
    tooltip: 'The space the player is in.',
  },
  {
    type: 'sb_path_player_distance',
    message0: 'spaces to the player',
    output: 'Number',
    style: 'path_sensing_blocks',
    tooltip: 'How many grid steps (across plus up or down) it is to the player.',
  },
];

/**
 * Generates path code. Paths, and functions defined on the paths workspace, become generator functions the
 * engine steps a frame at a time, so a function full of moves animates just like a path. Variables are declared
 * inside each path and function, so every sprite running a path has its own copies.
 */
class PathGenerator extends JavascriptGenerator {
  override init(ws: Blockly.Workspace): void {
    super.init(ws);
    delete this.definitions_['variables'];
  }

  /** Adds a function definition to the top of the generated code. */
  define(name: string, code: string): void {
    this.definitions_['%' + name] = code;
  }

  /** `var` declarations for the variables used inside a block, except `skip` (function parameters). */
  localVariables(block: Blockly.Block, skip: string[] = []): string {
    const names = new Set<string>();
    for (const b of block.getDescendants(false)) {
      for (const input of b.inputList) {
        for (const field of input.fieldRow) {
          const id = field instanceof Blockly.FieldVariable ? field.getValue() : null;
          if (id) names.add(this.getVariableName(id));
        }
      }
    }
    skip.forEach((name) => names.delete(name));
    return names.size ? `${this.INDENT}var ${[...names].join(', ')};\n` : '';
  }
}

export const pathGenerator = new PathGenerator('PathJS');

const n = (b: Blockly.Block, g: PathGenerator) => g.valueToCode(b, 'N', Order.NONE) || '0';
const dir = (b: Blockly.Block) => JSON.stringify(String(b.getFieldValue('DIR')));
const axis = (b: Blockly.Block) => JSON.stringify(String(b.getFieldValue('AXIS')));

/** Variable ids of a function definition's parameters, or of the arguments a function call passes. */
const parameters = (b: Blockly.Block) =>
  (b as Blockly.Block & { getVarModels(): Blockly.IVariableModel<Blockly.IVariableState>[] })
    .getVarModels()
    .map((model) => model.getId());

/** Defines a function as a generator taking the path context first, so it can move and wait. */
function procedureDef(b: Blockly.Block, g: PathGenerator): null {
  const name = g.getProcedureName(b.getFieldValue('NAME'));
  const params = parameters(b).map((v) => g.getVariableName(v));
  const body = g.statementToCode(b, 'STACK');
  const result = b.getInput('RETURN') ? g.valueToCode(b, 'RETURN', Order.NONE) : '';
  g.define(
    name,
    `function* ${name}(${['$p', ...params].join(', ')}) {\n${g.localVariables(b, params)}${body}` +
      (result ? `${g.INDENT}return ${result};\n` : '') +
      '}',
  );
  return null;
}

const procedureCall = (b: Blockly.Block, g: PathGenerator) => {
  const name = g.getProcedureName(b.getFieldValue('NAME'));
  const args = parameters(b).map((_, i) => g.valueToCode(b, 'ARG' + i, Order.NONE) || 'null');
  return `${name}(${['$p', ...args].join(', ')})`;
};

const generators: Record<string, (b: Blockly.Block, g: PathGenerator) => string | [string, Order] | null> = {
  sb_path_def: (b, g) => {
    const steps = g.statementToCode(b, 'STEPS');
    return (
      `$paths[${JSON.stringify(String(b.getFieldValue('NAME')))}] = {\n` +
      `  loop: ${b.getFieldValue('LOOP') === 'repeat'},\n` +
      `  ignoreGravity: ${b.getFieldValue('GRAVITY') === 'ignore'},\n` +
      `  edges: ${JSON.stringify(b.getFieldValue('EDGES'))},\n` +
      `  fn: function* ($p) {\n${g.prefixLines(g.localVariables(b) + steps, g.INDENT)}  },\n};\n`
    );
  },
  sb_path_move: (b, g) => `yield* $p.move(${dir(b)}, ${n(b, g)});\n`,
  sb_path_move_toward: (b, g) =>
    `yield* $p.moveToward(${JSON.stringify(String(b.getFieldValue('TARGET') ?? 'player'))}, ${n(b, g)});\n`,
  sb_path_jump: (b, g) => `yield* $p.jump(${n(b, g)});\n`,
  sb_path_wait: (b, g) => `yield* $p.wait(${n(b, g)});\n`,
  sb_path_throw: (b) =>
    `$p.throw(${JSON.stringify(String(b.getFieldValue('ASSET')))}, ${JSON.stringify(String(b.getFieldValue('PATH')))});\n`,
  sb_path_disappear: () => '$p.disappear();\nreturn;\n',
  sb_path_face: (b) => `$p.face(${dir(b)});\n`,
  sb_path_speed: (b) => `$p.setSpeed(${Number(b.getFieldValue('SPEED'))});\n`,
  sb_path_can_move: (b) => [`$p.canMove(${dir(b)})`, Order.FUNCTION_CALL],
  sb_path_player_is: (b) => [`($p.playerDirection() === ${dir(b)})`, Order.ATOMIC],
  sb_path_on_ground: () => ['$p.isOnGround()', Order.FUNCTION_CALL],
  sb_path_position: (b) => [`$p.position(${axis(b)})`, Order.FUNCTION_CALL],
  sb_path_player_position: (b) => [`$p.playerPosition(${axis(b)})`, Order.FUNCTION_CALL],
  sb_path_player_distance: () => ['$p.playerDistance()', Order.FUNCTION_CALL],
  procedures_defnoreturn: procedureDef,
  procedures_defreturn: procedureDef,
  procedures_callnoreturn: (b, g) => `yield* ${procedureCall(b, g)};\n`,
  procedures_callreturn: (b, g) => [`(yield* ${procedureCall(b, g)})`, Order.ATOMIC],
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
  // Standard blocks (loops, logic, math, variables) reuse the stock JavaScript generators.
  Object.assign(pathGenerator.forBlock, javascriptGenerator.forBlock, generators);
  pathGenerator.addReservedWords('$g,$p,$paths');
  pathGenerator.INFINITE_LOOP_TRAP = 'if ($p.trap()) yield;\n';
}

/** Compiles the paths workspace to a function body that returns a record of path definitions. */
export function compilePaths(ws: Blockly.Workspace): string {
  pathGenerator.init(ws);
  let code = '';
  for (const block of ws.getTopBlocks(true)) {
    if (!block.isEnabled()) continue;
    // Function definitions add themselves to the top of the code; paths add an entry to $paths.
    if (block.type.startsWith('procedures_def')) pathGenerator.blockToCode(block);
    else if (block.type === 'sb_path_def') code += pathGenerator.blockToCode(block) as string;
  }
  code = pathGenerator.finish(code);
  return `const $paths = {};\n${code}\nreturn $paths;\n`;
}
