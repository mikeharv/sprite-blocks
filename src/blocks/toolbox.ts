// Toolbox definitions and theme for the main and paths workspaces.
import * as Blockly from 'blockly/core';
import { defaultAsset } from './fields';
import { pathNames } from './path_registry';
import { state } from '../state';

const numberShadow = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const textShadow = (t: string) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
const player = { block: { type: 'sb_player' } };
const thisSprite = { block: { type: 'sb_this_sprite' } };
const otherSprite = { block: { type: 'sb_other_sprite' } };

export const COLORS = {
  event: '#d9a12c',
  sprite: '#3f8fd6',
  path: '#8a5cd1',
  game: '#2fa37f',
  logic: '#5b80a5',
  loops: '#5ba55b',
  math: '#5b67a5',
  text: '#5ba58c',
  lists: '#745ba5',
  variables: '#a55b80',
  functions: '#995ba5',
};

export const theme = Blockly.Theme.defineTheme('spriteblocks', {
  name: 'spriteblocks',
  base: Blockly.Themes.Classic,
  startHats: true,
  blockStyles: {
    event_blocks: { colourPrimary: COLORS.event },
    sprite_blocks: { colourPrimary: COLORS.sprite },
    path_blocks: { colourPrimary: COLORS.path },
    path_def_blocks: { colourPrimary: '#6b3fb5' },
    game_blocks: { colourPrimary: COLORS.game },
  },
  categoryStyles: {
    event_category: { colour: COLORS.event },
    sprite_category: { colour: COLORS.sprite },
    path_category: { colour: COLORS.path },
    game_category: { colour: COLORS.game },
  },
  componentStyles: {
    workspaceBackgroundColour: '#f6f7fb',
    toolboxBackgroundColour: '#ffffff',
    flyoutBackgroundColour: '#e9ecf4',
    flyoutOpacity: 1,
  },
  fontStyle: { family: 'system-ui, -apple-system, Segoe UI, sans-serif', size: 11 },
});

const gridShadow = (loc = '0,0') => ({ shadow: { type: 'sb_location', fields: { LOC: loc } } });
const locationOf = (sprite: object) => ({ ...gridShadow(), block: { type: 'sb_location_of', inputs: { SPRITE: sprite } } });

/** Sprite blocks with default assets that reflect the current project. */
function spriteCategory(): Blockly.utils.toolbox.ToolboxItemInfo[] {
  const any = defaultAsset();
  const item = defaultAsset('item') || any;
  return [
    { kind: 'label', text: 'Create' },
    { kind: 'block', type: 'sb_create', fields: { ASSET: item }, inputs: { LOC: gridShadow() } },
    {
      kind: 'block',
      type: 'sb_create',
      fields: { ASSET: item },
      inputs: {
        LOC: {
          ...gridShadow(),
          block: {
            type: 'sb_location_relative',
            fields: { DIR: 'right' },
            inputs: { N: numberShadow(2), SPRITE: { block: { type: 'sb_player' } } },
          },
        },
      },
    },
    { kind: 'block', type: 'sb_remove', inputs: { SPRITE: otherSprite } },
    {
      kind: 'block',
      type: 'sb_throw',
      fields: { ASSET: item, PATH: pathNames()[0] ?? '' },
      inputs: { SPRITE: player },
    },
    { kind: 'label', text: 'Locations' },
    { kind: 'block', type: 'sb_location', fields: { LOC: '0,0' } },
    { kind: 'block', type: 'sb_location_of', inputs: { SPRITE: player } },
    {
      kind: 'block',
      type: 'sb_location_relative',
      fields: { DIR: 'right' },
      inputs: { N: numberShadow(2), SPRITE: player },
    },
    { kind: 'label', text: 'Change' },
    { kind: 'block', type: 'sb_set_costume', fields: { ASSET: any }, inputs: { SPRITE: thisSprite } },
    { kind: 'block', type: 'sb_move_to_location', inputs: { SPRITE: player, LOC: gridShadow() } },
    { kind: 'block', type: 'sb_bounce', inputs: { SPRITE: player } },
    { kind: 'block', type: 'sb_face', inputs: { SPRITE: otherSprite } },
    { kind: 'block', type: 'sb_set_gravity', inputs: { SPRITE: otherSprite } },
    { kind: 'block', type: 'sb_set_visible', inputs: { SPRITE: otherSprite } },
    { kind: 'block', type: 'sb_make_player', inputs: { SPRITE: otherSprite } },
    { kind: 'label', text: 'Find' },
    { kind: 'block', type: 'sb_player' },
    { kind: 'block', type: 'sb_all' },
    { kind: 'block', type: 'sb_random_sprite' },
    { kind: 'block', type: 'sb_closest', inputs: { LOC: locationOf(player) } },
    { kind: 'block', type: 'sb_count' },
    { kind: 'block', type: 'sb_grid_pos', inputs: { SPRITE: player } },
    { kind: 'label', text: 'Check' },
    { kind: 'block', type: 'sb_is_above', inputs: { A: thisSprite, B: otherSprite } },
    { kind: 'block', type: 'sb_is_touching', inputs: { SPRITE: player } },
    { kind: 'block', type: 'sb_on_ground', inputs: { SPRITE: player } },
    { kind: 'block', type: 'sb_exists', inputs: { SPRITE: { block: { type: 'sb_random_sprite' } } } },
  ];
}

