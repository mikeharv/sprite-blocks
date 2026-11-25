// Tutorials: a fixed list of steps that build up one game, each with its own starting project, a cut-down
// toolbox, the tabs it needs, and checks the learner's game has to pass before moving on.
import type { ToolboxEntry } from '../blocks/toolbox';
import type { Level } from '../model';

export interface TutorialStep {
  title: string;
  /** What to do, shown above the game. Each line is a paragraph; lines starting with a number are steps. */
  instructions: string[];
  /** Sprites and sounds in the project for this step. */
  assets: string[];
  sounds: string[];
  levels: Level[];
  /** Starting blocks (Blockly JSON) for the Rules and Paths workspaces. */
  main: object;
  paths: object;
  /** The blocks offered, taken from the full toolboxes. */
  toolbox: { rules: ToolboxEntry[]; paths?: ToolboxEntry[] };
  /** Tabs shown besides Rules (which is always there). With none, the tab bar is hidden. */
  tabs?: { sprites?: boolean; level?: boolean; paths?: boolean };
  /** Levels tab only: show the level list and level settings, not just the grid and palette. */
  levelControls?: boolean;
  /** The step's checks: a Blockly JSON workspace of validation blocks. */
  validation: object;
  /**
   * One way to finish the step (for testing that it can be passed): the Rules and Paths blocks, and the levels
   * if the step asks for level changes. Anything left out stays as the step starts.
   */
  solution?: { main?: object; paths?: object; levels?: Level[] };
}

export interface Tutorial {
  id: string;
  title: string;
  /** One sentence for the landing page. */
  description: string;
  /** Picture for the landing page, under public/. */
  thumbnail: string;
  /** A first path: needs nothing learned before. The start page marks these "Start here". */
  start?: boolean;
  /**
   * The paths this one builds on (all of them), by id. "start" means any one of the first paths. The start
   * page draws these as arrows. See "Learning paths" in the README for what each path teaches and assumes.
   */
  after?: string[];
  steps: TutorialStep[];
}
