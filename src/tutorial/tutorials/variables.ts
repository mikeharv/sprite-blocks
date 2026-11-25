// The Variables tutorial: harvest day on a farm. It starts with the game values (score, then health), shows a
// value in a message, and ends with a variable of the learner's own: a basket of vegetables.
import type { ToolboxEntry } from '../../blocks/toolbox';
import type { Tutorial } from '../types';
import {
  and,
  changeHealth,
  changeScore,
  changeVar,
  checks,
  compare,
  count,
  criterion,
  getVar,
  healthZeroRule,
  join,
  levelStartRule,
  MAKE_VARIABLE,
  mapLevel,
  message,
  messageBlock,
  num,
  numberBlock,
  removeOther,
  restart,
  score,
  setPath,
  setVar,
  sound,
  soundBlock,
  touchBlock,
  touched,
  touchRule,
  tutorialPaths,
  uses,
  value,
  variable,
  workspace,
  workspaceWithVars,
} from '../build';

const FARM = {
  F: 'farmer',
  f: 'fence',
  T: 'turnip',
  C: 'corn',
  H: 'hay_bale',
  R: 'rat',
  h: 'heart',
  E: 'elder',
  V: 'veg_crate',
  A: 'apple_bush',
  w: 'well',
  b: 'wheelbarrow',
};

// The whole field; earlier steps leave out what they don't use yet.
const FIELD = [
  'ffffffffffffffff',
  'f..T......A..T.f',
  'f.....T..H....hf',
  'f.F......H.....f',
  'f......R.H..T..f',
  'f..T...........f',
  'f..E...C...b...f',
  'f..w.....R...CVf',
  'ffffffffffffffff',
];
const without = (chars: string) => FIELD.map((row) => row.replace(new RegExp(`[${chars}]`, 'g'), '.'));
const field = (rows: string[]) => [mapLevel('Harvest Day', 'topdown', 'bg_floor_field', 'farmer', rows, FARM)];

// Rules as each step ends.
const turnipRule = (...extra: ReturnType<typeof sound>[]) => touchRule(20, 20, 'asset:turnip', removeOther(), sound('coin'), ...extra);
const cornRule = (...extra: ReturnType<typeof sound>[]) => touchRule(20, 160, 'asset:corn', removeOther(), sound('powerup'), ...extra);
const ratRules = () => [
  levelStartRule(380, 20, setPath('asset:rat', 'patrol')),
  touchRule(380, 120, 'asset:rat', changeHealth(-1), sound('hurt')),
  touchRule(380, 240, 'asset:heart', removeOther(), changeHealth(1)),
  healthZeroRule(380, 360, message('The rats got you!'), restart()),
];
const elderRule = () => touchRule(20, 320, 'asset:elder', message(join('Your score is ', score())));

const step1 = () => workspace(turnipRule(changeScore(1)));
const step2 = () => workspace(turnipRule(changeScore(1)), cornRule(changeScore(5)));
const step3 = () => workspace(turnipRule(changeScore(1)), cornRule(changeScore(5)), ...ratRules());
const step4 = () => workspace(turnipRule(changeScore(1)), cornRule(changeScore(5)), ...ratRules(), elderRule());
const step5 = () =>
  workspaceWithVars(
    ['basket'],
    turnipRule(changeVar('basket', 1)),
    cornRule(changeVar('basket', 5)),
    ...ratRules(),
    elderRule(),
    touchRule(20, 440, 'asset:veg_crate', changeScore(getVar('basket')), setVar('basket', 0), sound('chime')),
  );

const toolbox1: ToolboxEntry[] = [touchBlock('asset:turnip'), 'sb_remove', soundBlock('coin'), numberBlock('sb_change_score', 1)];
const toolbox2: ToolboxEntry[] = [...toolbox1, touchBlock('asset:corn')];
const toolbox3: ToolboxEntry[] = [
  ...toolbox2,
  touchBlock('asset:rat'),
  touchBlock('asset:heart'),
  'sb_when_health_zero',
  numberBlock('sb_change_health', -1),
  messageBlock('The rats got you!'),
  'sb_restart_level',
];
const toolbox4: ToolboxEntry[] = [
  ...toolbox3,
  touchBlock('asset:elder'),
  'sb_score',
  {
    type: 'text_join',
    extraState: { itemCount: 2 },
    inputs: { ADD0: { block: { type: 'text', fields: { TEXT: 'Your score is ' } } } },
  },
];
const toolbox5: ToolboxEntry[] = [...toolbox4, touchBlock('asset:veg_crate'), MAKE_VARIABLE, 'variables_set', 'math_change', 'variables_get'];

const ASSETS = ['farmer', 'fence', 'turnip', 'apple_bush', 'hay_bale', 'well', 'wheelbarrow'];
const SOUNDS = ['coin', 'powerup', 'chime', 'pop', 'hurt', 'win'];

