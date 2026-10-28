// The built-in example game and the template for new projects.
import type { Level, Project } from './model';
import { cellKey, newLevel } from './model';

const DEFAULT_ASSETS = [
  'alien_green', 'hero', 'plane_blue',
  'brick', 'grass', 'plank', 'crate', 'wall',
  'coin', 'gem', 'heart',
  'jelly', 'drill', 'bat', 'spikes', 'ghost',
  'door_closed', 'tree', 'sign_arrow',
  'door_open', 'flag',
  'bg_sky', 'bg_forest', 'bg_floor_stone',
];

const shadowNum = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const shadowText = (t: string) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
const block = (type: string, rest: Record<string, unknown> = {}) => ({ block: { type, ...rest } });
const all = (selector: string) => block('sb_all', { fields: { SELECTOR: selector } });
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

function exampleMain(): object {
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
              block('sb_set_path', { fields: { PATH: 'patrol' }, inputs: { SPRITE: all('class:hazard') } }),
              block('sb_set_path', { fields: { PATH: 'bob' }, inputs: { SPRITE: all('asset:coin') } }),
            ),
          },
        },
        {
          type: 'sb_when_touch',
          x: 20,
          y: 140,
          fields: { A: 'class:player', B: 'class:hazard' },
          inputs: {
            DO: block('controls_if', {
              extraState: { hasElse: true },
              inputs: {
                IF0: block('sb_is_above', { inputs: { A: thisSprite, B: otherSprite() } }),
                DO0: chain(
                  block('sb_remove', { inputs: { SPRITE: otherSprite() } }),
                  block('sb_bounce', { inputs: { SPRITE: block('sb_this_sprite') } }),
                  block('sb_play_sound', { fields: { SOUND: 'stomp' } }),
                ),
                ELSE: chain(
                  block('sb_change_health', { inputs: { N: shadowNum(-1) } }),
                  block('sb_play_sound', { fields: { SOUND: 'hurt' } }),
                ),
              },
            }),
          },
        },
        {
          type: 'sb_when_touch',
          x: 460,
          y: 20,
          fields: { A: 'class:player', B: 'asset:coin' },
          inputs: {
            DO: chain(
              block('sb_remove', { inputs: { SPRITE: otherSprite() } }),
              block('sb_change_score', { inputs: { N: shadowNum(10) } }),
              block('sb_play_sound', { fields: { SOUND: 'coin' } }),
              block('controls_if', {
                inputs: {
                  IF0: block('logic_compare', {
                    fields: { OP: 'GTE' },
                    inputs: { A: block('sb_score'), B: shadowNum(50) },
                  }),
                  DO0: chain(
                    block('sb_create_at_sprite', {
                      fields: { ASSET: 'door_open' },
                      inputs: { SPRITE: all('asset:door_closed') },
                    }),
                    block('sb_remove', { inputs: { SPRITE: all('asset:door_closed') } }),
                    block('sb_play_sound', { fields: { SOUND: 'door' } }),
                    block('sb_message', { inputs: { TEXT: shadowText('The door is open!') } }),
                  ),
                },
              }),
            ),
          },
        },
        {
          type: 'sb_when_touch',
          x: 460,
          y: 340,
          fields: { A: 'class:player', B: 'class:goal' },
          inputs: { DO: chain(block('sb_next_level')) },
        },
      ],
    },
  };
}

function exampleLevel(): Level {
  const level: Level = { ...newLevel('Level 1'), cols: 50, rows: 8, background: 'bg_sky' };
  const put = (x: number, y: number, asset: string) => (level.cells[cellKey(x, y)] = asset);
  const pits = new Set([14, 15, 31, 32]);
  for (let x = 0; x < 50; x++) if (!pits.has(x)) put(x, 7, 'brick');
  for (let x = 7; x <= 12; x++) put(x, 4, 'brick');
  for (let x = 19; x <= 25; x++) put(x, 4, 'brick');
  for (let x = 35; x <= 40; x++) put(x, 3, 'brick');
  put(1, 6, 'alien_green');
  put(5, 6, 'tree');
  put(46, 6, 'sign_arrow');
  put(48, 6, 'door_closed');
  put(10, 3, 'jelly');
  put(22, 6, 'drill');
  put(38, 2, 'jelly');
  for (const [x, y] of [[4, 5], [14, 4], [22, 2], [31, 4], [43, 5]]) put(x, y, 'coin');
  return level;
}

export function exampleProject(): Project {
  return {
    format: 'sprite-blocks',
    version: 1,
    name: 'Coin Run',
    assets: [...DEFAULT_ASSETS],
    levels: [exampleLevel()],
    main: exampleMain(),
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
    levels: [{ ...newLevel('Level 1'), background: null }],
    main: {},
    paths: examplePaths(),
  };
}
