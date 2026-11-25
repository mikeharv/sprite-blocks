// Validation blocks for tutorial steps: a read-only workspace of criteria that is checked over and over while
// the game runs. Each criterion has a description the learner sees, and a condition built from the blocks
// below (combined with the usual and/or/not and compare blocks).
import * as Blockly from 'blockly/core';
import { JavascriptGenerator, javascriptGenerator, Order } from 'blockly/javascript';
import type { Game } from '../runtime/engine';
import { theme } from '../blocks/toolbox';

const STYLE = 'validation_blocks';

/** Numbers the checks can read from the running game. */
const VALUES: [string, string][] = [
  ['score', 'score'],
  ['health', 'health'],
  ['jump height', 'jumpHeight'],
  ['player speed', 'playerSpeed'],
  ['level number', 'level'],
  ['number of levels', 'levels'],
  ['level width', 'levelWidth'],
  ['level height', 'levelHeight'],
  ['number of paths', 'paths'],
];

/** Things the learner's blocks can do, recorded by the engine while the game runs. */
const HAPPENINGS: [string, string][] = [
  ['a sound played', 'sound'],
  ['a message showed', 'message'],
  ['a sprite was created', 'create'],
  ['a sprite was thrown', 'throw'],
  ['a sprite was removed', 'remove'],
  ['a sprite turned into another', 'turn into'],
  ['a sprite moved to a place', 'move to'],
  ['a sprite bounced', 'bounce'],
  ['gravity changed', 'gravity'],
  ['a new player was chosen', 'make player'],
  ['the background changed', 'background'],
  ['the level changed', 'change level'],
  ['the jump height changed', 'jump height'],
  ['the player speed changed', 'player speed'],
  ['a path speed changed', 'path speed'],
];

/** Kinds of block the learner's workspaces can be checked for. */
const BLOCK_KINDS: [string, string][] = [
  ['a repeat loop', 'controls_repeat_ext'],
  ['a count loop', 'controls_for'],
  ['a while loop', 'controls_whileUntil'],
  ['an if', 'controls_if'],
  ['an if … else', 'controls_if:else'],
  ['a compare', 'logic_compare'],
  ['and / or', 'logic_operation'],
  ['not', 'logic_negate'],
  ['a variable', 'variables_get'],
  ['set a variable', 'variables_set'],
  ['change a variable', 'math_change'],
  ['the score', 'sb_score'],
  ['change score', 'sb_change_score'],
  ['set score', 'sb_set_score'],
  ['the health', 'sb_health'],
  ['change health', 'sb_change_health'],
  ['set health', 'sb_set_health'],
  ['when health reaches 0', 'sb_when_health_zero'],
  ['show message', 'sb_message'],
  ['join text', 'text_join'],
  ['a path of your own', 'sb_path_def'],
  ['move toward', 'sb_path_move_toward'],
  ['can move', 'sb_path_can_move'],
  ['path speed', 'sb_path_speed'],
  ['wait', 'sb_path_wait'],
  ['when level … starts', 'sb_when_level_named_starts'],
  ['go to level', 'sb_goto_level'],
  ['next level', 'sb_next_level'],
];
const selector = (name: string, value: string) => ({ type: 'field_sprite_selector', name, value });

