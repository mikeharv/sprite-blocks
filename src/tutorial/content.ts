// Every tutorial, in an order that respects what each builds on (narrow start pages stack them this way).
import type { Tutorial, TutorialStep } from './types';
import { topDown } from './tutorials/topDown';
import { platformer } from './tutorials/platformer';
import { moreBlocks } from './tutorials/moreBlocks';
import { variables } from './tutorials/variables';
import { paths } from './tutorials/paths';
import { loopsLogic } from './tutorials/loopsLogic';
import { biggerGames } from './tutorials/biggerGames';

export const TUTORIALS: Tutorial[] = [topDown, platformer, moreBlocks, paths, variables, biggerGames, loopsLogic];

export function getTutorial(id: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.id === id);
}

export type { TutorialStep };
