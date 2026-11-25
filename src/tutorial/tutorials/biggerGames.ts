// The Bigger Games tutorial: a dungeon quest across several levels. It uses the full level editor: making a
// level bigger, adding a level, then rooms we built that the learner strings together with code (level-start
// rules, a secret door to another level), and finally a big level of their own.
import type { ToolboxEntry } from '../../blocks/toolbox';
import type { Level } from '../../model';
import type { Tutorial } from '../types';
import {
  all,
  and,
  checks,
  compare,
  count,
  criterion,
  gotoLevel,
  hasPath,
  mapLevel,
  message,
  messageBlock,
  namedLevelRule,
  nextLevel,
  num,
  removeOther,
  restart,
  setPath,
  setPathBlock,
  sound,
  soundBlock,
  touchBlock,
  touchRule,
  turnInto,
  tutorialPaths,
  uses,
  value,
  win,
  won,
  workspace,
} from '../build';

const DUNGEON = {
  N: 'knight',
  W: 'wall_stone',
  S: 'stairs',
  t: 'torch',
  r: 'rat',
  b: 'barrel',
  K: 'key',
  C: 'chest',
  D: 'door_wood',
  s: 'sword',
  h: 'shield',
  p: 'potion_green',
  g: 'ghost',
};
const room = (name: string, rows: string[]) => mapLevel(name, 'topdown', 'bg_floor_dungeon', 'knight', rows, DUNGEON);

// The Great Hall starts small, with its right side open; the first step makes it wider.
const HALL_SMALL = [
  'WWWWWWWWWWWWWWWW',
  'W..t.......t....',
  'W...............',
  'W.......s.......',
  'WN..............',
  'W.......h.......',
  'W...............',
  'W..t.......t....',
  'WWWWWWWWWWWWWWWW',
];
const HALL = [
  'WWWWWWWWWWWWWWWWWWWWWWWW',
  'W..t.......t.......t...W',
  'W......................W',
  'W.......s..............W',
  'WN....................SW',
  'W.......h..............W',
  'W......................W',
  'W..t.......t.......t...W',
  'WWWWWWWWWWWWWWWWWWWWWWWW',
];
const HALL_SECRET = HALL.map((row, y) => (y === 0 ? 'WWWWWWWWWWWWWWWWDWWWWWWW' : row));
const SECOND = [
  'WWWWWWWWWWWWWWWW',
  'W..............W',
  'W..............W',
  'W..............W',
  'WN............SW',
  'W..............W',
  'W..............W',
  'W..............W',
  'WWWWWWWWWWWWWWWW',
];
const CELLAR = [
  'WWWWWWWWWWWWWWWWWWWW',
  'WN....W.......W....W',
  'W.....W...r........W',
  'W..b..W.......W..r.W',
  'W.....W...WWWWW....W',
  'W..r......W........W',
  'W.........W.....b..W',
  'W....b....W......S.W',
  'WWWWWWWWWWWWWWWWWWWW',
];
const TREASURE = [
  'WWWWWWWWWWWWWWWW',
  'W..t.......t...W',
  'W....C...C.....W',
  'W..............W',
  'WN.....K.......W',
  'W..............W',
  'W....C...C.....W',
  'W..t.......t...W',
  'WWWWWWWWWWWWWWWW',
];
// One way to finish: a big throne room of the learner's own, with a ghost and a potion.
const THRONE = [
  'WWWWWWWWWWWWWWWWWWWWWWWW',
  'W..t.......t.......t...W',
  'W......................W',
  'W....g.................W',
  'W......................W',
  'WN..........p.........SW',
  'W......................W',
  'W..................g...W',
  'W......................W',
  'W......................W',
  'W..t.......t.......t...W',
  'WWWWWWWWWWWWWWWWWWWWWWWW',
];

