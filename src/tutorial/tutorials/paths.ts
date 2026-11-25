// The Paths tutorial: a busy village. It starts by giving sprites the ready-made paths, then opens the Paths
// tab to build new ones: a square walk, faster and slower moves, a rat that chases, and one of the learner's own.
import type { ToolboxEntry } from '../../blocks/toolbox';
import type { Tutorial } from '../types';
import {
  chain,
  checks,
  compare,
  count,
  criterion,
  followsPath,
  hasPath,
  levelStartRule,
  mapLevel,
  move,
  moveToward,
  num,
  pathDef,
  pathSpeed,
  PATROL,
  plus,
  removeOther,
  restart,
  setPath,
  setPathBlock,
  sound,
  soundBlock,
  touchBlock,
  touched,
  touchRule,
  tutorialPaths,
  UP_AND_DOWN,
  uses,
  value,
  win,
  won,
  workspace,
  block,
} from '../build';

const VILLAGE = {
  P: 'ranger',
  K: 'chicken',
  V: 'villager',
  E: 'elder',
  r: 'rat',
  R: 'roof_red',
  B: 'roof_blue',
  w: 'well',
  p: 'pine',
  f: 'flowers_red',
  s: 'signpost',
};

const TOWN = [
  '..p.....p.....p.',
  '.RR..K.....BB...',
  '.RR........BB...',
  '.......V.....K..',
  '.P.....w......E.',
  '.........K......',
  '.BB.........RR..',
  '.BB...V.....RR..',
  '..f..s.p.....f..',
];
const RAT = TOWN.map((row, y) => (y === 5 ? '.........K..r...' : row));
const village = (rows: string[]) => [mapLevel('Busy Village', 'topdown', 'bg_floor_path', 'ranger', rows, VILLAGE)];

// Rules and paths as each step ends.
const baseRules = () => [
  touchRule(20, 20, 'asset:chicken', removeOther(), sound('pop')),
  touchRule(20, 140, 'asset:elder', win()),
  touchRule(20, 240, 'asset:villager', sound('hurt'), restart()),
];
const startRule = (villagerPath: string, ...more: ReturnType<typeof setPath>[]) =>
  levelStartRule(380, 20, setPath('asset:chicken', 'patrol'), setPath('asset:villager', villagerPath), ...more);
const ratRule = () => touchRule(20, 360, 'asset:rat', sound('hurt'), restart());

const SQUARE = (...first: ReturnType<typeof move>[]) =>
  pathDef('square', 320, 20, {}, chain(...first, move('right', 2), move('down', 2), move('left', 2), move('up', 2)));
const CHASE = () => pathDef('chase', 320, 240, {}, moveToward(1));
const FAST_PATROL = () =>
  pathDef('patrol', 20, 20, {}, chain(pathSpeed('4'), move('left', 3), move('right', 3)));
const wait = (n: number) => block('sb_path_wait', { inputs: { N: { shadow: { type: 'math_number', fields: { NUM: n } } } } });

const step1 = () => workspace(...baseRules(), startRule('up and down'));
const step2 = () => workspace(...baseRules(), startRule('square'));
const step4 = () => workspace(...baseRules(), startRule('square', setPath('asset:rat', 'chase')), ratRule());

const paths2 = () => workspace(PATROL(), UP_AND_DOWN(), SQUARE());
const paths3 = () => workspace(FAST_PATROL(), UP_AND_DOWN(), SQUARE(wait(1)));
const paths4 = () => workspace(FAST_PATROL(), UP_AND_DOWN(), SQUARE(wait(1)), CHASE());

const baseToolbox: ToolboxEntry[] = [
  touchBlock('asset:chicken'),
  touchBlock('asset:elder'),
  touchBlock('asset:villager'),
  'sb_remove',
  'sb_win',
  'sb_restart_level',
  soundBlock('pop'),
];
const toolbox1: ToolboxEntry[] = [
  ...baseToolbox,
  'sb_when_level_starts',
  setPathBlock('asset:chicken', 'patrol'),
  setPathBlock('asset:villager', 'up and down'),
];
const toolbox4: ToolboxEntry[] = [...toolbox1, setPathBlock('asset:rat', 'patrol'), touchBlock('asset:rat')];
const pathToolbox2: ToolboxEntry[] = ['sb_path_def', 'sb_path_move'];
const pathToolbox3: ToolboxEntry[] = [...pathToolbox2, 'sb_path_speed', 'sb_path_wait'];
const pathToolbox4: ToolboxEntry[] = [...pathToolbox3, 'sb_path_move_toward'];

const ASSETS = ['ranger', 'chicken', 'villager', 'elder', 'roof_red', 'roof_blue', 'well', 'pine', 'flowers_red', 'signpost'];
const SOUNDS = ['pop', 'hurt', 'win', 'chime'];