function pathsCategory(): Blockly.utils.toolbox.ToolboxItemInfo[] {
  const names = pathNames();
  const items: Blockly.utils.toolbox.ToolboxItemInfo[] = [
    { kind: 'label', text: 'Create and edit paths on the Paths tab' },
  ];
  for (const name of names.length ? names : ['']) {
    items.push({
      kind: 'block',
      type: 'sb_set_path',
      fields: { PATH: name },
      inputs: { SPRITE: { block: { type: 'sb_all', fields: { SELECTOR: 'class:character' } } } },
    });
  }
  items.push(
    { kind: 'block', type: 'sb_stop_path', inputs: { SPRITE: otherSprite } },
    { kind: 'block', type: 'sb_set_speed', inputs: { SPRITE: otherSprite, SPEED: numberShadow(4) } },
  );
  return items;
}

/** Game blocks; sound blocks default to the project's first sound. */
function gameCategory(): Blockly.utils.toolbox.ToolboxItemInfo[] {
  const sound = state.soundIds[0] ?? '';
  return [
    { kind: 'block', type: 'sb_change_score', inputs: { N: numberShadow(1) } },
    { kind: 'block', type: 'sb_set_score', inputs: { N: numberShadow(0) } },
    { kind: 'block', type: 'sb_score' },
    { kind: 'block', type: 'sb_change_health', inputs: { N: numberShadow(-1) } },
    { kind: 'block', type: 'sb_set_health', inputs: { N: numberShadow(3) } },
    { kind: 'block', type: 'sb_health' },
    { kind: 'block', type: 'sb_play_sound', fields: { SOUND: sound } },
    { kind: 'block', type: 'sb_builtin_sound', fields: { WHICH: 'win', SOUND: sound } },
    { kind: 'block', type: 'sb_message', inputs: { TEXT: textShadow('Hello!') } },
    { kind: 'block', type: 'sb_next_level' },
    { kind: 'block', type: 'sb_goto_level', inputs: { N: numberShadow(1) } },
    { kind: 'block', type: 'sb_restart_level' },
    { kind: 'block', type: 'sb_level_number' },
    { kind: 'block', type: 'sb_win' },
    { kind: 'block', type: 'sb_lose' },
    { kind: 'block', type: 'sb_set_background', fields: { BG: state.level?.background ?? 'bg_sky' } },
    { kind: 'block', type: 'sb_player_speed', inputs: { N: numberShadow(5) } },
    { kind: 'block', type: 'sb_jump_height', inputs: { N: numberShadow(4) } },
  ];
}

export function registerToolboxCallbacks(ws: Blockly.WorkspaceSvg): void {
  ws.registerToolboxCategoryCallback('SPRITES', () => spriteCategory());
  ws.registerToolboxCategoryCallback('PATHS', () => pathsCategory());
  ws.registerToolboxCategoryCallback('GAME', () => gameCategory());
}

