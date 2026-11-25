// The Top-Down Game tutorial: a farm girl picks carrots in a hedge maze and dodges sheep.
import type { ToolboxEntry } from '../../blocks/toolbox';
import type { Tutorial } from '../types';
import {
  and,
  checks,
  compare,
  count,
  criterion,
  hasPath,
  hasPlayer,
  levelStartRule,
  mapLevel,
  not,
  num,
  playerIs,
  plus,
  removeOther,
  restart,
  restarted,
  setPath,
  setPathBlock,
  sound,
  soundBlock,
  touchBlock,
  touched,
  touchRule,
  tutorialPaths,
  win,
  won,
  workspace,
} from '../build';

const FARM = { G: 'farmer_girl', F: 'flag', H: 'hedge', C: 'carrot', S: 'sheep', W: 'cow', K: 'chicken', R: 'rock' };

const farmStart = [
  '................',
  '................',
  '................',
  '................',
  '..G..........F..',
  '................',
  '................',
  '................',
  '................',
];
const farmMaze = [
  'HHHHHHHHHHHHHHHH',
  'H....H.........H',
  'H..C.H..C......H',
  'H....H....H....H',
  'H.G..H....H..F.H',
  'H....H....H....H',
  'H.........H....H',
  'H......C..H.C..H',
  'HHHHHHHHHHHHHHHH',
];
const farmSheep = farmMaze.map((row, y) => (y === 6 ? 'H........SH...SH' : row));

const farmLevel = (rows: string[]) => [mapLevel('Carrot Patch', 'topdown', 'bg_floor_grass', 'farmer_girl', rows, FARM)];

const farmStep1Rules = () => workspace(touchRule(20, 20, 'asset:flag', win()));
const farmStep2Rules = () =>
  workspace(touchRule(20, 20, 'asset:flag', win()), touchRule(20, 160, 'asset:carrot', removeOther(), sound('coin')));
const farmStep3Rules = () =>
  workspace(
    touchRule(20, 20, 'asset:flag', win()),
    touchRule(20, 160, 'asset:carrot', removeOther(), sound('coin')),
    levelStartRule(380, 20, setPath('asset:sheep', 'patrol')),
    touchRule(380, 160, 'asset:sheep', sound('hurt'), restart()),
  );

const farmToolbox1: ToolboxEntry[] = [touchBlock('asset:flag'), 'sb_win'];
const farmToolbox2: ToolboxEntry[] = [...farmToolbox1, touchBlock('asset:carrot'), 'sb_remove', soundBlock('coin')];
const farmToolbox3: ToolboxEntry[] = [
  ...farmToolbox2,
  'sb_when_level_starts',
  setPathBlock('asset:sheep', 'patrol'),
  touchBlock('asset:sheep'),
  'sb_restart_level',
  soundBlock('hurt'),
];

export const topDown: Tutorial = {
  id: 'top-down',
  title: 'Top-Down Game',
  description: 'A top-down farm game: walk to the flag, pick carrots in a hedge maze, and dodge the sheep.',
  thumbnail: 'tutorials/top-down.webp',
  start: true,
  steps: [
    {
      title: 'Reach the flag',
      instructions: [
        'Let’s make a game! The farm girl wants to reach the flag.',
        '1. Drag “when the player touches flag” into the big empty space.',
        '2. Snap “win the game” inside it.',
        '3. Press ▶ Run. Use the arrow keys to walk to the flag.',
      ],
      assets: ['farmer_girl', 'flag'],
      sounds: ['win'],
      levels: farmLevel(farmStart),
      main: workspace(),
      paths: tutorialPaths(),
      toolbox: { rules: farmToolbox1 },
      validation: checks(criterion('The farm girl touches the flag.', touched('asset:flag')), criterion('You win the game.', won())),
    },
    {
      title: 'Pick the carrots',
      instructions: [
        'Carrots are growing in a hedge maze! Pick them all, then go to the flag.',
        '1. Add “when the player touches carrot”.',
        '2. Put “remove other sprite” inside, so the carrot you touch goes away. Add a sound too!',
        '3. Run the game. Pick every carrot, then touch the flag.',
      ],
      assets: ['farmer_girl', 'flag', 'hedge', 'carrot'],
      sounds: ['win', 'coin'],
      levels: farmLevel(farmMaze),
      main: farmStep1Rules(),
      paths: tutorialPaths(),
      toolbox: { rules: farmToolbox2 },
      validation: checks(
        criterion('The farm girl picks a carrot.', touched('asset:carrot')),
        criterion('Every carrot is picked.', compare(count('asset:carrot'), 'EQ', num(0))),
        criterion('You win the game.', won()),
      ),
    },
    {
      title: 'Watch out for sheep',
      instructions: [
        'Two sheep are standing in the way. Let’s make them walk around!',
        '1. Put “set all sheep sprites path to patrol” inside “when any level starts”. Try the other path too!',
        '2. Add “when the player touches sheep” with “restart level” inside.',
        '3. Run the game. What happens if a sheep bumps into you?',
      ],
      assets: ['farmer_girl', 'flag', 'hedge', 'carrot', 'sheep'],
      sounds: ['win', 'coin', 'hurt'],
      levels: farmLevel(farmSheep),
      main: farmStep2Rules(),
      paths: tutorialPaths(),
      toolbox: { rules: farmToolbox3 },
      validation: checks(
        criterion('The sheep walk around.', hasPath('asset:sheep')),
        criterion('The farm girl bumps into a sheep.', touched('asset:sheep')),
        criterion('The level starts over.', restarted()),
      ),
    },
    {
      title: 'Make it yours',
      instructions: [
        'Now make the game your own!',
        '1. Open the Level tab. Click the ☆ next to a new person or animal to make it the player. Paint it where the farm girl is.',
        '2. Paint a new character (not a sheep) into the maze. Add some flowers or rocks too, if you like.',
        '3. Run your game and play it.',
      ],
      assets: ['farmer_girl', 'farmer', 'adventurer', 'princess', 'cow', 'chicken', 'flag', 'hedge', 'rock', 'flowers_red', 'carrot', 'sheep'],
      sounds: ['win', 'coin', 'hurt'],
      levels: farmLevel(farmSheep),
      main: farmStep3Rules(),
      paths: tutorialPaths(),
      toolbox: { rules: farmToolbox3 },
      tabs: { level: true },
      validation: checks(
        criterion('Your game has a new player.', and(hasPlayer(), not(playerIs('farmer_girl')))),
        criterion('Your player bumps into another character.', touched('class:character')),
        criterion('You added a new character.', compare(count('class:character'), 'GT', plus(count('asset:sheep'), count('asset:farmer_girl')))),
      ),
    },
  ],
};

