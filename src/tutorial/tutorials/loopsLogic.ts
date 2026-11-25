// The Loops and Logic tutorial: a sweet factory. A repeat loop makes cookies, if/else decides between a stomp
// and a bump, a compare locks the door until you have enough cookies, "and" adds a second condition, and a
// while loop in a path makes the sour blocks pace their cakes.
import type { ToolboxEntry } from '../../blocks/toolbox';
import type { Tutorial } from '../types';
import {
  and,
  bounce,
  canMove,
  chain,
  changeScore,
  checks,
  compare,
  count,
  countOf,
  create,
  criterion,
  followsPath,
  happened,
  ifThen,
  isAbove,
  levelStartRule,
  mapLevel,
  message,
  messageBlock,
  move,
  num,
  other,
  pathDef,
  PATROL,
  randomSprite,
  removeOther,
  repeat,
  restart,
  restarted,
  score,
  setPath,
  setPathBlock,
  sound,
  soundBlock,
  spacesFrom,
  thisSprite,
  touchBlock,
  touchRule,
  tutorialPaths,
  UP_AND_DOWN,
  uses,
  value,
  whileDo,
  win,
  won,
  workspace,
} from '../build';

const SWEETS = {
  A: 'alien_pink',
  B: 'cake_choc_block',
  p: 'cake_pink',
  Y: 'block_angry',
  D: 'door_open',
  d: 'door_closed',
  l: 'lollipop',
  c: 'cotton_candy',
  g: 'gumball',
  k: 'candy_corn',
};

// Three pink cakes (15 squares) for cookies to appear on, each one reachable with a normal jump.
const FACTORY = [
  '....................',
  '....................',
  '............g.......',
  '..........ppppp.....',
  '......Y.............',
  '....ppppp.....ppppp.',
  '....................',
  '.A.l.....Y..c.....D.',
  'BBBBBBBBBBBBBBBBBBBB',
];
const LOCKED = FACTORY.map((row, y) => (y === 7 ? row.replace('D', 'd') : row));
const sweets = (rows: string[]) => [mapLevel('Sweet Factory', 'platformer', 'bg_candy', 'alien_pink', rows, SWEETS)];

// Rules and paths as each step ends.
const cookieRule = () => touchRule(20, 20, 'asset:cookie', removeOther(), changeScore(1), sound('coin'));
const openDoorRule = () => touchRule(20, 160, 'asset:door_open', win());
const startRule = (path: string, ...more: ReturnType<typeof repeat>[]) =>
  levelStartRule(380, 20, setPath('asset:block_angry', path), ...more);
const makeCookies = () => repeat(10, create('cookie', spacesFrom(1, 'up', randomSprite('asset:cake_pink'))));
const stompRule = () =>
  touchRule(
    20,
    280,
    'asset:block_angry',
    ifThen(isAbove(thisSprite(), other()), [removeOther(), bounce('1.5'), sound('stomp')], [sound('hurt'), restart()]),
  );
const enough = () => compare(score(), 'GTE', num(5));
const allStomped = () => compare(countOf('asset:block_angry'), 'EQ', num(0));
const doorRule = (condition: ReturnType<typeof compare>, text = 'Collect 5 cookies first!') =>
  touchRule(380, 200, 'asset:door_closed', ifThen(condition, [win()], [message(text)]));
const BOTH = 'Get 5 cookies and squash the sour blocks!';

const step1 = () => workspace(cookieRule(), openDoorRule(), startRule('patrol', makeCookies()));
const step2 = () => workspace(cookieRule(), openDoorRule(), startRule('patrol', makeCookies()), stompRule());
const step3 = () => workspace(cookieRule(), startRule('patrol', makeCookies()), stompRule(), doorRule(enough()));
const step4 = () =>
  workspace(cookieRule(), startRule('patrol', makeCookies()), stompRule(), doorRule(and(enough(), allStomped()), BOTH));