export const VALIDATION_BLOCKS = [
  {
    type: 'sbv_checks',
    message0: 'to finish this step %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'CRITERIA', check: 'Criterion' }],
    style: STYLE,
    tooltip: 'Every check inside has to come true while the game runs.',
  },
  {
    type: 'sbv_criterion',
    message0: 'check %1 %2 passes when %3',
    args0: [
      { type: 'field_input', name: 'DESCRIPTION', text: 'Describe what to do' },
      { type: 'input_dummy' },
      { type: 'input_value', name: 'CHECK', check: 'Boolean' },
    ],
    previousStatement: 'Criterion',
    nextStatement: 'Criterion',
    style: STYLE,
    tooltip: 'Turns green once its condition is true at any moment while the game runs.',
  },
  { type: 'sbv_has_player', message0: 'there is a player', output: 'Boolean', style: STYLE },
  {
    type: 'sbv_player_is',
    message0: 'the player is %1',
    args0: [{ type: 'field_sprite_asset', name: 'ASSET' }],
    output: 'Boolean',
    style: STYLE,
  },
  {
    type: 'sbv_count',
    message0: 'number of %1 sprites',
    args0: [selector('SELECTOR', 'class:character')],
    output: 'Number',
    style: STYLE,
    tooltip: 'Counts sprites in the level right now. Class choices such as “characters” leave out the player.',
  },
  {
    type: 'sbv_player_touched',
    message0: 'the player has touched %1',
    args0: [selector('SELECTOR', 'class:item')],
    output: 'Boolean',
    style: STYLE,
    tooltip: 'True once the player has touched one of these sprites since the game started.',
  },
  { type: 'sbv_game_won', message0: 'the game is won', output: 'Boolean', style: STYLE },
  {
    type: 'sbv_level_restarted',
    message0: 'a level has restarted',
    output: 'Boolean',
    style: STYLE,
    tooltip: 'True once a level has restarted since the game started.',
  },
  {
    type: 'sbv_value',
    message0: 'the %1',
    args0: [{ type: 'field_dropdown', name: 'VALUE', options: VALUES }],
    output: 'Number',
    style: STYLE,
    tooltip: 'A number from the running game.',
  },
  {
    type: 'sbv_variable',
    message0: 'variable %1',
    args0: [{ type: 'field_input', name: 'NAME', text: 'name' }],
    output: null,
    style: STYLE,
    tooltip: 'The value of one of the learner’s own variables, by name.',
  },
  {
    type: 'sbv_happened',
    message0: '%1',
    args0: [{ type: 'field_dropdown', name: 'WHAT', options: HAPPENINGS }],
    output: 'Boolean',
    style: STYLE,
    tooltip: 'True once one of the learner’s blocks has done this since the game started.',
  },
  {
    type: 'sbv_uses_block',
    message0: 'your blocks run %1',
    args0: [{ type: 'field_dropdown', name: 'BLOCK', options: BLOCK_KINDS }],
    output: 'Boolean',
    style: STYLE,
    tooltip: 'True once a block of this kind has run while the game plays (not just sat in the workspace).',
  },
  {
    type: 'sbv_sprite_touched',
    message0: '%1 has touched %2',
    args0: [selector('A', 'class:character'), selector('B', 'class:item')],
    output: 'Boolean',
    style: STYLE,
    tooltip: 'True once any of the first sprites has touched any of the second since the game started.',
  },
  {
    type: 'sbv_has_path',
    message0: '%1 sprites have a path',
    args0: [selector('SELECTOR', 'class:character')],
    output: 'Boolean',
    style: STYLE,
    tooltip: 'True when at least one of these sprites is following a path.',
  },
  {
    type: 'sbv_follows_path',
    message0: '%1 sprites follow path %2',
    args0: [selector('SELECTOR', 'class:character'), { type: 'field_input', name: 'NAME', text: 'path' }],
    output: 'Boolean',
    style: STYLE,
    tooltip: 'True when at least one of these sprites is following the path with this name.',
  },
];

class ValidationGenerator extends JavascriptGenerator {}
export const validationGenerator = new ValidationGenerator('Validation');

const sel = (b: Blockly.Block) => JSON.stringify(String(b.getFieldValue('SELECTOR')));
const generators: Record<string, (b: Blockly.Block, g: ValidationGenerator) => string | [string, Order]> = {
  sbv_checks: (b, g) => g.statementToCode(b, 'CRITERIA'),
  sbv_criterion: (b, g) => {
    const check = g.valueToCode(b, 'CHECK', Order.NONE) || 'false';
    return `$v.criterion(${JSON.stringify(String(b.getFieldValue('DESCRIPTION')))}, function () {\n  return ${check};\n});\n`;
  },
  sbv_has_player: () => ['$v.hasPlayer()', Order.FUNCTION_CALL],
  sbv_player_is: (b) => [`$v.playerIs(${JSON.stringify(String(b.getFieldValue('ASSET')))})`, Order.FUNCTION_CALL],
  sbv_count: (b) => [`$v.count(${sel(b)})`, Order.FUNCTION_CALL],
  sbv_player_touched: (b) => [`$v.playerTouched(${sel(b)})`, Order.FUNCTION_CALL],
  sbv_game_won: () => ['$v.won()', Order.FUNCTION_CALL],
  sbv_level_restarted: () => ['$v.restarted()', Order.FUNCTION_CALL],
  sbv_has_path: (b) => [`$v.hasPath(${sel(b)})`, Order.FUNCTION_CALL],
  sbv_follows_path: (b) => [`$v.followsPath(${sel(b)}, ${JSON.stringify(String(b.getFieldValue('NAME')))})`, Order.FUNCTION_CALL],
  sbv_value: (b) => [`$v.value(${JSON.stringify(String(b.getFieldValue('VALUE')))})`, Order.FUNCTION_CALL],
  sbv_variable: (b) => [`$v.variable(${JSON.stringify(String(b.getFieldValue('NAME')))})`, Order.FUNCTION_CALL],
  sbv_happened: (b) => [`$v.happened(${JSON.stringify(String(b.getFieldValue('WHAT')))})`, Order.FUNCTION_CALL],
  sbv_uses_block: (b) => [`$v.usesBlock(${JSON.stringify(String(b.getFieldValue('BLOCK')))})`, Order.FUNCTION_CALL],
  sbv_sprite_touched: (b) => [
    `$v.spriteTouched(${JSON.stringify(String(b.getFieldValue('A')))}, ${JSON.stringify(String(b.getFieldValue('B')))})`,
    Order.FUNCTION_CALL,
  ],
};