export const MAIN_TOOLBOX: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Events',
      categorystyle: 'event_category',
      contents: [
        { kind: 'block', type: 'sb_when_game_starts' },
        { kind: 'block', type: 'sb_when_level_starts' },
        { kind: 'block', type: 'sb_when_touch' },
        { kind: 'block', type: 'sb_while_touch' },
        { kind: 'block', type: 'sb_this_sprite' },
        { kind: 'block', type: 'sb_other_sprite' },
        { kind: 'block', type: 'sb_when_key' },
        { kind: 'block', type: 'sb_when_clicked' },
        { kind: 'block', type: 'sb_every_frame' },
        { kind: 'block', type: 'sb_when_health_zero' },
      ],
    },
    { kind: 'category', name: 'Sprites', categorystyle: 'sprite_category', custom: 'SPRITES' },
    { kind: 'category', name: 'Paths', categorystyle: 'path_category', custom: 'PATHS' },
    { kind: 'category', name: 'Game', categorystyle: 'game_category', custom: 'GAME' },
    { kind: 'sep' },
    {
      kind: 'category',
      name: 'Logic',
      colour: COLORS.logic,
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Loops',
      colour: COLORS.loops,
      contents: [
        { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: numberShadow(3) } },
        {
          kind: 'block',
          type: 'controls_forEach',
          inputs: { LIST: { block: { type: 'sb_all', fields: { SELECTOR: 'class:character' } } } },
        },
        {
          kind: 'block',
          type: 'controls_for',
          inputs: { FROM: numberShadow(1), TO: numberShadow(5), BY: numberShadow(1) },
        },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_flow_statements' },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      colour: COLORS.math,
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic', inputs: { A: numberShadow(1), B: numberShadow(1) } },
        { kind: 'block', type: 'math_random_int', inputs: { FROM: numberShadow(1), TO: numberShadow(10) } },
        { kind: 'block', type: 'math_modulo', inputs: { DIVIDEND: numberShadow(10), DIVISOR: numberShadow(3) } },
        { kind: 'block', type: 'math_round', inputs: { NUM: numberShadow(3.1) } },
        { kind: 'block', type: 'math_single', inputs: { NUM: numberShadow(9) } },
      ],
    },
    {
      kind: 'category',
      name: 'Text',
      colour: COLORS.text,
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_length', inputs: { VALUE: textShadow('abc') } },
      ],
    },
    {
      kind: 'category',
      name: 'Lists',
      colour: COLORS.lists,
      contents: [
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_getIndex' },
        { kind: 'block', type: 'lists_isEmpty' },
      ],
    },
    { kind: 'category', name: 'Variables', colour: COLORS.variables, custom: 'VARIABLE' },
    { kind: 'category', name: 'Functions', colour: COLORS.functions, custom: 'PROCEDURE' },
  ],
};

/** Flyout for the paths workspace; the throw block defaults to a project item and a path. */
export function pathToolbox(): Blockly.utils.toolbox.ToolboxDefinition {
  const names = pathNames();
  const throwPath = names.includes('fly forward') ? 'fly forward' : (names[0] ?? '');
  return {
    kind: 'flyoutToolbox',
    contents: [
      { kind: 'block', type: 'sb_path_def', fields: { NAME: 'new path' } },
      { kind: 'block', type: 'sb_path_move', inputs: { N: numberShadow(1) } },
      { kind: 'block', type: 'sb_path_move_toward', inputs: { N: numberShadow(1) } },
      { kind: 'block', type: 'sb_path_jump', inputs: { N: numberShadow(2) } },
      { kind: 'block', type: 'sb_path_wait', inputs: { N: numberShadow(1) } },
      { kind: 'block', type: 'sb_path_face' },
      { kind: 'block', type: 'sb_path_speed' },
      {
        kind: 'block',
        type: 'sb_path_throw',
        fields: { ASSET: defaultAsset('item'), PATH: throwPath },
      },
      { kind: 'block', type: 'sb_path_disappear' },
      { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: numberShadow(3) } },
      { kind: 'block', type: 'controls_whileUntil' },
      { kind: 'block', type: 'controls_if' },
      { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
      { kind: 'block', type: 'sb_path_can_move' },
      { kind: 'block', type: 'sb_path_player_is' },
      { kind: 'block', type: 'sb_path_on_ground' },
      { kind: 'block', type: 'logic_negate' },
      { kind: 'block', type: 'logic_operation' },
      { kind: 'block', type: 'logic_compare' },
      { kind: 'block', type: 'math_random_int', inputs: { FROM: numberShadow(1), TO: numberShadow(3) } },
      { kind: 'block', type: 'math_number' },
    ],
  };
}
