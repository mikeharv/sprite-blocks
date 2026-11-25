// Runs a tutorial in the editor: loads each step's project, toolbox and tabs, shows the instructions and the
// step's checks, checks the game every frame while it runs, and moves between steps.
import type { ToolboxEntry } from '../blocks/toolbox';
import type { Project } from '../model';
import type { Game } from '../runtime/engine';
import { autosave, loadAutosave, projectExists, saveProject } from '../storage';
import { confirmDialog, el, openModal, toast } from '../ui/modal';
import type { Tutorial, TutorialStep } from './types';
import {
  canOpenStep,
  exportProgress,
  importProgress,
  loadProgress,
  passedCount,
  resetProgress,
  saveProgress,
  type TutorialProgress,
} from './progress';
import { blockWitnesses, buildCriteria, type BlockWitness, compileValidation, showValidationWorkspace, type Criterion } from './validation';

/** What the tutorial needs from the editor. */
export interface EditorHooks {
  game: Game;
  /** Opens a project in the editor (without touching the free-play autosave). */
  openProject(project: Project): void;
  /** The project as it is now, with the workspaces saved into it. */
  currentProject(): Project;
  setToolboxes(rules: ToolboxEntry[], paths: ToolboxEntry[]): void;
  setTabs(tabs: { sprites: boolean; level: boolean; paths: boolean }, levelControls: boolean): void;
  /** Calls out these tabs as new; `onSeen` runs when the learner opens one. */
  calloutTabs(tabs: string[], onSeen: (tab: string) => void): void;
}

export class TutorialSession {
  private progress: TutorialProgress;
  private index = 0;
  private criteria: Criterion[] = [];
  /** Which criteria have come true during the current run. */
  private met: boolean[] = [];
  private code = '';
  private bar = el('div', { className: 'tutorial-bar' });
  private panel = el('section', { className: 'tutorial-panel' });
  private checksButton = el('button', {
    className: 'btn icon',
    type: 'button',
    title: 'What does this step check?',
    textContent: '💡',
  });

  constructor(
    readonly tutorial: Tutorial,
    private hooks: EditorHooks,
  ) {
    this.progress = loadProgress(tutorial.id);
    this.checksButton.addEventListener('click', () => this.showChecks());
  }

  get step(): TutorialStep {
    return this.tutorial.steps[this.index];
  }

  /** Puts the tutorial's bar in the header and its panel below the game, then opens a step. */
  mount(header: HTMLElement, gamePane: HTMLElement, showCode: HTMLElement, requestedStep?: number): void {
    header.querySelector('.brand')!.after(this.bar);
    // Below the run buttons and the game, so the game stays in the same place as in the full editor.
    (gamePane.querySelector('#game-error') ?? gamePane.lastElementChild)!.after(this.panel);
    showCode.before(this.checksButton);
    // Checks can ask whether any two kinds of sprite have touched.
    this.hooks.game.trackTouches = true;
    let start = requestedStep ?? this.progress.step;
    if (!canOpenStep(this.progress, start)) start = this.progress.step;
    if (!canOpenStep(this.progress, start)) start = 0;
    this.open(Math.min(Math.max(0, start), this.tutorial.steps.length - 1), false);
  }

  private passed(i = this.index): boolean {
    return !!this.progress.steps[i]?.passed;
  }

  /** The starting project for a step: its sprites, sounds, levels and blocks. */
  private startingProject(step: TutorialStep): Project {
    return structuredClone({
      format: 'sprite-blocks',
      version: 1,
      name: this.tutorial.title,
      assets: step.assets,
      sounds: step.sounds,
      levels: step.levels,
      main: step.main,
      paths: step.paths,
    });
  }

  /** Saves the learner's project for the current step (the editor's autosave lands here). */
  save(project: Project): void {
    const entry = (this.progress.steps[this.index] ??= {});
    entry.project = structuredClone(project);
    saveProgress(this.tutorial.id, this.progress);
  }

