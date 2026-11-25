import 'blockly/blocks';
import '@blockly/block-plus-minus';
import * as Blockly from 'blockly/core';
import * as En from 'blockly/msg/en';
import './style.css';
import { registerFields } from './blocks/fields';
import { registerMainBlocks } from './blocks/main_blocks';
import { registerPathBlocks } from './blocks/path_blocks';
import { blankProject, exampleProject, gardenProject } from './example';
import { restrictedMainToolbox, restrictedPathToolbox } from './blocks/toolbox';
import { getTutorial } from './tutorial/content';
import { TutorialSession } from './tutorial/session';
import { registerValidationBlocks } from './tutorial/validation';
import { showLanding } from './ui/landing';
import type { Project } from './model';
import type { ToolboxEntry } from './blocks/toolbox';
import { preloadSounds, unlockAudio } from './runtime/audio';
import { Game } from './runtime/engine';
import { SOUNDS } from './assets';
import { state } from './state';
import {
  autosave,
  deleteSavedProject,
  exportProject,
  listSavedProjects,
  loadAutosave,
  loadSavedProject,
  pickProjectFile,
  projectExists,
  saveProject,
} from './storage';
import { LevelEditor } from './ui/levelEditor';
import { levelTour, startTour } from './ui/tour';
import { isTablet } from './ui/device';
import { AssetLibrary } from './ui/library';
import { confirmDialog, el, openModal, toast } from './ui/modal';
import {
  compileProject,
  initWorkspaces,
  loadWorkspaces,
  mainWorkspace,
  pathsWorkspace,
  refreshToolboxes,
  resizeWorkspaces,
  saveWorkspaces,
  scrollToBlocks,
  setToolboxes,
} from './workspaces';

Blockly.setLocale(En as unknown as Record<string, string>);
registerFields();
registerMainBlocks();
registerPathBlocks();
registerValidationBlocks();

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------- routes
// #/ is the start page, #/play the full editor, #/tutorial/<id>[/<step>] a tutorial. Changing route reloads,
// since the editor is set up differently for each (a tutorial's toolboxes are plain flyouts).

const route = /^#\/tutorial\/([\w-]+)(?:\/(\d+))?/.exec(location.hash);
const tutorial = route ? getTutorial(route[1]) : undefined;
const mode: 'landing' | 'play' | 'tutorial' = tutorial ? 'tutorial' : location.hash.startsWith('#/play') ? 'play' : 'landing';
window.addEventListener('hashchange', () => location.reload());
document.body.dataset.mode = mode;
// Tablets get a smaller game and instructions, so the blocks have room (see `body.tablet` in style.css).
document.body.classList.toggle('tablet', isTablet());
$('brand-home').addEventListener('click', () => (location.hash = '#/'));

if (mode === 'landing') showLanding($('landing'));
else startEditor();