const step5 = () =>
  workspace(cookieRule(), startRule('pace', makeCookies()), stompRule(), doorRule(and(enough(), allStomped()), BOTH));
const PACE = () =>
  pathDef('pace', 20, 340, {}, chain(whileDo(canMove('right'), move('right', 1)), whileDo(canMove('left'), move('left', 1))));

const toolbox1: ToolboxEntry[] = [
  touchBlock('asset:cookie'),
  touchBlock('asset:door_open'),
  'sb_remove',
  'sb_win',
  soundBlock('coin'),
  'sb_when_level_starts',
  setPathBlock('asset:block_angry', 'patrol'),
  {
    type: 'sb_create',
    fields: { ASSET: 'cookie' },
    inputs: { LOC: spacesFrom(1, 'up', randomSprite('asset:cake_pink')) },
  },
  'controls_repeat_ext',
];
const toolbox2: ToolboxEntry[] = [
  ...toolbox1,
  touchBlock('asset:block_angry'),
  { type: 'controls_if', extraState: { hasElse: true } },
  'sb_is_above',
  { type: 'sb_bounce', fields: { HEIGHT: '1.5' }, inputs: { SPRITE: { block: { type: 'sb_player' } } } },
  'sb_restart_level',
];
const compareBlock: ToolboxEntry = {
  type: 'logic_compare',
  fields: { OP: 'GTE' },
  inputs: { B: { block: { type: 'math_number', fields: { NUM: 5 } } } },
};
const toolbox3: ToolboxEntry[] = [
  ...toolbox2.filter((e) => e !== toolbox1[1]),
  touchBlock('asset:door_closed'),
  compareBlock,
  'sb_score',
  messageBlock('Collect 5 cookies first!'),
];
const toolbox4: ToolboxEntry[] = [
  ...toolbox3,
  { type: 'logic_operation', fields: { OP: 'AND' } },
  {
    type: 'logic_compare',
    fields: { OP: 'EQ' },
    inputs: {
      A: { block: { type: 'sb_count', fields: { SELECTOR: 'asset:block_angry' } } },
      B: { block: { type: 'math_number', fields: { NUM: 0 } } },
    },
  },
];
const pathToolbox5: ToolboxEntry[] = ['sb_path_def', 'controls_whileUntil', 'sb_path_can_move', 'sb_path_move'];

const ASSETS = ['alien_pink', 'cake_choc_block', 'cake_pink', 'block_angry', 'cookie', 'door_open', 'lollipop', 'cotton_candy', 'gumball', 'candy_corn'];
const SOUNDS = ['coin', 'stomp', 'hurt', 'jump', 'win', 'pop'];

