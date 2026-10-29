// The built-in example games and the template for new projects.
import type { Level, Project } from './model';
import { cellKey, newLevel } from './model';

const shadowNum = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const shadowText = (t: string) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
const block = (type: string, rest: Record<string, unknown> = {}) => ({ block: { type, ...rest } });
const all = (selector: string) => block('sb_all', { fields: { SELECTOR: selector } });
const sound = (id: string) => block('sb_play_sound', { fields: { SOUND: id } });
const touch = (x: number, y: number, a: string, b: string, ...steps: { block: Record<string, unknown> }[]) => ({
  type: 'sb_when_touch',
  x,
  y,
  fields: { A: a, B: b },
  inputs: { DO: chain(...steps) },
});
/** Location of every sprite matched by a selector, over a grid shadow. */
const locationOfAll = (selector: string) => ({
  shadow: { type: 'sb_location', fields: { LOC: '0,0' } },
  block: { type: 'sb_location_of', inputs: { SPRITE: all(selector) } },
});
const chain = (...blocks: { block: Record<string, unknown> }[]) => {
  for (let i = blocks.length - 2; i >= 0; i--) blocks[i].block.next = blocks[i + 1];
  return blocks[0];
};

function pathDef(
  name: string,
  x: number,
  y: number,
  opts: { loop?: string; gravity?: string; edges?: string },
  steps: { block: Record<string, unknown> },
) {
  return {
    type: 'sb_path_def',
    x,
    y,
    fields: { NAME: name, LOOP: opts.loop ?? 'repeat', GRAVITY: opts.gravity ?? 'use', EDGES: opts.edges ?? 'stop' },
    inputs: { STEPS: steps },
  };
}

const move = (dir: string, n: number) => block('sb_path_move', { fields: { DIR: dir }, inputs: { N: shadowNum(n) } });

function examplePaths(): object {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        pathDef('patrol', 20, 20, {}, chain(move('left', 3), move('right', 3))),
        pathDef(
          'bob',
          20,
          200,
          { gravity: 'ignore' },
          chain(block('sb_path_speed', { fields: { SPEED: '1' } }), move('up', 1), move('down', 1)),
        ),
        pathDef('chase', 300, 20, {}, chain(block('sb_path_move_toward', { inputs: { N: shadowNum(1) } }))),
        pathDef(
          'fly square',
          300,
          160,
          { gravity: 'ignore' },
          chain(move('right', 2), move('down', 2), move('left', 2), move('up', 2)),
        ),
        pathDef(
          'fly forward',
          580,
          280,
          { loop: 'stop', gravity: 'ignore', edges: 'fall' },
          chain(
            block('sb_path_speed', { fields: { SPEED: '4' } }),
            move('forward', 20),
            block('sb_path_disappear'),
          ),
        ),
        pathDef(
          'wall to wall',
          580,
          20,
          {},
          chain(
            block('controls_whileUntil', {
              fields: { MODE: 'WHILE' },
              inputs: {
                BOOL: block('sb_path_can_move', { fields: { DIR: 'right' } }),
                DO: move('right', 1),
              },
            }),
            block('controls_whileUntil', {
              fields: { MODE: 'WHILE' },
              inputs: {
                BOOL: block('sb_path_can_move', { fields: { DIR: 'left' } }),
                DO: move('left', 1),
              },
            }),
          ),
        ),
      ],
    },
  };
}

function coinRunMain(): object {
  const thisSprite = block('sb_this_sprite');
  const otherSprite = () => block('sb_other_sprite');
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'sb_when_level_starts',
          x: 20,
          y: 20,
          inputs: {
            DO: chain(
              block('sb_set_path', { fields: { PATH: 'patrol' }, inputs: { SPRITE: all('class:character') } }),
              block('sb_set_path', { fields: { PATH: 'bob' }, inputs: { SPRITE: all('asset:coin') } }),
            ),
          },
        },
        touch(
          20,
          140,
          'player',
          'class:character',
          block('controls_if', {
            extraState: { hasElse: true },
            inputs: {
              IF0: block('sb_is_above', { inputs: { A: thisSprite, B: otherSprite() } }),
              DO0: chain(
                block('sb_remove', { inputs: { SPRITE: otherSprite() } }),
                block('sb_bounce', { fields: { HEIGHT: '1.5' }, inputs: { SPRITE: block('sb_this_sprite') } }),
                sound('stomp'),
              ),
              ELSE: chain(block('sb_change_health', { inputs: { N: shadowNum(-1) } }), sound('hurt')),
            },
          }),
        ),
        touch(
          20,
          380,
          'player',
          'asset:spring',
          block('sb_bounce', { fields: { HEIGHT: '5' }, inputs: { SPRITE: block('sb_player') } }),
          sound('pop'),
        ),
        touch(
          500,
          20,
          'player',
          'asset:coin',
          block('sb_remove', { inputs: { SPRITE: otherSprite() } }),
          block('sb_change_score', { inputs: { N: shadowNum(10) } }),
          sound('coin'),
          block('controls_if', {
            inputs: {
              IF0: block('logic_compare', {
                fields: { OP: 'GTE' },
                inputs: { A: block('sb_score'), B: shadowNum(50) },
              }),
              DO0: chain(
                block('sb_create', { fields: { ASSET: 'door_open' }, inputs: { LOC: locationOfAll('asset:door_closed') } }),
                block('sb_remove', { inputs: { SPRITE: all('asset:door_closed') } }),
                sound('door'),
                block('sb_message', { inputs: { TEXT: shadowText('The door is open!') } }),
              ),
            },
          }),
        ),
        touch(500, 380, 'player', 'asset:door_open', block('sb_next_level')),
      ],
    },
  };
}