function startEditor(): void {
const app = $('app');
const nameInput = $<HTMLInputElement>('project-name');
const saveState = $('save-state');
const runBtn = $<HTMLButtonElement>('btn-run');
const stopBtn = $<HTMLButtonElement>('btn-stop');
const errorBox = $('game-error');

let dirty = false;
let savedName: string | null = null;
/** Serialized project as last opened or saved, to tell whether there are unsaved changes. */
let baseline = '';

function markDirty(isDirty: boolean): void {
  dirty = isDirty;
  saveState.textContent = isDirty ? 'Unsaved changes' : savedName ? 'Saved' : '';
}

// ---------------------------------------------------------------- game

const game = new Game($('game'), {
  onError(message) {
    errorBox.hidden = false;
    errorBox.textContent = '⚠ ' + message;
  },
  onStatus(status) {
    const running = status === 'running';
    runBtn.textContent = running ? '↻ Restart' : '▶ Run';
    stopBtn.disabled = !running;
    if (!running) game.showPreview(state.level);
  },
  onFrame() {
    session?.onFrame();
  },
});
let session: TutorialSession | null = null;
/** Autosave goes to the tutorial's progress in a tutorial, and to the free-play autosave otherwise. */
const persist = (project: Project) => (session ? session.save(project) : autosave(project));
preloadSounds(SOUNDS.map((s) => s.id));
if (import.meta.env.DEV) {
  Object.assign(window, { game, state, Blockly, mainWorkspace, pathsWorkspace });
  Object.defineProperty(window, 'session', { get: () => session });
}

function syncProjectFromWorkspaces(): void {
  Object.assign(state.project, saveWorkspaces());
}

function run(): void {
  unlockAudio();
  errorBox.hidden = true;
  syncProjectFromWorkspaces();
  try {
    game.start(compileProject(state.project, !!session));
    session?.onRunStart();
  } catch (e) {
    errorBox.hidden = false;
    errorBox.textContent = '⚠ ' + (e instanceof Error ? e.message : String(e));
  }
}

runBtn.addEventListener('click', run);
stopBtn.addEventListener('click', () => game.stop());
$('btn-expand').addEventListener('click', () => {
  const expanded = app.classList.toggle('expanded');
  $('btn-expand').textContent = expanded ? '⤡' : '⤢';
  $('btn-expand').title = expanded ? 'Shrink game' : 'Expand game';
  requestAnimationFrame(resizeWorkspaces);
});
$('btn-show-code').addEventListener('click', () => {
  syncProjectFromWorkspaces();
  const program = compileProject(state.project);
  const section = (title: string, code: string) =>
    el('details', { open: title.startsWith('Main') }, [el('summary', { textContent: title }), el('pre', { textContent: code })]);
  openModal(
    'Generated code',
    el('div', { className: 'code-view' }, [
      section('Main program (from your blocks)', program.main || '// No event blocks yet'),
      section('Paths', program.paths),
      ...program.levelSetup.map((code, i) => section(`Hidden setup for level ${i + 1}: ${program.levels[i].name}`, code)),
      ...(session ? [section('Tutorial checks (from the 💡 blocks)', session.validationCode() || '// No checks')] : []),
    ]),
    [{ label: 'Close' }],
    { wide: true },
  );
});

// ---------------------------------------------------------------- tabs

const tabs = document.querySelectorAll<HTMLButtonElement>('.tab[data-tab]');
let pathsShown = false;
tabs.forEach((tab) =>
  tab.addEventListener('click', () => {
    const previous = document.querySelector<HTMLElement>('.tab.active')?.dataset.tab;
    tabs.forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.tab-view').forEach((v) => v.classList.toggle('active', v.id === tab.dataset.tab + '-view'));
    if (app.classList.contains('expanded')) $('btn-expand').click();
    Blockly.hideChaff();
    if (tab.dataset.tab === 'rules' || tab.dataset.tab === 'paths') requestAnimationFrame(resizeWorkspaces);
    // The first time a tutorial opens the level editor (simplified, or with every control), walk through it.
    if (tab.dataset.tab === 'level' && session) {
      const simple = $('level-view').classList.contains('simple-level');
      const key = simple ? LEVEL_TOUR_KEY : LEVEL_FULL_TOUR_KEY;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        setTimeout(() => startTour(levelTour(simple)), 150);
      }
    }
    if (tab.dataset.tab === 'paths' && previous !== 'paths' && !pathsShown) {
      // The paths workspace starts hidden, so it can only be scrolled once it has a size.
      pathsShown = true;
      requestAnimationFrame(() => {
        refreshToolboxes();
        scrollToBlocks(pathsWorkspace());
      });
    }
  }),
);

// ---------------------------------------------------------------- workspaces and levels

let autosaveTimer = 0;
function scheduleAutosave(): void {
  clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    syncProjectFromWorkspaces();
    markDirty(JSON.stringify(state.project) !== baseline);
    persist(state.project);
  }, 400);
}

function resetBaseline(): void {
  syncProjectFromWorkspaces();
  baseline = JSON.stringify(state.project);
  markDirty(false);
}

// In a tutorial the toolboxes are flyouts of the step's blocks (set when each step opens).
let rulesBlocks: ToolboxEntry[] = [];
let pathBlocks: ToolboxEntry[] = [];
initWorkspaces(
  $('blockly-main'),
  $('blockly-paths'),
  { onChange: scheduleAutosave },
  tutorial
    ? { main: (ws) => restrictedMainToolbox(ws, rulesBlocks), paths: (ws) => restrictedPathToolbox(ws, pathBlocks) }
    : undefined,
);
new AssetLibrary($('sprites-view'));
new LevelEditor($('level-view'));

state.on((kind) => {
  if (kind === 'sounds') scheduleAutosave();
  if (kind === 'level' || kind === 'levels' || kind === 'currentLevel' || kind === 'assets') {
    if (!game.running) game.showPreview(state.level);
    if (kind !== 'currentLevel') scheduleAutosave();
  }
});

window.addEventListener('resize', resizeWorkspaces);

