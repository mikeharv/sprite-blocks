// Central app state with a tiny change-notification mechanism.
import type { Level, Project } from './model';
import { getSprite, getBackground } from './assets';

export type ChangeKind = 'project' | 'assets' | 'levels' | 'level' | 'currentLevel' | 'paths';

type Listener = (kind: ChangeKind) => void;

class AppState {
  project!: Project;
  currentLevelIndex = 0;
  private listeners: Listener[] = [];

  get level(): Level {
    return this.project.levels[this.currentLevelIndex];
  }

  /** Sprite asset ids in the project, in library order. */
  get spriteAssetIds(): string[] {
    return this.project.assets.filter((id) => getSprite(id));
  }

  get backgroundAssetIds(): string[] {
    return this.project.assets.filter((id) => getBackground(id));
  }

  on(fn: Listener): void {
    this.listeners.push(fn);
  }

  emit(kind: ChangeKind): void {
    for (const fn of this.listeners) fn(kind);
  }

  setCurrentLevel(index: number): void {
    this.currentLevelIndex = Math.max(0, Math.min(index, this.project.levels.length - 1));
    this.emit('currentLevel');
  }
}

export const state = new AppState();