function coinRunLevel(): Level {
  const level: Level = { ...newLevel('Level 1'), cols: 50, rows: 9, background: 'bg_sky', player: 'alien_green' };
  const put = (x: number, y: number, asset: string) => (level.cells[cellKey(x, y)] = asset);
  const pits = new Set([14, 15, 31, 32]);
  for (let x = 0; x < 50; x++) if (!pits.has(x)) put(x, 8, 'grass');
  for (let x = 7; x <= 12; x++) put(x, 5, 'plank');
  for (let x = 19; x <= 25; x++) put(x, 5, 'plank');
  for (let x = 35; x <= 40; x++) put(x, 4, 'mushroom_top');
  put(1, 7, 'alien_green');
  put(5, 7, 'tree');
  put(17, 7, 'spring');
  put(46, 7, 'sign_arrow');
  put(48, 7, 'door_closed');
  put(10, 4, 'jelly');
  put(22, 7, 'drill');
  put(38, 3, 'jelly');
  for (const [x, y] of [[4, 6], [14, 5], [22, 3], [31, 5], [43, 6]]) put(x, y, 'coin');
  return level;
}

export function exampleProject(): Project {
  return {
    format: 'sprite-blocks',
    version: 1,
    name: 'Coin Run',
    assets: [
      'alien_green', 'alien_pink', 'princess', 'jelly', 'drill', 'bat',
      'plank', 'cloud', 'mushroom_top', 'brick', 'grass', 'crate',
      'coin', 'gem', 'heart', 'spring', 'flag', 'door_closed', 'door_open', 'tree', 'sign_arrow',
    ],
    sounds: ['coin', 'jump', 'hurt', 'stomp', 'door', 'pop', 'win', 'lose'],
    levels: [coinRunLevel()],
    main: coinRunMain(),
    paths: examplePaths(),
  };
}

const MAGIC = { name: 'magic', id: 'var_magic' };
const setMagic = (on: boolean) =>
  block('variables_set', {
    fields: { VAR: { id: MAGIC.id } },
    inputs: { VALUE: block('logic_boolean', { fields: { BOOL: on ? 'TRUE' : 'FALSE' } }) },
  });