const hall = (rows = HALL) => room('Great Hall', rows);
const rooms = (hallRows = HALL): Level[] => [hall(hallRows), room('Rat Cellar', CELLAR), room('Treasure Room', TREASURE)];
const CELLAR_ID = rooms()[1].id;
const TREASURE_ID = rooms()[2].id;

// Rules as each step ends.
const stairsRule = (action = nextLevel()) => touchRule(20, 20, 'asset:stairs', action);
const roomRules = (chest = win()) => [
  touchRule(20, 120, 'asset:rat', sound('hurt'), restart()),
  touchRule(20, 240, 'asset:key', removeOther(), turnInto(all('asset:chest'), 'chest_open'), sound('door')),
  touchRule(20, 380, 'asset:chest_open', chest),
];
const levelRules = () => [
  namedLevelRule(400, 20, CELLAR_ID, setPath('asset:rat', 'patrol')),
  namedLevelRule(400, 140, TREASURE_ID, message('Find the key!')),
];
const secretRule = () => touchRule(400, 260, 'asset:door_wood', gotoLevel(3));

const step3 = () => workspace(stairsRule(), ...roomRules(), ...levelRules());
const step4 = () => workspace(stairsRule(), ...roomRules(), ...levelRules(), secretRule());
const step5 = () => workspace(stairsRule(), ...roomRules(nextLevel()), ...levelRules(), secretRule());

const toolbox1: ToolboxEntry[] = [touchBlock('asset:stairs'), 'sb_win'];
const toolbox2: ToolboxEntry[] = [...toolbox1, 'sb_next_level'];
const toolbox3: ToolboxEntry[] = [
  ...toolbox2,
  touchBlock('asset:rat'),
  touchBlock('asset:key'),
  touchBlock('asset:chest_open'),
  'sb_remove',
  'sb_restart_level',
  soundBlock('door'),
  { type: 'sb_when_level_named_starts', fields: { LEVEL: CELLAR_ID } },
  setPathBlock('asset:rat', 'patrol'),
  messageBlock('Find the key!'),
];
const toolbox4: ToolboxEntry[] = [...toolbox3, touchBlock('asset:door_wood'), 'sb_goto_level'];

const ASSETS = ['knight', 'wall_stone', 'stairs', 'torch', 'sword', 'shield'];
const ROOM_ASSETS = [...ASSETS, 'rat', 'barrel', 'key', 'chest', 'chest_open', 'door_wood'];
const SOUNDS = ['door', 'hurt', 'coin', 'level', 'win'];
const tabs = { level: true };

