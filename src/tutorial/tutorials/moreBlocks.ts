// The More Blocks tutorial: a robot in a factory. Each step adds one new kind of block (jump height and
// speed, bouncing, sounds and messages, turning into, moving to a place, a new player and background), with
// no loops, logic or variables.
import type { ToolboxEntry } from '../../blocks/toolbox';
import type { Tutorial } from '../types';
import {
  bounce,
  checks,
  compare,
  count,
  criterion,
  gameStartRule,
  gridLoc,
  happened,
  jumpHeight,
  mapLevel,
  message,
  messageBlock,
  moveTo,
  num,
  numberBlock,
  other,
  player,
  playerIs,
  playerSpeed,
  removeOther,
  sound,
  soundBlock,
  touchBlock,
  touched,
  touchRule,
  turnInto,
  turnIntoBlock,
  tutorialPaths,
  value,
  win,
  won,
  workspace,
  block,
  all,
} from '../build';

const FACTORY = {
  R: 'robot',
  M: 'marble',
  X: 'crate_hazard',
  B: 'crate_blue',
  '=': 'girder',
  S: 'spring',
  G: 'gem',
  D: 'door_open',
  d: 'door_closed',
  K: 'key',
  P: 'pipe',
  W: 'warning_sign',
  s: 'siren_red',
  H: 'crane_hook',
  T: 'drill',
  E: 'exit_sign',
};

// A roof keeps the robot inside (sprites can go above a level's top row). The factory floor grows a little each step: a crate stack to jump, gems up high, a key, a wall and a pipe.
const ROOF = 'MMMMMMMMMMMMMMMMMMMMMMMM';
const crates = [
  ROOF,
  '........................',
  '........................',
  '........................',
  '..........XX............',
  '..........XX............',
  '..........XX............',
  '.R.W......XX.........sD.',
  'MMMMMMMMMMMMMMMMMMMMMMMM',
];
const gems = [
  ROOF,
  '..GGGG..................',
  '..====..................',
  '........................',
  '..........XX............',
  '..........XX............',
  '..........XX............',
  '.R.WS.....XX.........sD.',
  'MMMMMMMMMMMMMMMMMMMMMMMM',
];
const locked = gems.map((row, y) => (y === 3 ? '..........K.............' : y === 7 ? '.R.WS.....XX.........sd.' : row));
const walled = [
  ROOF,
  '..GGGG...........B.....H',
  '..====...........B......',
  '.................B......',
  '..........XX.....B......',
  '..........XX.....B......',
  '..........XX.....B......',
  '.R.WS.....XX...P.B...Esd',
  'MMMMMMMMMMMMMMMMMMMMMMMM',
].map((row, y) => (y === 3 ? '..........K......B......' : row));
const drill = walled.map((row, y) => (y === 7 ? '.R.WS..T..XX...P.B...Esd' : row));

const factory = (rows: string[]) => [mapLevel('Robot Factory', 'platformer', 'bg_factory', 'robot', rows, FACTORY)];

// Rules as each step ends.
const doorRule = (door = 'door_open') => touchRule(20, 20, 'asset:' + door, win());
const startRule = (...extra: ReturnType<typeof message>[]) => gameStartRule(20, 140, jumpHeight(5), playerSpeed(5), ...extra);
const gemRule = (...extra: ReturnType<typeof sound>[]) => touchRule(380, 20, 'asset:gem', removeOther(), ...extra);
const springRule = (...extra: ReturnType<typeof sound>[]) => touchRule(380, 160, 'asset:spring', bounce('8'), ...extra);
const keyRule = () =>
  touchRule(380, 300, 'asset:key', removeOther(), turnInto(all('asset:door_closed'), 'door_open'));
const pipeRule = () => touchRule(20, 300, 'asset:pipe', moveTo(player(), gridLoc('20,7')));

const step1 = () => workspace(doorRule(), startRule());
const step2 = () => workspace(doorRule(), startRule(), gemRule(), springRule());
const step3 = () =>
  workspace(doorRule(), startRule(message('Grab the gems!')), gemRule(sound('coin')), springRule(sound('jump')));
const step4 = () => workspace(doorRule(), startRule(message('Grab the gems!')), gemRule(sound('coin')), springRule(sound('jump')), keyRule());
const step5 = () =>
  workspace(
    doorRule(),
    startRule(message('Grab the gems!')),
    gemRule(sound('coin')),
    springRule(sound('jump')),
    keyRule(),
    pipeRule(),
  );
const step6 = () =>
  workspace(
    ...step5().blocks.blocks,
    touchRule(20, 440, 'asset:drill', block('sb_make_player', { inputs: { SPRITE: other() } }), block('sb_set_background', { fields: { BG: 'bg_night' } })),
  );

const toolbox1: ToolboxEntry[] = [
  touchBlock('asset:door_open'),
  'sb_win',
  'sb_when_game_starts',
  numberBlock('sb_jump_height', 5),
  numberBlock('sb_player_speed', 5),
];
const toolbox2: ToolboxEntry[] = [...toolbox1, touchBlock('asset:gem'), 'sb_remove', touchBlock('asset:spring'), 'sb_bounce'];
const toolbox3: ToolboxEntry[] = [...toolbox2, soundBlock('coin'), messageBlock('Grab the gems!')];
const toolbox4: ToolboxEntry[] = [...toolbox3, touchBlock('asset:key'), turnIntoBlock('asset:door_closed', 'door_open')];
const toolbox5: ToolboxEntry[] = [...toolbox4, touchBlock('asset:pipe'), 'sb_move_to_location'];
const toolbox6: ToolboxEntry[] = [
  ...toolbox5,
  touchBlock('asset:drill'),
  'sb_make_player',
  { type: 'sb_set_background', fields: { BG: 'bg_night' } },
];

