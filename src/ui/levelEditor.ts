// Level editor: a scrollable DOM grid for placing sprites, plus level list and settings.
import { getAsset, getSprite, thumbUrl } from '../assets';
import type { GameMode, Level, ViewSize } from '../model';
import { SPRITE_CLASSES, cellKey, newLevel, parseCellKey, uid, viewCols } from '../model';
import { state } from '../state';
import { el } from './modal';

const ERASER = '__eraser__';
const MAX_SIZE = 200;

export class LevelEditor {
  private brush: string = ERASER;
  private cellSize = 36;
  private painting: 'paint' | 'erase' | null = null;
  private lastCell: [number, number] | null = null;
  private dirty = false;
  private cells: HTMLElement[] = [];

  private levelTabs = el('div', { className: 'level-tabs' });
  private settings = el('div', { className: 'level-settings' });
  private palette = el('aside', { className: 'palette' });
  private grid = el('div', { className: 'level-grid' });
  private cameraBox = el('div', { className: 'camera-box' });
  private status = el('div', { className: 'level-status' });
  private gridScroll = el('div', { className: 'grid-scroll' }, [this.grid]);

  constructor(root: HTMLElement) {
    root.append(
      el('div', { className: 'level-toolbar' }, [this.levelTabs, this.settings]),
      el('div', { className: 'level-body' }, [this.palette, this.gridScroll]),
      this.status,
    );
    this.grid.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.grid.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.grid.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointerup', () => this.endPaint());
    this.grid.addEventListener('pointerleave', () => (this.status.textContent = this.statusText()));

    state.on((kind) => {
      if (kind === 'project' || kind === 'levels' || kind === 'currentLevel') this.render();
      if (kind === 'assets') {
        this.renderPalette();
        this.renderSettings();
        this.renderGrid();
      }
    });
  }

  render(): void {
    this.renderTabs();
    this.renderSettings();
    this.renderPalette();
    this.renderGrid();
  }

  private get level(): Level {
    return state.level;
  }

  private changed(kind: 'level' | 'levels' = 'level'): void {
    state.emit(kind);
  }

  // ---------------------------------------------------------------- level list

  private renderTabs(): void {
    const levels = state.project.levels;
    this.levelTabs.replaceChildren(
      ...levels.map((lvl, i) => {
        const tab = el('button', {
          className: 'level-tab' + (i === state.currentLevelIndex ? ' active' : ''),
          textContent: `${i + 1}. ${lvl.name}`,
          title: 'Double-click to rename',
          type: 'button',
        });
        tab.addEventListener('click', () => state.setCurrentLevel(i));
        tab.addEventListener('dblclick', () => this.rename());
        return tab;
      }),
      el('button', { className: 'btn small', textContent: '+ Level', type: 'button', onclick: () => this.addLevel() }),
      el('span', { className: 'spacer' }),
      el('button', {
        className: 'btn small icon',
        textContent: '◀',
        title: 'Move level earlier',
        type: 'button',
        disabled: state.currentLevelIndex === 0,
        onclick: () => this.moveLevel(-1),
      }),
      el('button', {
        className: 'btn small icon',
        textContent: '▶',
        title: 'Move level later',
        type: 'button',
        disabled: state.currentLevelIndex === levels.length - 1,
        onclick: () => this.moveLevel(1),
      }),
      el('button', { className: 'btn small', textContent: 'Rename', type: 'button', onclick: () => this.rename() }),
      el('button', { className: 'btn small', textContent: 'Duplicate', type: 'button', onclick: () => this.duplicate() }),
      el('button', {
        className: 'btn small danger',
        textContent: 'Delete',
        type: 'button',
        disabled: levels.length <= 1,
        onclick: () => this.deleteLevel(),
      }),
    );
  }

  private addLevel(): void {
    const lvl = newLevel(`Level ${state.project.levels.length + 1}`, this.level.mode);
    lvl.background = this.level.background;
    state.project.levels.splice(state.currentLevelIndex + 1, 0, lvl);
    state.currentLevelIndex++;
    this.changed('levels');
  }

  private duplicate(): void {
    const copy: Level = { ...structuredClone(this.level), id: uid('level'), name: this.level.name + ' copy' };
    state.project.levels.splice(state.currentLevelIndex + 1, 0, copy);
    state.currentLevelIndex++;
    this.changed('levels');
  }

  private rename(): void {
    const name = prompt('Level name', this.level.name)?.trim();
    if (!name) return;
    this.level.name = name;
    this.changed('levels');
  }

  private deleteLevel(): void {
    if (state.project.levels.length <= 1) return;
    if (!confirm(`Delete “${this.level.name}”?`)) return;
    state.project.levels.splice(state.currentLevelIndex, 1);
    state.currentLevelIndex = Math.min(state.currentLevelIndex, state.project.levels.length - 1);
    this.changed('levels');
  }

