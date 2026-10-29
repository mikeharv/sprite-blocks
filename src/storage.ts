// Saving projects to localStorage and exporting/importing project files.
import { SOUNDS, getAsset, getSprite } from './assets';
import type { Asset, Project } from './model';

const PREFIX = 'spriteblocks:project:';
const AUTOSAVE_KEY = 'spriteblocks:autosave';

export interface SavedProjectInfo {
  name: string;
  savedAt: number;
}

interface StoredProject {
  savedAt: number;
  project: Project;
}

export function listSavedProjects(): SavedProjectInfo[] {
  const out: SavedProjectInfo[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? '') as StoredProject;
      out.push({ name: key.slice(PREFIX.length), savedAt: stored.savedAt });
    } catch {
      // Ignore unreadable entries.
    }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export function saveProject(project: Project): void {
  const stored: StoredProject = { savedAt: Date.now(), project };
  localStorage.setItem(PREFIX + project.name, JSON.stringify(stored));
}

export function loadSavedProject(name: string): Project | null {
  const raw = localStorage.getItem(PREFIX + name);
  if (!raw) return null;
  return validateProject((JSON.parse(raw) as StoredProject).project);
}

export function deleteSavedProject(name: string): void {
  localStorage.removeItem(PREFIX + name);
}

export function projectExists(name: string): boolean {
  return localStorage.getItem(PREFIX + name) !== null;
}

export function autosave(project: Project): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
  } catch {
    // Storage full or unavailable: autosave is best-effort.
  }
}

export function loadAutosave(): Project | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? validateProject(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Sprite selectors used before players, hazards, collectibles, scenery and goals were merged. */
const LEGACY_SELECTORS: Record<string, string> = {
  'class:player': 'player',
  'class:hazard': 'class:character',
  'class:collectible': 'class:item',
  'class:scenery': 'class:item',
  'class:goal': 'class:item',
};
const LEGACY_PLAYERS = [
  'alien_green', 'alien_blue', 'alien_pink', 'alien_yellow', 'alien_beige',
  'hero', 'knight', 'wizard', 'princess', 'plane_blue', 'plane_red',
];

/** Upgrades projects saved before sounds were chosen per project and the sprite classes were merged. */
function migrate(p: Project): void {
  p.sounds = SOUNDS.map((s) => s.id);
  let main = JSON.stringify(p.main ?? {});
  for (const [from, to] of Object.entries(LEGACY_SELECTORS)) main = main.split(`"${from}"`).join(`"${to}"`);
  p.main = JSON.parse(main);
  for (const level of p.levels) {
    const ids = Object.values(level.cells ?? {});
    level.player ??= LEGACY_PLAYERS.find((id) => ids.includes(id)) ?? null;
  }
}

/** Checks the basic shape of a project and drops references to unknown assets. */
export function validateProject(data: unknown): Project {
  const p = data as Project;
  if (!p || p.format !== 'sprite-blocks' || !Array.isArray(p.levels) || !p.levels.length) {
    throw new Error('This file is not a Sprite Blocks project.');
  }
  if (!Array.isArray(p.sounds)) migrate(p);
  const known = (id: string) => !!getAsset(id);
  const missing = new Set<string>();
  // Backgrounds used to be added to projects; they are now chosen per level from the whole library.
  p.assets = (p.assets ?? []).filter((id) => getSprite(id) || (!known(id) && missing.add(id), false));
  p.sounds = p.sounds.filter((id) => SOUNDS.some((s) => s.id === id));
  for (const level of p.levels) {
    for (const [key, id] of Object.entries(level.cells ?? {})) {
      if (!known(id)) {
        missing.add(id);
        delete level.cells[key];
      }
    }
    if (level.background && !known(level.background)) level.background = null;
    if (level.player && !getSprite(level.player)) level.player = null;
  }
  if (missing.size) console.warn('Unknown assets removed from project:', [...missing]);
  delete p.assetMeta;
  p.main ??= {};
  p.paths ??= {};
  return p;
}

export function exportProject(project: Project): void {
  const assetMeta = project.assets.map((id) => getAsset(id)).filter((a): a is Asset => !!a);
  const data: Project = { ...project, assetMeta };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (project.name.replace(/[^\w\- ]+/g, '').trim() || 'game') + '.spriteblocks.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickProjectFile(): Promise<Project | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(validateProject(JSON.parse(await file.text())));
      } catch (e) {
        reject(e);
      }
    });
    input.click();
  });
}
