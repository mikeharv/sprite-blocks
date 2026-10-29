import 'blockly/blocks';
import '@blockly/block-plus-minus';
import * as Blockly from 'blockly/core';
import * as En from 'blockly/msg/en';
import './style.css';
import { registerFields } from './blocks/fields';
import { registerMainBlocks } from './blocks/main_blocks';
import { registerPathBlocks } from './blocks/path_blocks';
import { blankProject, exampleProject, gardenProject } from './example';
import type { Project } from './model';
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
import { startTour } from './ui/tour';
import { AssetLibrary } from './ui/library';
import { confirmDialog, el, openModal, toast } from './ui/modal';
import {
  compileProject,
  initWorkspaces,
  loadWorkspaces,
  mainWorkspace,
  pathsWorkspace,
  resizeWorkspaces,
  saveWorkspaces,
  scrollToBlocks,
} from './workspaces';
import { pathToolbox } from './blocks/toolbox';

Blockly.setLocale(En as unknown as Record<string, string>);
registerFields();
registerMainBlocks();
registerPathBlocks();

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
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
});
preloadSounds(SOUNDS.map((s) => s.id));
if (import.meta.env.DEV) Object.assign(window, { game, state, Blockly, mainWorkspace, pathsWorkspace });

function syncProjectFromWorkspaces(): void {
  Object.assign(state.project, saveWorkspaces());
}

function run(): void {
  unlockAudio();
  errorBox.hidden = true;
  syncProjectFromWorkspaces();
  try {
    game.start(compileProject(state.project));
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
    if (tab.dataset.tab === 'paths' && previous !== 'paths' && !pathsShown) {
      // The paths workspace starts hidden, so it can only be scrolled once it has a size.
      pathsShown = true;
      requestAnimationFrame(() => {
        pathsWorkspace().updateToolbox(pathToolbox());
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
    autosave(state.project);
  }, 400);
}

function resetBaseline(): void {
  syncProjectFromWorkspaces();
  baseline = JSON.stringify(state.project);
  markDirty(false);
}

initWorkspaces($('blockly-main'), $('blockly-paths'), { onChange: scheduleAutosave });
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
  autosave(project);
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
  autosave(state.project);
});

// ---------------------------------------------------------------- start

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
