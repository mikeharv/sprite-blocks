// Tutorial progress in localStorage: the learner's project for each step and whether the step has passed.
import type { Project } from '../model';
import { validateProject } from '../storage';

const PREFIX = 'spriteblocks:tutorial:';

export interface StepProgress {
  /** The learner's project for this step, as last saved. */
  project?: Project;
  /** Whether the step's checks have all passed in some run. */
  passed?: boolean;
}

export interface TutorialProgress {
  /** Index of the step the learner was last on. */
  step: number;
  steps: Record<number, StepProgress>;
  /** Set once the completion message has been shown. */
  celebrated?: boolean;
  /** Tabs the learner has opened, so a tab is only called out as new until then. */
  seenTabs?: string[];
}

const empty = (): TutorialProgress => ({ step: 0, steps: {} });

export function loadProgress(tutorialId: string): TutorialProgress {
  try {
    const raw = localStorage.getItem(PREFIX + tutorialId);
    if (!raw) return empty();
    const p = JSON.parse(raw) as TutorialProgress;
    return { step: Number(p.step) || 0, steps: p.steps ?? {}, celebrated: !!p.celebrated, seenTabs: p.seenTabs ?? [] };
  } catch {
    return empty();
  }
}

export function saveProgress(tutorialId: string, progress: TutorialProgress): void {
  try {
    localStorage.setItem(PREFIX + tutorialId, JSON.stringify(progress));
  } catch {
    // Storage full or unavailable: progress is best-effort.
  }
}

export function resetProgress(tutorialId: string): void {
  localStorage.removeItem(PREFIX + tutorialId);
}

/** Whether a step can be opened: the first step always, later ones once every earlier step has passed. */
export function canOpenStep(progress: TutorialProgress, index: number): boolean {
  for (let i = 0; i < index; i++) if (!progress.steps[i]?.passed) return false;
  return true;
}

export function passedCount(progress: TutorialProgress, total: number): number {
  let n = 0;
  for (let i = 0; i < total; i++) if (progress.steps[i]?.passed) n++;
  return n;
}

interface ProgressFile {
  format: 'sprite-blocks-tutorial-progress';
  tutorial: string;
  progress: TutorialProgress;
}

export function exportProgress(tutorialId: string, title: string, progress: TutorialProgress): void {
  const data: ProgressFile = { format: 'sprite-blocks-tutorial-progress', tutorial: tutorialId, progress };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^\w\- ]+/g, '').trim() || 'tutorial'} progress.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads a progress file for this tutorial. Rejects files for other tutorials or that aren't progress files. */
export function importProgress(tutorialId: string): Promise<TutorialProgress | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const data = JSON.parse(await file.text()) as ProgressFile;
        if (data.format !== 'sprite-blocks-tutorial-progress') throw new Error('This file is not tutorial progress.');
        if (data.tutorial !== tutorialId) throw new Error('This progress is for a different tutorial.');
        const progress: TutorialProgress = {
          step: Number(data.progress.step) || 0,
          steps: {},
          celebrated: !!data.progress.celebrated,
          seenTabs: data.progress.seenTabs ?? [],
        };
        for (const [i, s] of Object.entries(data.progress.steps ?? {})) {
          progress.steps[Number(i)] = { passed: !!s.passed, project: s.project ? validateProject(s.project) : undefined };
        }
        resolve(progress);
      } catch (e) {
        reject(e);
      }
    });
    input.click();
  });
}