  private open(index: number, saveFirst = true): void {
    if (saveFirst) this.save(this.hooks.currentProject());
    this.hooks.game.stop();
    this.index = index;
    this.progress.step = index;
    saveProgress(this.tutorial.id, this.progress);
    const step = this.step;
    this.hooks.setTabs(
      { sprites: !!step.tabs?.sprites, level: !!step.tabs?.level, paths: !!step.tabs?.paths },
      !!step.levelControls,
    );
    // Tabs this tutorial hasn't shown the learner yet get a "New!" callout until they're opened.
    const fresh = (['sprites', 'level', 'paths'] as const).filter(
      (t) => step.tabs?.[t] && !this.progress.seenTabs?.includes(t),
    );
    this.hooks.calloutTabs([...fresh], (tab) => {
      (this.progress.seenTabs ??= []).push(tab);
      saveProgress(this.tutorial.id, this.progress);
    });
    // The project first: the toolbox's dropdown defaults come from it.
    this.hooks.openProject(this.progress.steps[index]?.project ?? this.startingProject(step));
    this.hooks.setToolboxes(step.toolbox.rules, step.toolbox.paths ?? []);
    this.code = compileValidation(step.validation);
    this.criteria = buildCriteria(this.code, this.hooks.game, { blockRan: (type) => this.blockRan(type) });
    // A step that already passed shows its checks ticked until the game runs again.
    this.met = this.criteria.map(() => this.passed());
    this.render();
  }

  /** The checking code, for the generated code view. */
  validationCode(): string {
    return this.code;
  }

  /** The learner's blocks and the ids that show each one ran, gathered when the game starts. */
  private witnesses: BlockWitness[] = [];

  /** Whether a block of this kind has run in this game (checks can ask). */
  private blockRan(type: string): boolean {
    const ran = this.hooks.game.ranBlocks;
    return this.witnesses.some((w) => w.type === type && w.ids.some((id) => ran.has(id)));
  }

  /** Called when the game starts: every check starts over. */
  onRunStart(): void {
    const project = this.hooks.currentProject();
    this.witnesses = blockWitnesses(project.main, project.paths);
    this.met = this.criteria.map(() => false);
    this.renderPanel();
  }

  /** Called every frame while the game runs. Checks stay ticked once they come true during a run. */
  onFrame(): void {
    let changed = false;
    this.criteria.forEach((c, i) => {
      if (this.met[i]) return;
      let ok = false;
      try {
        ok = !!c.test();
      } catch {
        ok = false;
      }
      if (ok) {
        this.met[i] = true;
        changed = true;
      }
    });
    if (!changed) return;
    if (this.met.every(Boolean) && !this.passed()) this.complete();
    this.render();
  }

  private complete(): void {
    (this.progress.steps[this.index] ??= {}).passed = true;
    saveProgress(this.tutorial.id, this.progress);
    const last = this.index === this.tutorial.steps.length - 1;
    if (last && passedCount(this.progress, this.tutorial.steps.length) === this.tutorial.steps.length) {
      if (!this.progress.celebrated) {
        this.progress.celebrated = true;
        saveProgress(this.tutorial.id, this.progress);
        setTimeout(() => this.celebrate(), 900);
      }
    } else toast('Step complete! Press Next when you’re ready.');
  }

  // ---------------------------------------------------------------- rendering

  private render(): void {
    this.renderBar();
    this.renderPanel();
  }

  private renderBar(): void {
    const steps = this.tutorial.steps;
    const last = this.index === steps.length - 1;
    const dots = steps.map((s, i) => {
      const open = canOpenStep(this.progress, i);
      const dot = el('button', {
        className:
          'step-dot' + (i === this.index ? ' current' : '') + (this.passed(i) ? ' passed' : '') + (open ? '' : ' locked'),
        type: 'button',
        textContent: String(i + 1),
        title: `${i + 1}. ${s.title}` + (open ? '' : ' (finish the steps before it first)'),
        disabled: !open,
      });
      dot.setAttribute('aria-current', i === this.index ? 'step' : 'false');
      dot.addEventListener('click', () => i !== this.index && this.open(i));
      return dot;
    });
    const back = el('button', { className: 'btn', type: 'button', textContent: '‹ Back', disabled: this.index === 0 });
    back.addEventListener('click', () => this.open(this.index - 1));
    const next = el('button', {
      className: 'btn primary',
      type: 'button',
      textContent: last ? 'Finish ✓' : 'Next ›',
      disabled: !this.passed(),
      title: this.passed() ? '' : 'Pass every check to go on',
    });
    next.addEventListener('click', () => (last ? this.celebrate() : this.open(this.index + 1)));
    const reset = el('button', { className: 'btn', type: 'button', textContent: 'Start over', title: 'Start this tutorial from the beginning' });
    reset.addEventListener('click', () => this.reset());
    const exportBtn = el('button', { className: 'btn', type: 'button', textContent: 'Export progress' });
    exportBtn.addEventListener('click', () => {
      this.save(this.hooks.currentProject());
      exportProgress(this.tutorial.id, this.tutorial.title, this.progress);
    });
    const importBtn = el('button', { className: 'btn', type: 'button', textContent: 'Import progress' });
    importBtn.addEventListener('click', () => this.importProgress());
    this.bar.replaceChildren(
      el('span', { className: 'tutorial-title', textContent: this.tutorial.title }),
      back,
      el('div', { className: 'step-dots', role: 'group', ariaLabel: 'Tutorial steps' }, dots),
      next,
      el('span', { className: 'spacer' }),
      reset,
      exportBtn,
      importBtn,
    );
  }