const ASSETS = ['robot', 'marble', 'crate_hazard', 'warning_sign', 'siren_red', 'door_open'];
const SOUNDS = ['win', 'jump', 'coin', 'powerup', 'zap', 'chime', 'bell', 'door'];

export const moreBlocks: Tutorial = {
  id: 'more-blocks',
  title: 'More Blocks',
  description: 'A robot in a factory: jump higher, bounce on springs, add sounds, open doors, use a teleport pipe, and swap robots.',
  thumbnail: 'tutorials/more-blocks.webp',
  after: ['start'],
  steps: [
    {
      title: 'Super robot',
      instructions: [
        'This robot works in a busy factory. A tall stack of crates is in the way, and the robot can’t jump high enough!',
        '1. Drag “when game starts” into the empty space.',
        '2. Put “set jump height to 5 spaces” and “set player speed to 5” inside it.',
        '3. Press ▶ Run. Jump over the crates and go through the open door.',
      ],
      assets: ASSETS,
      sounds: SOUNDS,
      levels: factory(crates),
      main: workspace(doorRule()),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox1 },
      validation: checks(
        criterion('The robot jumps higher.', compare(value('jumpHeight'), 'GT', num(3))),
        criterion('The robot runs faster.', compare(value('playerSpeed'), 'GT', num(3.5))),
        criterion('You reach the door.', won()),
      ),
      solution: { main: step1() },
    },
    {
      title: 'Bouncy springs',
      instructions: [
        'Shiny gems sit on a high girder. Even a super robot can’t jump that high. Use the spring!',
        '1. Add “when the player touches spring”.',
        '2. Put “make the player bounce” inside. Click “a little” and pick “super high”.',
        '3. Run the game. Bounce up, grab every gem, then go through the door.',
      ],
      assets: [...ASSETS, 'girder', 'spring', 'gem'],
      sounds: SOUNDS,
      levels: factory(gems),
      main: workspace(doorRule(), startRule(), gemRule()),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox2 },
      validation: checks(
        criterion('The robot bounces on the spring.', happened('bounce')),
        criterion('Every gem is collected.', compare(count('asset:gem'), 'EQ', num(0))),
        criterion('You reach the door.', won()),
      ),
      solution: { main: step2() },
    },
    {
      title: 'Sounds and messages',
      instructions: [
        'Games are more fun with sounds! Let’s add some, and a message that tells players what to do.',
        '1. Put a “play sound” block in the gem rule and in the spring rule. Click the sound’s name to pick a different one.',
        '2. Put “show message” inside “when game starts”. Click the words to change them.',
        '3. Run the game and listen!',
      ],
      assets: [...ASSETS, 'girder', 'spring', 'gem'],
      sounds: SOUNDS,
      levels: factory(gems),
      main: step2(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox3 },
      validation: checks(
        criterion('A sound plays.', happened('sound')),
        criterion('A message shows.', happened('message')),
        criterion('You reach the door.', won()),
      ),
      solution: { main: step3() },
    },
    {
      title: 'Locked door',
      instructions: [
        'Oh no, the door is closed! The key is on top of the crates.',
        '1. Add “when the player touches key”, with “remove other sprite” inside.',
        '2. Put “turn all closed door sprites into open door” in the same rule.',
        '3. Run the game. Get the key, then go through the door.',
      ],
      assets: [...ASSETS, 'girder', 'spring', 'gem', 'key', 'door_closed'],
      sounds: SOUNDS,
      levels: factory(locked),
      main: step3(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox4 },
      validation: checks(
        criterion('The robot gets the key.', touched('asset:key')),
        criterion('The door opens.', happened('turn into')),
        criterion('You go through the door.', won()),
      ),
      solution: { main: step4() },
    },
    {
      title: 'Teleport pipe',
      instructions: [
        'A wall of blue crates goes all the way up. Nobody can jump over it! The pipe can take you to the other side.',
        '1. Add “when the player touches pipe”.',
        '2. Put “move the player to” inside. Click the place (the numbers) and pick a square on the other side of the wall.',
        '3. Run the game. Get the key, then jump into the pipe!',
      ],
      assets: [...ASSETS, 'girder', 'spring', 'gem', 'key', 'door_closed', 'pipe', 'crate_blue', 'exit_sign', 'crane_hook'],
      sounds: SOUNDS,
      levels: factory(walled),
      main: step4(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox5 },
      validation: checks(
        criterion('The pipe moves the robot.', happened('move to')),
        criterion('You go through the door.', won()),
      ),
      solution: { main: step5() },
    },
    {
      title: 'Robot swap',
      instructions: [
        'A drill bot wants to help! Touch it to take control of it.',
        '1. Add “when the player touches drill bot”.',
        '2. Put “make other sprite the player” inside.',
        '3. Add “set background to” in the same rule, and pick a new sky.',
        '4. Run the game and finish it as the drill bot!',
      ],
      assets: [...ASSETS, 'girder', 'spring', 'gem', 'key', 'door_closed', 'pipe', 'crate_blue', 'exit_sign', 'crane_hook', 'drill'],
      sounds: SOUNDS,
      levels: factory(drill),
      main: step5(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox6 },
      validation: checks(
        criterion('The drill bot is the player.', playerIs('drill')),
        criterion('The background changes.', happened('background')),
        criterion('You go through the door.', won()),
      ),
      solution: { main: step6() },
    },
  ],
};