function gardenMain(): object {
  const otherSprite = () => block('sb_other_sprite');
  return {
    variables: [MAGIC],
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'sb_when_level_starts',
          x: 20,
          y: 20,
          inputs: {
            DO: chain(
              block('sb_set_path', { fields: { PATH: 'fly square' }, inputs: { SPRITE: all('asset:bat') } }),
              block('sb_set_path', { fields: { PATH: 'patrol' }, inputs: { SPRITE: all('asset:spider') } }),
              setMagic(false),
            ),
          },
        },
        touch(
          20,
          170,
          'player',
          'asset:gem',
          block('sb_remove', { inputs: { SPRITE: otherSprite() } }),
          block('sb_change_score', { inputs: { N: shadowNum(10) } }),
          sound('coin'),
          block('controls_if', {
            inputs: {
              IF0: block('logic_compare', {
                fields: { OP: 'EQ' },
                inputs: { A: block('sb_count', { fields: { SELECTOR: 'asset:gem' } }), B: shadowNum(0) },
              }),
              DO0: chain(
                block('sb_create', { fields: { ASSET: 'door_open' }, inputs: { LOC: locationOfAll('asset:door_closed') } }),
                block('sb_remove', { inputs: { SPRITE: all('asset:door_closed') } }),
                sound('door'),
                block('sb_message', { inputs: { TEXT: shadowText('The garden gate is open!') } }),
              ),
            },
          }),
        ),
        touch(
          20,
          420,
          'player',
          'asset:sunflower',
          block('sb_remove', { inputs: { SPRITE: otherSprite() } }),
          block('sb_change_score', { inputs: { N: shadowNum(5) } }),
          sound('chime'),
        ),
        touch(
          520,
          20,
          'player',
          'asset:chest',
          block('sb_set_costume', { fields: { ASSET: 'chest_open' }, inputs: { SPRITE: otherSprite() } }),
          setMagic(true),
          sound('powerup'),
          block('sb_message', { inputs: { TEXT: shadowText('A magic wand! Press X to cast sparkles.') } }),
        ),
        {
          type: 'sb_when_key',
          x: 520,
          y: 200,
          fields: { KEY: 'x', MODE: 'pressed' },
          inputs: {
            DO: block('controls_if', {
              inputs: {
                IF0: block('variables_get', { fields: { VAR: { id: MAGIC.id } } }),
                DO0: chain(
                  block('sb_throw', {
                    fields: { ASSET: 'sparkle', PATH: 'fly forward' },
                    inputs: { SPRITE: block('sb_player') },
                  }),
                  sound('zap'),
                ),
              },
            }),
          },
        },
        touch(
          520,
          360,
          'asset:sparkle',
          'class:character',
          block('sb_remove', { inputs: { SPRITE: otherSprite() } }),
          block('sb_remove', { inputs: { SPRITE: block('sb_this_sprite') } }),
          block('sb_change_score', { inputs: { N: shadowNum(5) } }),
          sound('pop'),
        ),
        touch(
          520,
          520,
          'player',
          'class:character',
          block('sb_change_health', { inputs: { N: shadowNum(-1) } }),
          sound('hurt'),
        ),
        touch(520, 640, 'player', 'asset:door_open', block('sb_next_level')),
      ],
    },
  };
}

function gardenLevel(): Level {
  const level: Level = {
    ...newLevel('The Garden', 'topdown'),
    cols: 24,
    rows: 14,
    background: 'bg_floor_grass',
    player: 'farmer_girl',
  };
  const put = (x: number, y: number, asset: string) => (level.cells[cellKey(x, y)] = asset);
  const hedge = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, 'hedge');
  };
  hedge(0, 0, 23, 0);
  hedge(0, 13, 23, 13);
  hedge(0, 0, 0, 13);
  hedge(23, 0, 23, 13);
  hedge(8, 1, 8, 8);
  hedge(4, 10, 14, 10);
  hedge(16, 4, 16, 12);
  hedge(17, 4, 20, 4);
  put(23, 7, 'door_closed');
  put(2, 2, 'farmer_girl');
  put(21, 2, 'chest');
  for (const [x, y] of [[5, 6], [12, 3], [11, 12], [19, 8], [21, 12]]) put(x, y, 'gem');
  for (const [x, y] of [[2, 12], [14, 7], [20, 1], [6, 2]]) put(x, y, 'sunflower');
  put(10, 6, 'bat');
  put(18, 9, 'bat');
  put(4, 8, 'spider');
  put(13, 1, 'tree_round');
  put(1, 6, 'toadstools');
  put(15, 12, 'flowers_red');
  put(22, 10, 'flowers_yellow');
  return level;
}

export function gardenProject(): Project {
  return {
    format: 'sprite-blocks',
    version: 1,
    name: 'Garden Gem Hunt',
    assets: [
      'farmer_girl', 'princess', 'adventurer', 'sheep', 'bat', 'spider',
      'hedge', 'fence', 'chest', 'chest_open',
      'gem', 'sunflower', 'sparkle', 'flowers_red', 'flowers_yellow', 'door_closed', 'door_open', 'tree_round', 'toadstools',
    ],
    sounds: ['coin', 'chime', 'powerup', 'zap', 'pop', 'hurt', 'door', 'win', 'lose'],
    levels: [gardenLevel()],
    main: gardenMain(),
    paths: examplePaths(),
  };
}
/** A new game starts empty: the player picks sprites on the Sprites tab and builds the level from them. */
export function blankProject(name = 'My Game'): Project {
  return {
    format: 'sprite-blocks',
    version: 1,
    name,
    assets: [],
    sounds: [],
    levels: [{ ...newLevel('Level 1'), background: null, color: '#9fd8f0' }],
    main: {},
    paths: examplePaths(),
  };
}