export const variables: Tutorial = {
  id: 'variables',
  title: 'Variables',
  description: 'Harvest day on the farm: score points, keep your health up, show your score, and fill a basket variable of your own.',
  thumbnail: 'tutorials/variables.webp',
  after: ['more-blocks'],
  steps: [
    {
      title: 'Score points',
      instructions: [
        'It’s harvest day! The score is a number the game remembers for you. Let’s make every turnip worth a point.',
        '1. Put “change score by 1” inside “when the player touches turnip”.',
        '2. Press ▶ Run. Pick all the turnips and watch the score go up!',
      ],
      assets: ASSETS,
      sounds: SOUNDS,
      levels: field(without('CRhEV')),
      main: workspace(turnipRule()),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox1 },
      validation: checks(
        criterion('A turnip scores a point.', compare(value('score'), 'GT', num(0))),
        criterion('Every turnip is picked.', compare(count('asset:turnip'), 'EQ', num(0))),
        criterion('The score gets to 5.', compare(value('score'), 'GTE', num(5))),
      ),
      solution: { main: step1() },
    },
    {
      title: 'Corn is worth more',
      instructions: [
        'Corn is rare, so it’s worth 5 points!',
        '1. Add “when the player touches corn”.',
        '2. Put “remove other sprite” inside, and “change score by 1”. Change the 1 to a 5.',
        '3. Run the game. Pick every vegetable. Can you get 15 points?',
      ],
      assets: [...ASSETS, 'corn'],
      sounds: SOUNDS,
      levels: field(without('RhEV')),
      main: step1(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox2 },
      validation: checks(
        criterion('You pick some corn.', touched('asset:corn')),
        criterion('The score gets to 15.', compare(value('score'), 'GTE', num(15))),
      ),
      solution: { main: step2() },
    },
    {
      title: 'Watch your health',
      instructions: [
        'Hungry rats are running around the field! Health is another number the game remembers. You start with 3 hearts.',
        '1. Add “when the player touches rat” with “change health by -1” inside.',
        '2. Add “when the player touches heart” with “remove other sprite” and “change health by 1”. Change the -1 to a 1.',
        '3. Add “when health reaches 0” with “show message” and “restart level” inside.',
        '4. Run the game. What happens when a rat bites you?',
      ],
      assets: [...ASSETS, 'corn', 'rat', 'heart'],
      sounds: SOUNDS,
      levels: field(without('EV')),
      main: workspace(turnipRule(changeScore(1)), cornRule(changeScore(5)), ratRules()[0]),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox3 },
      validation: checks(
        criterion('A rat bites you.', compare(value('health'), 'LT', num(3))),
        criterion('You pick up the heart.', touched('asset:heart')),
        criterion('Health runs out, and your “when health reaches 0” rule runs.', uses('sb_when_health_zero')),
      ),
      solution: { main: step3() },
    },
    {
      title: 'Show the score',
      instructions: [
        'The elder wants to know how your harvest is going. Let’s show the score in a message.',
        '1. Add “when the player touches elder” with “show message” inside.',
        '2. Drag “join” into the message’s hole, on top of “Hello!”.',
        '3. Drag “score” into the empty hole in “join”.',
        '4. Run the game. Pick some vegetables, then visit the elder.',
      ],
      assets: [...ASSETS, 'corn', 'rat', 'heart', 'elder'],
      sounds: SOUNDS,
      levels: field(without('V')),
      main: step3(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox4 },
      validation: checks(
        criterion('You use “join”.', uses('text_join')),
        criterion('You use “score”.', uses('sb_score')),
        criterion('You visit the elder.', touched('asset:elder')),
      ),
      solution: { main: step4() },
    },
    {
      title: 'Your own variable',
      instructions: [
        'Farmers carry vegetables in a basket, then put them in the vegetable crate. Let’s make a variable called basket: a number you name yourself.',
        '1. Scroll to the bottom of the blocks. Click “Create variable…” and type basket.',
        '2. In the turnip rule, swap “change score by 1” for “change basket by 1”. Do the same for corn, with 5.',
        '3. Add “when the player touches vegetable crate”. Put “change score by” inside, and drag “basket” into its hole.',
        '4. Add “set basket to 0” under it, so the basket is empty again.',
        '5. Run the game. Fill your basket, then empty it into the crate!',
      ],
      assets: [...ASSETS, 'corn', 'rat', 'heart', 'elder', 'veg_crate'],
      sounds: SOUNDS,
      levels: field(FIELD),
      main: step4(),
      paths: tutorialPaths(),
      toolbox: { rules: toolbox5 },
      validation: checks(
        criterion('Your basket fills up.', compare(variable('basket'), 'GT', num(0))),
        criterion(
          'You empty the basket into the crate.',
          and(compare(value('score'), 'GT', num(0)), compare(variable('basket'), 'EQ', num(0))),
        ),
        criterion('The score gets to 15.', compare(value('score'), 'GTE', num(15))),
      ),
      solution: { main: step5() },
    },
  ],
};