export const paths: Tutorial = {
  id: 'paths',
  title: 'Paths',
  description: 'A busy village: give sprites paths, build your own on the Paths tab, speed them up, and make a rat that chases you.',
  thumbnail: 'tutorials/paths.webp',
  after: ['start'],
  steps: [
    {
      title: 'Get things moving',
      instructions: [
        'The chickens got out! Catch them all, then bring them back to the elder. But the village is too quiet. Let’s make it busy!',
        '1. Put “set all chicken sprites path to patrol” inside “when any level starts”.',
        '2. Add “set all villager sprites path to up and down” too.',
        '3. Run the game. Catch every chicken, then visit the elder. Don’t bump into the villagers!',
      ],
      assets: ASSETS,
      sounds: SOUNDS,
      levels: village(TOWN),
      main: workspace(...baseRules()),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox1 },
      validation: checks(
        criterion('The chickens walk around.', hasPath('asset:chicken')),
        criterion('The villagers walk around.', hasPath('asset:villager')),
        criterion('Every chicken is caught.', compare(count('asset:chicken'), 'EQ', num(0))),
        criterion('You visit the elder.', won()),
      ),
      solution: { main: step1() },
    },
    {
      title: 'Make a path',
      instructions: [
        'A path is a list of moves. Open the new Paths tab to see the two paths you used. Now let’s make one that walks in a square!',
        '1. On the Paths tab, drag out a “path” block. Click its name and call it square.',
        '2. Put four moves inside: right 2, down 2, left 2, and up 2.',
        '3. Back on the Rules tab, set the villagers’ path to square.',
        '4. Run the game and watch the villagers walk around the block.',
      ],
      assets: ASSETS,
      sounds: SOUNDS,
      levels: village(TOWN),
      main: step1(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox1, paths: pathToolbox2 },
      tabs: { paths: true },
      validation: checks(
        criterion('You make a new path.', compare(value('paths'), 'GTE', num(3))),
        criterion('The villagers walk in a square.', followsPath('asset:villager', 'square')),
      ),
      solution: { main: step2(), paths: paths2() },
    },
    {
      title: 'Fast and slow',
      instructions: [
        'Chickens are speedy, but villagers like to stop and chat.',
        '1. On the Paths tab, put “set speed to” at the top of the patrol path. Pick fast.',
        '2. Put “wait 1 seconds” at the top of the square path.',
        '3. Run the game. Can you still catch the chickens?',
      ],
      assets: ASSETS,
      sounds: SOUNDS,
      levels: village(TOWN),
      main: step2(),
      paths: paths2(),
      toolbox: { rules: toolbox1, paths: pathToolbox3 },
      tabs: { paths: true },
      validation: checks(
        criterion('You change a path’s speed.', uses('sb_path_speed')),
        criterion('A path waits.', uses('sb_path_wait')),
        criterion('Every chicken is caught.', compare(count('asset:chicken'), 'EQ', num(0))),
      ),
      solution: { main: step2(), paths: paths3() },
    },
    {
      title: 'Chase!',
      instructions: [
        'A sneaky rat has come to town, and it wants to chase you!',
        '1. On the Paths tab, make a new path called chase, with “move 1 spaces toward the player” inside.',
        '2. On the Rules tab, put “set all rat sprites path to” in “when any level starts”. Pick chase.',
        '3. Add “when the player touches rat” with “restart level” inside.',
        '4. Run the game. Can you get away from the rat?',
      ],
      assets: [...ASSETS, 'rat'],
      sounds: SOUNDS,
      levels: village(RAT),
      main: step2(),
      paths: paths3(),
      toolbox: { rules: toolbox4, paths: pathToolbox4 },
      tabs: { paths: true },
      validation: checks(
        criterion('The rat chases you.', followsPath('asset:rat', 'chase')),
        criterion('The rat catches you.', touched('asset:rat')),
      ),
      solution: { main: step4(), paths: paths4() },
    },
    {
      title: 'Make it yours',
      instructions: [
        'Now fill the village with your own ideas!',
        '1. Open the Level tab and paint a new character, like a cow or a farmer.',
        '2. Make a new path for it on the Paths tab. Try zig-zags, big loops, or a chase!',
        '3. Set its path when the level starts (click “cow” to pick your character), then run your game.',
      ],
      assets: [...ASSETS, 'rat', 'cow', 'farmer', 'farmer_girl', 'sheep'],
      sounds: SOUNDS,
      levels: village(RAT),
      main: step4(),
      paths: paths4(),
      toolbox: {
        rules: [...toolbox4, setPathBlock('asset:cow', 'patrol')],
        paths: [...pathToolbox4, 'sb_path_face', 'sb_path_disappear'],
      },
      tabs: { level: true, paths: true },
      validation: checks(
        criterion('You add a new character.', compare(
          count('class:character'),
          'GT',
          plus(plus(count('asset:chicken'), count('asset:villager')), plus(count('asset:elder'), count('asset:rat'))),
        )),
        criterion('You make another path.', compare(value('paths'), 'GTE', num(5))),
      ),
      solution: {
        main: workspace(...baseRules(), startRule('square', setPath('asset:rat', 'chase'), setPath('asset:cow', 'zigzag')), ratRule()),
        paths: workspace(
          ...paths4().blocks.blocks,
          pathDef('zigzag', 320, 340, {}, chain(move('right', 1), move('down', 1), move('right', 1), move('up', 1))),
        ),
        levels: village(RAT).map((l) => {
          l.cells['4,6'] = 'cow';
          return l;
        }),
      },
    },
  ],
};