export function registerValidationBlocks(): void {
  Blockly.common.defineBlocksWithJsonArray(VALIDATION_BLOCKS);
  // Logic and math blocks reuse the standard JavaScript generators.
  Object.assign(validationGenerator.forBlock, javascriptGenerator.forBlock, generators);
  validationGenerator.addReservedWords('$v');
}

/** Generates the checking code for a step's validation workspace (Blockly JSON). */
export function compileValidation(saved: object): string {
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(saved, ws);
    return validationGenerator.workspaceToCode(ws);
  } finally {
    ws.dispose();
  }
}

export interface Criterion {
  description: string;
  test: () => boolean;
}

/** What the checks know about the learner's blocks (gathered when the game starts). */
export interface CheckContext {
  /** Whether a block of this kind has run in this game. */
  blockRan(type: string): boolean;
}

/** A kind of block in the learner's workspaces, and the block ids whose running means it ran. */
export interface BlockWitness {
  type: string;
  ids: string[];
}

/**
 * For every block in saved workspaces: which reported block ids show that it ran. A block inside an event
 * reports itself; a value block (a condition, a number, a variable) counts once the block it's plugged into runs;
 * an event, path or function counts once a block directly inside it runs. An if with an else also counts as
 * "controls_if:else".
 */
export function blockWitnesses(...saved: object[]): BlockWitness[] {
  const out: BlockWitness[] = [];
  const ws = new Blockly.Workspace();
  try {
    for (const json of saved) {
      ws.clear();
      Blockly.serialization.workspaces.load(json, ws);
      for (const block of ws.getAllBlocks(false)) {
        let host = block;
        while (host.outputConnection && host.getParent()) host = host.getParent()!;
        const ids = host.getParent()
          ? [host.id]
          : host.inputList
              .filter((input) => input.type === Blockly.inputs.inputTypes.STATEMENT)
              .map((input) => input.connection?.targetBlock()?.id)
              .filter((id): id is string => !!id);
        out.push({ type: block.type, ids });
        if (block.type === 'controls_if' && block.getInput('ELSE')) {
          out.push({ type: 'controls_if:else', ids });
        }
      }
    }
  } finally {
    ws.dispose();
  }
  return out;
}

/** What the checks can ask about the running game. */
export function validationApi(game: Game, ctx: CheckContext = { blockRan: () => false }) {
  const matches = (sel: string) => {
    if (sel === 'any') return game.touchedAssets.size > 0;
    const [kind, value] = sel.split(':');
    return kind === 'class' ? game.touchedClasses.has(value) : game.touchedAssets.has(value);
  };
  return {
    hasPlayer: () => !!game.api.player(),
    playerIs: (asset: string) => game.api.player()?.asset.id === asset,
    count: (sel: string) => game.api.count(sel),
    playerTouched: matches,
    won: () => game.finished === 'won',
    restarted: () => game.restarts > 0,
    hasPath: (sel: string) => game.api.find(sel).some((s) => !!s.path),
    followsPath: (sel: string, name: string) => game.api.find(sel).some((s) => s.path?.name === name),
    value: (name: string): number => {
      const level = game.levels[game.levelIndex];
      const values: Record<string, number> = {
        score: game.score,
        health: game.health,
        jumpHeight: game.jumpHeight,
        playerSpeed: game.playerSpeed,
        level: game.levelIndex + 1,
        levels: game.levels.length,
        levelWidth: level?.cols ?? 0,
        levelHeight: level?.rows ?? 0,
        paths: Object.keys(game.pathDefs).length,
      };
      return values[name] ?? 0;
    },
    variable: (name: string): unknown => {
      const vars = game.variables();
      return vars[name] ?? vars[name.replace(/\W/g, '_')];
    },
    happened: (what: string) => game.happened.has(what),
    usesBlock: (type: string) => ctx.blockRan(type),
    spriteTouched: (a: string, b: string) => game.touchedPairs.has(a + '|' + b),
  };
}

/** Turns checking code into a list of criteria that can be tested against the running game. */
export function buildCriteria(code: string, game: Game, ctx?: CheckContext): Criterion[] {
  const criteria: Criterion[] = [];
  const $v = { ...validationApi(game, ctx), criterion: (description: string, test: () => boolean) => criteria.push({ description, test }) };
  new Function('$v', code)($v);
  return criteria;
}

/** Shows a validation workspace read-only (no toolbox) in `host`. Returns a function that disposes it. */
export function showValidationWorkspace(host: HTMLElement, saved: object): () => void {
  const ws = Blockly.inject(host, {
    readOnly: true,
    theme,
    renderer: 'thrasos',
    sounds: false,
    move: { scrollbars: true, drag: true, wheel: true },
    zoom: { controls: true, wheel: false, startScale: 0.9 },
  });
  Blockly.serialization.workspaces.load(saved, ws);
  ws.scrollCenter();
  return () => ws.dispose();
}