  private moveLevel(delta: number): void {
    const levels = state.project.levels;
    const i = state.currentLevelIndex;
    const j = i + delta;
    if (j < 0 || j >= levels.length) return;
    [levels[i], levels[j]] = [levels[j], levels[i]];
    state.currentLevelIndex = j;
    this.changed('levels');
  }

  // ---------------------------------------------------------------- settings

  private renderSettings(): void {
    const lvl = this.level;
    const mode = el('select', { className: 'select' }, [
      el('option', { value: 'platformer', textContent: 'Platformer (gravity, jumping)' }),
      el('option', { value: 'topdown', textContent: 'Top-down (move in 4 directions)' }),
    ]);
    mode.value = lvl.mode;
    mode.addEventListener('change', () => {
      lvl.mode = mode.value as GameMode;
      this.changed();
    });

    const size = (label: string, value: number, apply: (n: number) => void) => {
      const input = el('input', { type: 'number', min: '4', max: String(MAX_SIZE), value: String(value), className: 'num' });
      input.addEventListener('change', () => {
        const n = Math.max(4, Math.min(MAX_SIZE, Math.round(Number(input.value) || value)));
        input.value = String(n);
        apply(n);
      });
      return el('label', { className: 'field' }, [label, input]);
    };

    const view = el('select', { className: 'select' }, [
      el('option', { value: '9', textContent: 'Close (16×9 spaces)' }),
      el('option', { value: '18', textContent: 'Wide (32×18 spaces)' }),
    ]);
    view.value = String(lvl.view);
    view.addEventListener('change', () => {
      lvl.view = Number(view.value) as ViewSize;
      this.changed();
    });

    const bg = el('select', { className: 'select' }, [el('option', { value: '', textContent: '(plain)' })]);
    for (const id of state.backgroundAssetIds) bg.append(el('option', { value: id, textContent: getAsset(id)!.name }));
    bg.value = lvl.background ?? '';
    bg.addEventListener('change', () => {
      lvl.background = bg.value || null;
      this.changed();
    });

    this.settings.replaceChildren(
      el('label', { className: 'field' }, ['Game type', mode]),
      size('Width', lvl.cols, (n) => this.resize(n, lvl.rows)),
      size('Height', lvl.rows, (n) => this.resize(lvl.cols, n)),
      el('label', { className: 'field' }, ['Camera', view]),
      el('label', { className: 'field' }, ['Background', bg]),
    );
  }

  private resize(cols: number, rows: number): void {
    const lvl = this.level;
    const lost = Object.keys(lvl.cells).filter((k) => {
      const [x, y] = parseCellKey(k);
      return x >= cols || y >= rows;
    });
    if (lost.length && !confirm(`Shrinking the level removes ${lost.length} sprite(s) outside the new size. Continue?`)) {
      this.renderSettings();
      return;
    }
    lost.forEach((k) => delete lvl.cells[k]);
    lvl.cols = cols;
    lvl.rows = rows;
    this.renderGrid();
    this.changed();
  }

  // ---------------------------------------------------------------- palette

  private renderPalette(): void {
    const ids = state.spriteAssetIds;
    if (this.brush !== ERASER && !ids.includes(this.brush)) this.brush = ids[0] ?? ERASER;
    const button = (id: string, label: string, img?: string) => {
      const b = el('button', { className: 'palette-item', type: 'button', title: label }, [
        img ? el('img', { src: img, alt: '' }) : el('span', { className: 'eraser-icon', textContent: '⌫' }),
        el('span', { textContent: label }),
      ]);
      b.classList.toggle('active', this.brush === id);
      b.addEventListener('click', () => {
        this.brush = id;
        this.renderPalette();
      });
      return b;
    };
    this.palette.replaceChildren(
      button(ERASER, 'Eraser'),
      ...SPRITE_CLASSES.flatMap((c) => {
        const items = ids.filter((id) => getSprite(id)?.cls === c.id);
        if (!items.length) return [];
        return [
          el('div', { className: 'palette-heading', textContent: c.plural }),
          ...items.map((id) => button(id, getAsset(id)!.name, thumbUrl(getAsset(id)!))),
        ];
      }),
      el('button', {
        className: 'btn small add-assets',
        textContent: '+ Add sprites…',
        type: 'button',
        onclick: () => document.querySelector<HTMLElement>('.tab[data-tab="sprites"]')?.click(),
      }),
    );
  }

  // ---------------------------------------------------------------- grid