export const loopsLogic: Tutorial = {
  id: 'loops-logic',
  title: 'Loops and Logic',
  description: 'A sweet factory: repeat to make cookies, use if/else to stomp sour blocks, lock the door with a compare, and pace with a while loop.',
  thumbnail: 'tutorials/loops-logic.webp',
  after: ['variables', 'paths'],
  steps: [
    {
      title: 'Repeat',
      instructions: [
        'Welcome to the sweet factory! The cookie machine should put lots of cookies on the cakes. You could use 10 “create” blocks, but a loop is much quicker!',
        '1. Put “repeat 3 times” inside “when any level starts”, and change the 3 to a 10.',
        '2. Put “create cookie at 1 spaces up of a random pink cake sprite” inside the loop.',
        '3. Run the game. Collect the cookies, then go through the door. Run it again: are the cookies in the same places?',
      ],
      assets: ASSETS,
      sounds: SOUNDS,
      levels: sweets(FACTORY),
      main: workspace(cookieRule(), openDoorRule(), startRule('patrol')),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox1 },
      validation: checks(
        criterion('You use a repeat loop.', uses('controls_repeat_ext')),
        criterion('Lots of cookies appear.', compare(count('asset:cookie'), 'GTE', num(5))),
        criterion('You collect 5 cookies.', compare(value('score'), 'GTE', num(5))),
        criterion('You go through the door.', won()),
      ),
      solution: { main: step1() },
    },
    {
      title: 'If … else',
      instructions: [
        'Sour blocks are walking around. Jump on top of one to squash it, but if one bumps into you, you start over!',
        '1. Add “when the player touches angry block”. Put “if … else” inside.',
        '2. Put “this sprite is above other sprite” into the “if” hole.',
        '3. Under “do”, put “remove other sprite” and “make the player bounce”.',
        '4. Under “else”, put “restart level”.',
        '5. Run the game. Stomp a block, and let one bump into you too.',
      ],
      assets: ASSETS,
      sounds: SOUNDS,
      levels: sweets(FACTORY),
      main: step1(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox2 },
      validation: checks(
        criterion('You use an if … else.', uses('controls_if:else')),
        criterion('You stomp a sour block.', compare(count('asset:block_angry'), 'LT', num(2))),
        criterion('A sour block bumps you and the level starts over.', restarted()),
      ),
      solution: { main: step2() },
    },
    {
      title: 'Compare',
      instructions: [
        'The factory door is locked now. It should only open if you have at least 5 cookies.',
        '1. Add “when the player touches closed door”, with “if … else” inside.',
        '2. Put the “≥ 5” compare block in the “if” hole, and drag “score” into its empty side.',
        '3. Put “win the game” under “do”, and “show message” under “else”.',
        '4. Run the game. Try the door before and after you collect the cookies.',
      ],
      assets: [...ASSETS, 'door_closed'],
      sounds: SOUNDS,
      levels: sweets(LOCKED),
      main: workspace(cookieRule(), startRule('patrol', makeCookies()), stompRule()),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox3 },
      validation: checks(
        criterion('You use a compare.', uses('logic_compare')),
        criterion('The door says you need more cookies.', happened('message')),
        criterion('The door lets you out.', won()),
      ),
      solution: { main: step3() },
    },
    {
      title: 'And',
      instructions: [
        'The factory boss has a new rule: no leaving until every sour block is squashed, too!',
        '1. Drag the “and” block into the door’s “if” hole. Put your score compare in its left side.',
        '2. Put “number of angry block sprites = 0” in its right side.',
        '3. Change the door’s message so it says what to do now.',
        '4. Run the game. Collect 5 cookies and stomp both blocks, then try the door.',
      ],
      assets: [...ASSETS, 'door_closed'],
      sounds: SOUNDS,
      levels: sweets(LOCKED),
      main: step3(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox4 },
      validation: checks(
        criterion('You use “and”.', uses('logic_operation')),
        criterion('Every sour block is squashed.', compare(count('asset:block_angry'), 'EQ', num(0))),
        criterion('The door lets you out.', won()),
      ),
      solution: { main: step4() },
    },
    {
      title: 'While',
      instructions: [
        'The sour blocks only walk a little way. Let’s make them walk to the very end of their cake, then turn back, with “while” loops.',
        '1. On the new Paths tab, make a path called pace.',
        '2. Put “while” inside it, with “can move right” in its hole and “move right 1 spaces” inside it.',
        '3. Add a second “while” under the first, for moving left.',
        '4. On the Rules tab, set the angry blocks’ path to pace. Run the game!',
      ],
      assets: [...ASSETS, 'door_closed'],
      sounds: SOUNDS,
      levels: sweets(LOCKED),
      main: step4(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox4, paths: pathToolbox5 },
      tabs: { paths: true },
      validation: checks(
        criterion('You use a while loop.', uses('controls_whileUntil')),
        criterion('The sour blocks pace.', followsPath('asset:block_angry', 'pace')),
        criterion('The door lets you out.', won()),
      ),
      solution: { main: step5(), paths: workspace(PATROL(), UP_AND_DOWN(), PACE()) },
    },
  ],
};