export const biggerGames: Tutorial = {
  id: 'bigger-games',
  title: 'Bigger Games',
  description: 'A dungeon quest: make levels bigger, add new ones, and join rooms together with level rules and a secret door.',
  thumbnail: 'tutorials/bigger-games.webp',
  after: ['more-blocks'],
  steps: [
    {
      title: 'A bigger level',
      instructions: [
        'The knight’s quest starts in the Great Hall. But the hall is too small for the stairs! Let’s make it bigger.',
        '1. Open the Level tab. Change the Width from 16 to 24.',
        '2. Paint the stairs at the far right of the new space. Add some walls to finish the hall, if you like.',
        '3. Run the game. Walk across the big hall to the stairs.',
      ],
      assets: ASSETS,
      sounds: SOUNDS,
      levels: [hall(HALL_SMALL)],
      main: workspace(stairsRule(win())),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox1 },
      tabs,
      levelControls: true,
      validation: checks(
        criterion('The hall is wider.', compare(value('levelWidth'), 'GTE', num(20))),
        criterion('The hall has stairs.', compare(count('asset:stairs'), 'GT', num(0))),
        criterion('You reach the stairs.', won()),
      ),
      solution: { levels: [hall()] },
    },
    {
      title: 'Add a level',
      instructions: [
        'The stairs should lead down to a new level, not end the game.',
        '1. On the Level tab, click “+ Level”. Your new level is level 2.',
        '2. Paint the knight and some stairs in it. Add walls, monsters or treasure too!',
        '3. On the Rules tab, swap “win the game” for “go to next level”. (On the last level, it wins the game.)',
        '4. Run the game. Go down the stairs to level 2, then find its stairs.',
      ],
      assets: ASSETS,
      sounds: SOUNDS,
      levels: [hall()],
      main: workspace(stairsRule(win())),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox2 },
      tabs,
      levelControls: true,
      validation: checks(
        criterion('Your game has 2 levels.', compare(value('levels'), 'GTE', num(2))),
        criterion('You reach level 2.', compare(value('level'), 'GTE', num(2))),
        criterion('You finish the game.', won()),
      ),
      solution: { main: workspace(stairsRule()), levels: [hall(), room('Level 2', SECOND)] },
    },
    {
      title: 'Rooms with rules',
      instructions: [
        'We built the rest of the dungeon for you: a Rat Cellar and a Treasure Room. Look at them on the Level tab! Each room needs its own rules.',
        '1. Drag out “when level Rat Cellar starts”. Put “set all rat sprites path to patrol” inside, so rats only move in the cellar.',
        '2. Drag out another “when level … starts”. Click the level name and pick Treasure Room. Put “show message” inside.',
        '3. Run the game. Sneak past the rats, then find the treasure!',
      ],
      assets: ROOM_ASSETS,
      sounds: SOUNDS,
      levels: rooms(),
      main: workspace(stairsRule(), ...roomRules()),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox3 },
      tabs,
      levelControls: true,
      validation: checks(
        criterion('You use “when level … starts”.', uses('sb_when_level_named_starts')),
        criterion('The rats move.', hasPath('asset:rat')),
        criterion('You reach the Treasure Room.', compare(value('level'), 'GTE', num(3))),
        criterion('You open the treasure.', won()),
      ),
      solution: { main: step3() },
    },
    {
      title: 'Secret door',
      instructions: [
        'There’s a secret wooden door in the top wall of the Great Hall. It leads straight to the Treasure Room!',
        '1. Add “when the player touches wooden door”.',
        '2. Put “go to level 1” inside. Change the 1 to a 3, because the Treasure Room is level 3.',
        '3. Run the game. Take the secret door and skip the rats!',
      ],
      assets: ROOM_ASSETS,
      sounds: SOUNDS,
      levels: rooms(HALL_SECRET),
      main: step3(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox4 },
      tabs,
      levelControls: true,
      validation: checks(
        criterion('You use “go to level”.', uses('sb_goto_level')),
        criterion('The secret door takes you to the Treasure Room.', compare(value('level'), 'EQ', num(3))),
        criterion('You open the treasure.', won()),
      ),
      solution: { main: step4() },
    },
    {
      title: 'Your own level',
      instructions: [
        'Now add a big level of your own at the end of the quest!',
        '1. Click the Treasure Room on the Level tab, then click “+ Level”.',
        '2. Make your new level bigger, and pick a background. Paint the knight, stairs, walls and monsters.',
        '3. On the Rules tab, make the open chest “go to next level” instead of winning.',
        '4. Run the game and play the whole quest!',
      ],
      assets: [...ROOM_ASSETS, 'ghost', 'spirit', 'bat_dungeon', 'potion_green', 'brick_dark', 'gem'],
      sounds: SOUNDS,
      levels: rooms(HALL_SECRET),
      main: step4(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox4 },
      tabs,
      levelControls: true,
      validation: checks(
        criterion('Your game has 4 levels.', compare(value('levels'), 'GTE', num(4))),
        criterion(
          'You play your big new level.',
          and(compare(value('level'), 'GTE', num(4)), compare(value('levelWidth'), 'GT', num(16))),
        ),
        criterion('You finish the quest.', won()),
      ),
      solution: { main: step5(), levels: [...rooms(HALL_SECRET), room('Throne Room', THRONE)] },
    },
  ],
};