function openProject(project: Project, name: string | null): void {
  game.stop();
  errorBox.hidden = true;
  state.project = project;
  state.currentLevelIndex = 0;
  // Assets must be known before blocks load so dropdown values validate.
  state.emit('project');
  loadWorkspaces(project);
  state.emit('assets');
  pathsShown = false;
  nameInput.value = project.name;
  savedName = name;
  resetBaseline();
  game.showPreview(state.level);
  persist(project);
}

const TAB_CALLOUTS: Record<string, string> = {
  sprites: 'New! Pick sprites and sounds here.',
  level: 'New! Build your level here.',
  paths: 'New! Make paths here.',
};

/** Click handlers that clear a tab's callout, so a later step can replace them. */
const calloutHandlers = new Map<HTMLElement, () => void>();

/** Points out tabs that are new in a tutorial step, until each one is opened. */
function calloutTabs(names: string[], onSeen: (tab: string) => void): void {
  tabs.forEach((t) => {
    const clear = () => {
      t.classList.remove('tab-new');
      t.querySelector('.tab-callout')?.remove();
      const handler = calloutHandlers.get(t);
      if (handler) t.removeEventListener('click', handler);
      calloutHandlers.delete(t);
    };
    clear();
    const name = t.dataset.tab!;
    if (!names.includes(name)) return;
    t.classList.add('tab-new');
    t.append(el('span', { className: 'tab-callout', textContent: TAB_CALLOUTS[name] ?? 'New!' }));
    const handler = () => {
      clear();
      onSeen(name);
    };
    calloutHandlers.set(t, handler);
    t.addEventListener('click', handler);
  });
}

const LEVEL_TOUR_KEY = 'spriteblocks:levelTourSeen';
const LEVEL_FULL_TOUR_KEY = 'spriteblocks:levelFullTourSeen';

/**
 * Shows only the tabs a tutorial step uses (Rules is always there). With no other tabs the tab bar is hidden;
 * `levelControls` shows the level list and settings on the Levels tab. The tour only makes sense with every tab.
 */
function setTabs(shown: { sprites: boolean; level: boolean; paths: boolean }, levelControls: boolean): void {
  const visible: Record<string, boolean> = { ...shown, rules: true };
  tabs.forEach((t) => (t.hidden = !visible[t.dataset.tab!]));
  document.querySelector<HTMLElement>('.tabs')!.hidden = !shown.sprites && !shown.level && !shown.paths;
  $('level-view').classList.toggle('simple-level', !levelControls);
  $('btn-tour').hidden = !(shown.sprites && shown.level && shown.paths);
  const active = document.querySelector<HTMLElement>('.tab.active');
  if (active?.hidden) document.querySelector<HTMLButtonElement>('.tab[data-tab=rules]')!.click();
  requestAnimationFrame(resizeWorkspaces);
}

// ---------------------------------------------------------------- header actions

nameInput.addEventListener('change', () => {
  state.project.name = nameInput.value.trim() || 'My Game';
  nameInput.value = state.project.name;
  scheduleAutosave();
});

async function confirmDiscard(): Promise<boolean> {
  syncProjectFromWorkspaces();
  markDirty(JSON.stringify(state.project) !== baseline);
  if (!dirty) return true;
  return confirmDialog({
    title: 'Unsaved changes',
    message: 'This game has changes you haven’t saved. Continue without saving them?',
    confirmLabel: 'Continue without saving',
    danger: true,
  });
}

$('btn-new').addEventListener('click', () => {
  let close = () => {};
  const choice = (title: string, description: string, make: () => Project, after?: () => void) => {
    const button = el('button', { className: 'new-choice', type: 'button' }, [
      el('strong', { textContent: title }),
      el('span', { textContent: description }),
    ]);
    button.addEventListener('click', async () => {
      if (!(await confirmDiscard())) return;
      close();
      openProject(make(), null);
      after?.();
    });
    return button;
  };
  const choices = el('div', { className: 'new-choices' }, [
    choice(
      'Blank game',
      'An empty level. Add your own sprites and sounds.',
      () => blankProject(),
      () => setTimeout(() => offerTour('Your new game is empty. Want a quick tour of how to build it, step by step?')),
    ),
    choice('Coin Run', 'Example platformer: collect coins, stomp enemies, reach the door.', exampleProject),
    choice('Garden Gem Hunt', 'Example top-down game: find gems in a hedge maze and cast sparkles.', gardenProject),
  ]);
  close = openModal('New game', choices, [{ label: 'Cancel' }]);
  (choices.firstElementChild as HTMLElement).focus();
});