  private renderPanel(): void {
    const step = this.step;
    const list = el('ol', { className: 'tutorial-steps' });
    const paragraphs: HTMLElement[] = [];
    for (const line of step.instructions) {
      const m = /^\d+\.\s*(.*)$/.exec(line);
      if (m) list.append(el('li', { textContent: m[1] }));
      else paragraphs.push(el('p', { textContent: line }));
    }
    const done = this.met.length > 0 && this.met.every(Boolean);
    const checks = el(
      'ul',
      { className: 'tutorial-checks', ariaLabel: 'Checks' },
      this.criteria.map((c, i) =>
        el('li', { className: this.met[i] ? 'met' : 'unmet' }, [
          el('span', { className: 'check-light', ariaHidden: 'true' }),
          el('span', { textContent: c.description }),
          el('span', { className: 'sr-only', textContent: this.met[i] ? ' (done)' : ' (not yet)' }),
        ]),
      ),
    );
    this.panel.replaceChildren(
      el('h2', { textContent: `Step ${this.index + 1}: ${step.title}` }),
      ...paragraphs,
      ...(list.children.length ? [list] : []),
      el('div', { className: 'tutorial-goal' }, [
        el('span', {
          className: 'tutorial-status' + (done ? ' done' : ''),
          textContent: done ? 'Step complete! ✓' : 'Run your game to check these:',
        }),
        checks,
      ]),
    );
  }

  // ---------------------------------------------------------------- dialogs

  private showChecks(): void {
    const host = el('div', { className: 'validation-host' });
    let dispose = () => {};
    openModal(
      'What this step checks',
      el('div', {}, [
        el('p', {
          className: 'dialog-message',
          textContent:
            'These blocks are how this step checks your game. While your game runs, each check is tested again ' +
            'and again, and it turns green as soon as it comes true. You can look, but you can’t change them.',
        }),
        host,
      ]),
      [{ label: 'Close' }],
      { wide: true, onClose: () => dispose() },
    );
    dispose = showValidationWorkspace(host, this.step.validation);
  }

  private celebrate(): void {
    openModal(
      'You did it! 🎉',
      el('div', {}, [
        el('p', { className: 'dialog-message', textContent: `You finished “${this.tutorial.title}” and built a whole game.` }),
        el('p', {
          className: 'dialog-message',
          textContent: 'Keep building it with every block, sprite and sound, or go back and pick something new.',
        }),
      ]),
      [
        { label: 'Back to the start page', onClick: () => void (location.hash = '#/') },
        { label: 'Keep building in the full editor', primary: true, onClick: () => void this.continueInFullEditor() },
      ],
    );
  }

  /**
   * Copies the tutorial game into the full editor (one way: the tutorial keeps its own copy). The game open in
   * the full editor before is saved under its name first, so it isn't lost.
   */
  private continueInFullEditor(): void {
    const project = structuredClone(this.hooks.currentProject());
    this.save(project);
    const previous = loadAutosave();
    if (previous && previous.name !== project.name) {
      let name = previous.name;
      if (projectExists(name)) name = `${previous.name} (before ${this.tutorial.title})`;
      saveProject({ ...previous, name });
    }
    autosave(project);
    location.hash = '#/play';
  }

  private async reset(): Promise<void> {
    const ok = await confirmDialog({
      title: 'Start over?',
      message: `This clears your work in every step of “${this.tutorial.title}” and goes back to step 1.`,
      confirmLabel: 'Start over',
      danger: true,
    });
    if (!ok) return;
    resetProgress(this.tutorial.id);
    this.progress = loadProgress(this.tutorial.id);
    this.open(0, false);
  }

  private async importProgress(): Promise<void> {
    try {
      const progress = await importProgress(this.tutorial.id);
      if (!progress) return;
      this.progress = progress;
      saveProgress(this.tutorial.id, progress);
      this.open(Math.min(progress.step, this.tutorial.steps.length - 1), false);
      toast('Progress loaded');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }
}