  private renderGrid(): void {
    const lvl = this.level;
    this.cellSize = Math.max(22, Math.min(40, Math.floor(1400 / Math.max(lvl.cols, 20))));
    const s = this.cellSize;
    this.grid.style.gridTemplateColumns = `repeat(${lvl.cols}, ${s}px)`;
    this.grid.style.gridAutoRows = `${s}px`;
    this.grid.style.setProperty('--cell', s + 'px');
    const bg = getAsset(lvl.background);
    this.grid.style.backgroundColor = bg?.kind === 'background' ? bg.color : '#9fd8f0';
    this.cells = [];
    const frag = document.createDocumentFragment();
    for (let y = 0; y < lvl.rows; y++) {
      for (let x = 0; x < lvl.cols; x++) {
        const cell = el('div', { className: 'cell' });
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        this.paintCell(cell, lvl.cells[cellKey(x, y)]);
        this.cells.push(cell);
        frag.append(cell);
      }
    }
    this.grid.replaceChildren(frag, this.cameraBox);
    this.updateCameraBox();
    this.status.textContent = this.statusText();
  }

  private paintCell(cell: HTMLElement, assetId: string | undefined): void {
    const asset = getAsset(assetId);
    cell.style.backgroundImage = asset ? `url(${thumbUrl(asset)})` : '';
    cell.title = asset ? asset.name : '';
  }

  /** Outline showing what the camera sees at the start of the level. */
  private updateCameraBox(): void {
    const lvl = this.level;
    const vw = viewCols(lvl.view);
    const vh = lvl.view;
    const playerKey = Object.keys(lvl.cells).find((k) => getSprite(lvl.cells[k])?.cls === 'player');
    const [px, py] = playerKey ? parseCellKey(playerKey) : [0, lvl.rows - 1];
    const left = lvl.cols <= vw ? 0 : Math.max(0, Math.min(lvl.cols - vw, px + 0.5 - vw / 2));
    const top = lvl.rows <= vh ? 0 : Math.max(0, Math.min(lvl.rows - vh, py + 0.5 - vh / 2));
    const s = this.cellSize;
    Object.assign(this.cameraBox.style, {
      left: left * s + 'px',
      top: top * s + 'px',
      width: Math.min(vw, lvl.cols) * s + 'px',
      height: Math.min(vh, lvl.rows) * s + 'px',
    });
    this.cameraBox.title = `Camera view: ${vw}×${vh} spaces`;
  }

  private cellFromEvent(e: PointerEvent): [number, number] | null {
    const rect = this.grid.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / this.cellSize);
    const y = Math.floor((e.clientY - rect.top) / this.cellSize);
    return x >= 0 && y >= 0 && x < this.level.cols && y < this.level.rows ? [x, y] : null;
  }

  private onPointerDown(e: PointerEvent): void {
    const pos = this.cellFromEvent(e);
    if (!pos || (e.button !== 0 && e.button !== 2)) return;
    e.preventDefault();
    this.grid.setPointerCapture(e.pointerId);
    this.painting = e.button === 2 || this.brush === ERASER ? 'erase' : 'paint';
    this.lastCell = pos;
    this.applyBrush(...pos);
  }

  private onPointerMove(e: PointerEvent): void {
    const pos = this.cellFromEvent(e);
    if (!pos) return;
    const asset = getAsset(this.level.cells[cellKey(...pos)]);
    this.status.textContent = `Space ${pos[0]}, ${pos[1]}${asset ? ' – ' + asset.name : ''}`;
    if (!this.painting) return;
    // Fill every cell between the last and current pointer positions so fast drags leave no gaps.
    const [x0, y0] = this.lastCell ?? pos;
    const steps = Math.max(Math.abs(pos[0] - x0), Math.abs(pos[1] - y0));
    for (let i = 1; i <= steps; i++) {
      this.applyBrush(Math.round(x0 + ((pos[0] - x0) * i) / steps), Math.round(y0 + ((pos[1] - y0) * i) / steps));
    }
    this.lastCell = pos;
  }

  private applyBrush(x: number, y: number): void {
    const lvl = this.level;
    const key = cellKey(x, y);
    const value = this.painting === 'erase' ? undefined : this.brush;
    if (lvl.cells[key] === value) return;
    if (value) lvl.cells[key] = value;
    else delete lvl.cells[key];
    this.paintCell(this.cells[y * lvl.cols + x], value);
    this.dirty = true;
  }

  private endPaint(): void {
    if (!this.painting) return;
    this.painting = null;
    this.lastCell = null;
    if (this.dirty) {
      this.dirty = false;
      this.updateCameraBox();
      this.changed();
    }
  }

  private statusText(): string {
    const n = Object.keys(this.level.cells).length;
    return `${this.level.cols}×${this.level.rows} spaces · ${n} sprites · Drag to paint, right-click or use the eraser to remove.`;
  }
}
