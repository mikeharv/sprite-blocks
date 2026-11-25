// The Platformer Game tutorial: an alien jumps for coins and dodges jellies on the way to the flag.
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

const SPACE = { A: 'alien_green', F: 'flag', G: 'grass', P: 'plank', C: 'coin', J: 'jelly', B: 'alien_pink', X: 'crate', S: 'spring' };

const spaceStart = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.A............F.',
  'GGGGGGGGGGGGGGGG',
];
const spacePlatforms = [
  '................',
  '................',
  '..........C.....',
  '.........PPPP...',
  '.....C..........',
  '....PPPP........',
  '................',
  '.A......C....CF.',
  'GGGGGGGGGGGGGGGG',
];
// Two jellies, like the top-down game's two sheep: one on a plank, one on the ground.
const spaceEnemies = spacePlatforms.map((row, y) => (y === 4 ? '.....CJ.........' : y === 7 ? '.A......C..J..CF' : row));

const spaceLevel = (rows: string[]) => [mapLevel('Alien Adventure', 'platformer', 'bg_sky', 'alien_green', rows, SPACE)];

const spaceStep1Rules = () => workspace(touchRule(20, 20, 'asset:flag', win()));
const spaceStep2Rules = () =>
  workspace(touchRule(20, 20, 'asset:flag', win()), touchRule(20, 160, 'asset:coin', removeOther(), sound('coin')));
const spaceStep3Rules = () =>
  workspace(
    touchRule(20, 20, 'asset:flag', win()),
    touchRule(20, 160, 'asset:coin', removeOther(), sound('coin')),
    levelStartRule(380, 20, setPath('asset:jelly', 'patrol')),
    touchRule(380, 160, 'asset:jelly', sound('hurt'), restart()),
  );

const spaceToolbox1: ToolboxEntry[] = [touchBlock('asset:flag'), 'sb_win'];
const spaceToolbox2: ToolboxEntry[] = [...spaceToolbox1, touchBlock('asset:coin'), 'sb_remove', soundBlock('coin')];
const spaceToolbox3: ToolboxEntry[] = [
  ...spaceToolbox2,
  'sb_when_level_starts',
  setPathBlock('asset:jelly', 'patrol'),
  touchBlock('asset:jelly'),
  'sb_restart_level',
  soundBlock('hurt'),
];

export const platformer: Tutorial = {
  id: 'platformer',
  title: 'Platformer Game',
  description: 'A jumping game: run and jump to the flag, collect coins on the planks, and dodge the jellies.',
  thumbnail: 'tutorials/platformer.webp',
  start: true,
  steps: [
    {
      title: 'Reach the flag',
      instructions: [
        'Let’s make a jumping game! The green alien wants to reach the flag.',
        '1. Drag “when the player touches flag” into the big empty space.',
        '2. Snap “win the game” inside it.',
        '3. Press ▶ Run. Use the arrow keys to run, and the up arrow to jump.',
      ],
      assets: ['alien_green', 'grass', 'flag'],
      sounds: ['win', 'jump'],
      levels: spaceLevel(spaceStart),
      main: workspace(),
      paths: tutorialPaths(),
      toolbox: { rules: spaceToolbox1 },
      validation: checks(criterion('The alien touches the flag.', touched('asset:flag')), criterion('You win the game.', won())),
    },
    {
      title: 'Collect the coins',
      instructions: [
        'Shiny coins are hiding on the planks! Collect them all, then go to the flag.',
        '1. Add “when the player touches coin”.',
        '2. Put “remove other sprite” inside, so the coin you touch goes away. Add a sound too!',
        '3. Run the game. Jump up to every coin, then touch the flag.',
      ],
      assets: ['alien_green', 'grass', 'plank', 'coin', 'flag'],
      sounds: ['win', 'jump', 'coin'],
      levels: spaceLevel(spacePlatforms),
      main: spaceStep1Rules(),
      paths: tutorialPaths(),
      toolbox: { rules: spaceToolbox2 },
      validation: checks(
        criterion('The alien collects a coin.', touched('asset:coin')),
        criterion('Every coin is collected.', compare(count('asset:coin'), 'EQ', num(0))),
        criterion('You win the game.', won()),
      ),
    },
    {
      title: 'Dodge the jellies',
      instructions: [
        'Two jellies are here: one on the ground and one on a plank. Let’s make them move!',
        '1. Put “set all jelly sprites path to patrol” inside “when any level starts”. Try the other path too!',
        '2. Add “when the player touches jelly” with “restart level” inside.',
        '3. Run the game. Jump over the jellies! What happens if one touches you?',
      ],
      assets: ['alien_green', 'jelly', 'grass', 'plank', 'coin', 'flag'],
      sounds: ['win', 'jump', 'coin', 'hurt'],
      levels: spaceLevel(spaceEnemies),
      main: spaceStep2Rules(),
      paths: tutorialPaths(),
      toolbox: { rules: spaceToolbox3 },
      validation: checks(
        criterion('The jellies move.', hasPath('asset:jelly')),
        criterion('A jelly touches the alien.', touched('asset:jelly')),
        criterion('The level starts over.', restarted()),
      ),
    },
    {
      title: 'Make it yours',
      instructions: [
        'Now make the game your own!',
        '1. Open the Level tab. Click the ☆ next to the pink alien to make it the player. Paint it where the green alien is.',
        '2. Paint a new kind of monster, like the bat or the angry block. Add crates or a spring too, if you like.',
        '3. Run your game and play it.',
      ],
      assets: ['alien_green', 'alien_pink', 'jelly', 'bat', 'block_angry', 'grass', 'plank', 'crate', 'spring', 'coin', 'flag'],
      sounds: ['win', 'jump', 'coin', 'hurt'],
      levels: spaceLevel(spaceEnemies),
      main: spaceStep3Rules(),
      paths: tutorialPaths(),
      toolbox: { rules: spaceToolbox3 },
      tabs: { level: true },
      validation: checks(
        criterion('Your game has a new player.', and(hasPlayer(), not(playerIs('alien_green')))),
        criterion('A monster touches your player.', touched('class:character')),
        criterion(
          'You added a new monster.',
          compare(count('class:character'), 'GT', plus(count('asset:jelly'), count('asset:alien_green'))),
        ),
      ),
    },
  ],
};