$('btn-tour').addEventListener('click', () => startTour());

function offerTour(message: string): void {
  openModal('Take the tour?', el('p', { textContent: message }), [
    { label: 'No thanks' },
    { label: 'Take the tour', primary: true, onClick: () => void setTimeout(startTour) },
  ]);
}

$('btn-save').addEventListener('click', async () => {
  const name = (nameInput.value.trim() || 'My Game').slice(0, 80);
  if (
    projectExists(name) &&
    savedName !== name &&
    !(await confirmDialog({
      title: 'Replace saved game?',
      message: `A game called “${name}” is already saved in this browser. Replace it with this one?`,
      confirmLabel: 'Replace',
      danger: true,
    }))
  ) {
    return;
  }
  state.project.name = name;
  syncProjectFromWorkspaces();
  try {
    saveProject(state.project);
  } catch (e) {
    toast('Could not save: ' + (e instanceof Error ? e.message : String(e)));
    return;
  }
  savedName = name;
  resetBaseline();
  toast(`Saved “${name}”`);
});

$('btn-load').addEventListener('click', () => {
  const list = el('ul', { className: 'project-list' });
  let close = () => {};
  const render = () => {
    const saved = listSavedProjects();
    list.replaceChildren(
      ...(saved.length
        ? saved.map((p) =>
            el('li', {}, [
              el('div', { className: 'project-info' }, [
                el('strong', { textContent: p.name }),
                el('span', { textContent: new Date(p.savedAt).toLocaleString() }),
              ]),
              el('button', {
                className: 'btn primary small',
                textContent: 'Open',
                type: 'button',
                onclick: async () => {
                  if (!(await confirmDiscard())) return;
                  const project = loadSavedProject(p.name);
                  if (project) openProject(project, p.name);
                  close();
                },
              }),
              el('button', {
                className: 'btn danger small',
                textContent: 'Delete',
                type: 'button',
                onclick: async () => {
                  const ok = await confirmDialog({
                    title: 'Delete saved game?',
                    message: `Delete “${p.name}” from this browser? This cannot be undone.`,
                    confirmLabel: 'Delete',
                    danger: true,
                  });
                  if (!ok) return;
                  deleteSavedProject(p.name);
                  if (savedName === p.name) savedName = null;
                  render();
                },
              }),
            ]),
          )
        : [el('li', { className: 'empty', textContent: 'No saved games in this browser yet.' })]),
    );
  };
  render();
  close = openModal('Open a saved game', list, [{ label: 'Close' }]);
});

$('btn-export').addEventListener('click', () => {
  state.project.name = nameInput.value.trim() || state.project.name;
  syncProjectFromWorkspaces();
  exportProject(state.project);
});

$('btn-import').addEventListener('click', async () => {
  if (!(await confirmDiscard())) return;
  try {
    const project = await pickProjectFile();
    if (project) {
      openProject(project, null);
      toast(`Imported “${project.name}”`);
    }
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e));
  }
});

window.addEventListener('beforeunload', () => {
  syncProjectFromWorkspaces();
  persist(state.project);
});

// ---------------------------------------------------------------- start

if (tutorial) {
  session = new TutorialSession(tutorial, {
    game,
    openProject: (project) => openProject(project, null),
    currentProject: () => {
      syncProjectFromWorkspaces();
      return state.project;
    },
    setToolboxes: (rules, paths) => {
      rulesBlocks = rules;
      pathBlocks = paths;
      setToolboxes((ws) => restrictedMainToolbox(ws, rulesBlocks), (ws) => restrictedPathToolbox(ws, pathBlocks));
    },
    setTabs,
    calloutTabs,
  });
  session.mount(document.querySelector('.topbar')!, document.querySelector('.game-pane')!, $('btn-show-code'), route?.[2] ? Number(route[2]) - 1 : undefined);
  return;
}

let initial: Project | null = null;
try {
  initial = loadAutosave();
} catch {
  initial = null;
}
openProject(initial ?? exampleProject(), null);

// Offer the tour once, to first-time visitors.
const TOUR_OFFERED_KEY = 'spriteblocks:tourOffered';
if (!initial && !localStorage.getItem(TOUR_OFFERED_KEY)) {
  localStorage.setItem(TOUR_OFFERED_KEY, '1');
  offerTour('Welcome! This example game shows what you can make. Want a one-minute tour of how games are built here?');
}
}
