// Level editor: a scrollable DOM grid for placing sprites, plus level list and settings.
import { BACKGROUNDS, cellLook, cornerRects, getAsset, getBackground, getSprite, imageUrl, thumbUrl } from '../assets';
import type { GameMode, Level, ViewSize } from '../model';
import { BACKGROUND_COLORS, SPRITE_CLASSES, cellKey, newLevel, parseCellKey, uid, viewCols } from '../model';
import { state } from '../state';
import { confirmDialog, el, promptDialog } from './modal';
import { levelTour, startTour } from './tour';

const ERASER = '__eraser__';
const SELECT = '__select__';

/** Icon for the select tool: a dashed selection box with a grabbing hand. */
const SELECT_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
  '<rect x="2" y="2" width="15" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2"/>' +
  '<path d="M12.5 12.5v-2.2a1.1 1.1 0 0 1 2.2 0v1.2-2.3a1.1 1.1 0 0 1 2.2 0v2.3-1.4a1.1 1.1 0 0 1 2.2 0v1.8-.8a1.1 1.1 0 0 1 2.2 0V17' +
  'a5 5 0 0 1-5 5h-1.1a4.6 4.6 0 0 1-3.6-1.8l-2.4-3.1a1.2 1.2 0 0 1 1.8-1.5l1.5 1.4" fill="#fff" stroke="currentColor" ' +
  'stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>';

/** A rectangle of spaces, inclusive. */
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const inRect = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

/** A small picture of a background and a note on how it behaves. */
function backgroundPreview(id: string): HTMLElement {
  const bg = getBackground(id)!;
  const layer = (img: string | undefined, className: string) => {
    const div = el('div', { className });
    if (img) div.style.backgroundImage = `url(${imageUrl(img)})`;
    if (bg.tint) {
      div.style.backgroundColor = bg.tint;
      div.style.backgroundBlendMode = 'multiply';
    }
    return div;
  };
  // The horizon strip alternates its tiles, as in the game.
  const tiles = bg.strip ?? [];
  const strip = el(
    'div',
    { className: 'bg-strip' },
    Array.from({ length: 4 }, (_, i) => layer(tiles[i % tiles.length], 'bg-strip-tile')),
  );
  const picture =
    bg.type === 'tile'
      ? el('div', { className: 'bg-preview' }, [layer(bg.tile, 'bg-tile')])
      : el('div', { className: 'bg-preview' }, [layer(bg.sky, 'bg-sky'), strip, layer(bg.ground, 'bg-ground')]);
  return el('div', { className: 'bg-info' }, [
    picture,
    el('span', {
      className: 'bg-note',
      textContent:
        bg.type === 'tile'
          ? 'Floor: covers the whole level. Good for top-down games.'
          : 'Sky: scrolls slowly behind the level for a sense of depth. Good for platformers.',
    }),
  ]);
}
const MAX_SIZE = 200;

export class LevelEditor {
  private brush: string = ERASER;
  private cellSize = 36;
  /**
   * - paint: place the brush sprite.
   * - erase: clear every space (eraser or right-click).
   * - unpaint: clear only spaces holding the brush sprite (a stroke that starts on a matching sprite).
   */
  private painting: 'paint' | 'erase' | 'unpaint' | null = null;
  /** Select tool: the selected area, and what a drag is doing (marking an area or moving the selection). */
  private selection: Rect | null = null;
  private selecting: { from: [number, number]; to: [number, number] } | null = null;
  private moving: { from: [number, number]; dx: number; dy: number } | null = null;
  /** Moving a selection also empties the spaces its empty spaces land on ("move empty spaces too"). */
  private moveEmpty = false;
  private selectionBox = el('div', { className: 'selection-box' });
  private selectionPreview = el('canvas', { className: 'selection-preview' });
  /** While moving: the selected sprites faded where they are now (the background stays as it is). */
  private selectionSource = el('canvas', { className: 'selection-source' });
  /** Undo history for each level (by id): earlier and later versions of the level, and the version now. */
  private history = new Map<string, { undo: string[]; redo: string[]; last: string }>();
  private undoButton = el('button', { className: 'btn small', type: 'button', textContent: '↶ Undo', title: 'Undo (Ctrl+Z / ⌘Z)' });
  private redoButton = el('button', { className: 'btn small', type: 'button', textContent: '↷ Redo', title: 'Redo (Ctrl+Shift+Z / ⌘⇧Z)' });
  private lastCell: [number, number] | null = null;
  private dirty = false;
  private cells: HTMLElement[] = [];

  private levelTabs = el('div', { className: 'level-tabs' });
  private settings = el('div', { className: 'level-settings' });
  private palette = el('aside', { className: 'palette' });
  private grid = el('div', { className: 'level-grid' });
  /**
   * The level's sprites, drawn on one canvas behind the cells (which only draw the grid lines). Every space's
   * edges fall on whole screen pixels, so joined pieces meet exactly at any zoom.
   */
  private art = el('canvas', { className: 'level-art' });
  private artScale = 1;
  private images = new Map<string, HTMLImageElement>();
  private redrawQueued = false;
  private cameraBox = el('div', { className: 'camera-box' });
  private status = el('div', { className: 'level-status' });
  private gridScroll = el('div', { className: 'grid-scroll' }, [this.grid]);

  constructor(root: HTMLElement) {
    // "Show me how" replays the level editor tour: the short one for the simplified editor, else the full one.
    const help = el('button', { className: 'btn small level-help', type: 'button', textContent: 'Show me how' });
    help.addEventListener('click', () => startTour(levelTour(root.classList.contains('simple-level'))));
    root.append(
      el('div', { className: 'level-toolbar' }, [this.levelTabs, this.settings]),
      el('div', { className: 'level-body' }, [this.palette, this.gridScroll]),
      el('div', { className: 'level-footer' }, [this.status, help]),
    );
    this.grid.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.grid.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.grid.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointerup', () => this.endPaint());
    // Browser zoom changes the screen pixel size: redraw the art to match.
    window.addEventListener('resize', () => {
      if (window.devicePixelRatio !== this.artScale) this.drawArt();
    });
    this.grid.addEventListener('pointerleave', () => (this.status.textContent = this.statusText()));
    // Escape drops the selection.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.selection && !this.moving) this.clearSelection();
    });

    this.undoButton.addEventListener('click', () => this.undo());
    this.redoButton.addEventListener('click', () => this.redo());
    // Ctrl/⌘+Z undoes and Ctrl/⌘+Shift+Z (or Ctrl+Y) redoes while the level editor is showing.
    window.addEventListener('keydown', (e) => {
      if (!root.classList.contains('active') || !(e.ctrlKey || e.metaKey)) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
      const key = e.key.toLowerCase();
      if (key === 'z' || key === 'y') {
        e.preventDefault();
        if (key === 'y' || e.shiftKey) this.redo();
        else this.undo();
      }
    });

    state.on((kind) => {
      // A newly opened project starts with no history (tutorial steps reuse level ids).
      if (kind === 'project') this.history.clear();
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
    this.updateUndoButtons();
  }

  private get level(): Level {
    return state.level;
  }

  private changed(kind: 'level' | 'levels' = 'level'): void {
    this.record();
    state.emit(kind);
  }

  // ---------------------------------------------------------------- undo

  private historyFor(level: Level) {
    let h = this.history.get(level.id);
    if (!h) this.history.set(level.id, (h = { undo: [], redo: [], last: JSON.stringify(level) }));
    return h;
  }

  /** Remembers the level as it was before this change (one paint stroke, move or setting is one step). */
  private record(): void {
    if (!state.project?.levels.includes(this.level)) return;
    const h = this.historyFor(this.level);
    const now = JSON.stringify(this.level);
    if (now === h.last) return;
    h.undo.push(h.last);
    if (h.undo.length > 100) h.undo.shift();
    h.redo = [];
    h.last = now;
    this.updateUndoButtons();
  }

  private undo(): void {
    const h = this.historyFor(this.level);
    const previous = h.undo.pop();
    if (previous === undefined) return;
    h.redo.push(h.last);
    this.restore(previous);
  }

  private redo(): void {
    const h = this.historyFor(this.level);
    const next = h.redo.pop();
    if (next === undefined) return;
    h.undo.push(h.last);
    this.restore(next);
  }

  /** Puts the current level back to a saved version, without recording that as a new change. */
  private restore(json: string): void {
    const level = this.level as unknown as Record<string, unknown>;
    for (const key of Object.keys(level)) delete level[key];
    Object.assign(level, JSON.parse(json));
    this.historyFor(this.level).last = json;
    this.clearSelection();
    this.render();
    state.emit('level');
  }

  private updateUndoButtons(): void {
    const h = state.project?.levels.length ? this.historyFor(this.level) : null;
    this.undoButton.disabled = !h?.undo.length;
    this.redoButton.disabled = !h?.redo.length;
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
      el('button', { className: 'btn small level-add', textContent: '+ Level', type: 'button', onclick: () => this.addLevel() }),
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
    lvl.color = this.level.color;
    lvl.player = this.level.player;
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

  private async rename(): Promise<void> {
    const name = await promptDialog({
      title: 'Rename level',
      label: 'Level name',
      value: this.level.name,
      confirmLabel: 'Rename',
    });
    if (!name) return;
    this.level.name = name;
    this.changed('levels');
  }

  private async deleteLevel(): Promise<void> {
    if (state.project.levels.length <= 1) return;
    const ok = await confirmDialog({
      title: 'Delete level?',
      message: `Delete “${this.level.name}” and everything placed in it?`,
      confirmLabel: 'Delete level',
      danger: true,
    });
    if (!ok) return;
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
      this.updateCameraBox();
      this.changed();
    });

    const group = (label: string, type: 'scenic' | 'tile') =>
      el(
        'optgroup',
        { label },
        BACKGROUNDS.filter((b) => b.type === type).map((b) => el('option', { value: b.id, textContent: b.name })),
      );
    const bg = el('select', { className: 'select' }, [
      el('option', { value: '', textContent: '(color)' }),
      group('Skies: scenery that scrolls behind', 'scenic'),
      group('Floors: a tile that covers the level', 'tile'),
    ]);
    bg.value = lvl.background ?? '';
    bg.addEventListener('change', () => {
      lvl.background = bg.value || null;
      if (!lvl.background) lvl.color ??= BACKGROUND_COLORS[0];
      this.renderSettings();
      this.renderGridBackground();
      this.changed();
    });

    this.settings.replaceChildren(
      el('label', { className: 'field' }, ['Game type', mode]),
      el('span', { className: 'level-size' }, [
        size('Width', lvl.cols, (n) => this.resize(n, lvl.rows)),
        size('Height', lvl.rows, (n) => this.resize(lvl.cols, n)),
      ]),
      el('label', { className: 'field level-camera' }, ['Camera', view]),
      el('label', { className: 'field level-background' }, ['Background', bg]),
      ...(lvl.background ? [backgroundPreview(lvl.background)] : [this.colorPicker()]),
    );
  }

  /** Curated swatches for a plain background colour. */
  private colorPicker(): HTMLElement {
    const lvl = this.level;
    const current = lvl.color ?? BACKGROUND_COLORS[0];
    return el(
      'div',
      { className: 'swatches', role: 'radiogroup', ariaLabel: 'Background color' },
      BACKGROUND_COLORS.map((color) => {
        const b = el('button', { className: 'swatch', type: 'button', title: color });
        b.style.background = color;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(color === current));
        b.addEventListener('click', () => {
          lvl.color = color;
          this.renderSettings();
          this.renderGridBackground();
          this.changed();
        });
        return b;
      }),
    );
  }

  private async resize(cols: number, rows: number): Promise<void> {
    const lvl = this.level;
    const lost = Object.keys(lvl.cells).filter((k) => {
      const [x, y] = parseCellKey(k);
      return x >= cols || y >= rows;
    });
    const ok =
      !lost.length ||
      (await confirmDialog({
        title: 'Shrink level?',
        message: `${lost.length} sprite${lost.length === 1 ? ' is' : 's are'} outside the new size and will be removed.`,
        confirmLabel: 'Shrink and remove',
        danger: true,
      }));
    if (!ok) {
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
    if (this.brush !== ERASER && this.brush !== SELECT && !ids.includes(this.brush)) this.brush = ids[0] ?? ERASER;
    const button = (id: string, label: string, img?: string, icon?: HTMLElement, title = label) => {
      const b = el('button', { className: 'palette-item', type: 'button', title }, [
        img ? el('img', { src: img, alt: '' }) : (icon ?? el('span')),
        el('span', { className: 'palette-name', textContent: label }),
      ]);
      b.classList.toggle('active', this.brush === id);
      b.addEventListener('click', () => {
        this.brush = id;
        this.clearSelection();
        this.renderPalette();
        this.grid.classList.toggle('selecting', id === SELECT);
      });
      return b;
    };
    const selectIcon = el('span', { className: 'tool-icon', innerHTML: SELECT_ICON });
    const moveEmpty = el('label', {
      className: 'tool-option',
      title: 'When on, empty spaces in the selection clear whatever they land on. When off, only spaces your sprites land on are replaced.',
    }, [
      el('input', {
        type: 'checkbox',
        checked: this.moveEmpty,
        onchange: (e: Event) => (this.moveEmpty = (e.target as HTMLInputElement).checked),
      }),
      'Move empty spaces too',
    ]);
    /** Characters get a star: the starred one is this level's player. */
    const character = (id: string) => {
      const isPlayer = this.level.player === id;
      const star = el('button', {
        className: 'player-star' + (isPlayer ? ' on' : ''),
        type: 'button',
        textContent: isPlayer ? '★' : '☆',
        title: isPlayer ? 'This is the player in this level' : 'Make this the player in this level',
      });
      star.setAttribute('aria-pressed', String(isPlayer));
      star.addEventListener('click', () => this.setPlayer(isPlayer ? null : id));
      return el('div', { className: 'palette-row' }, [button(id, getAsset(id)!.name, thumbUrl(getAsset(id)!)), star]);
    };
    const eraser = button(ERASER, 'Eraser', undefined, el('span', { className: 'tool-icon', textContent: '⌫' }));
    eraser.dataset.tool = 'eraser';
    const select = button(SELECT, 'Select and move', undefined, selectIcon, 'Drag to select an area, then drag the selection to move it');
    select.dataset.tool = 'select';
    this.palette.replaceChildren(
      el('div', { className: 'palette-undo' }, [this.undoButton, this.redoButton]),
      el('div', { className: 'palette-heading', textContent: 'Tools' }),
      eraser,
      select,
      ...(this.brush === SELECT ? [moveEmpty] : []),
      ...(ids.length
        ? []
        : [el('p', { className: 'palette-empty', textContent: 'No sprites yet. Add some on the Sprites tab.' })]),
      ...SPRITE_CLASSES.flatMap((c) => {
        const items = ids.filter((id) => getSprite(id)?.cls === c.id);
        if (!items.length) return [];
        return [
          el('div', { className: 'palette-heading', textContent: c.plural }),
          ...items.map((id) =>
            c.id === 'character' ? character(id) : button(id, getAsset(id)!.name, thumbUrl(getAsset(id)!)),
          ),
        ];
      }),
    );
  }

  private setPlayer(id: string | null): void {
    this.level.player = id;
    this.renderPalette();
    this.renderGrid();
    this.changed();
  }

  // ---------------------------------------------------------------- grid

  private renderGrid(): void {
    const lvl = this.level;
    this.cellSize = Math.max(22, Math.min(40, Math.floor(1400 / Math.max(lvl.cols, 20))));
    const s = this.cellSize;
    this.grid.style.gridTemplateColumns = `repeat(${lvl.cols}, ${s}px)`;
    this.grid.style.gridAutoRows = `${s}px`;
    this.grid.style.setProperty('--cell', s + 'px');
    this.renderGridBackground();
    this.cells = [];
    const frag = document.createDocumentFragment();
    for (let y = 0; y < lvl.rows; y++) {
      for (let x = 0; x < lvl.cols; x++) {
        const cell = el('div', { className: 'cell' });
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        this.paintCell(cell, x, y);
        this.cells.push(cell);
        frag.append(cell);
      }
    }
    this.grid.replaceChildren(this.art, frag, this.cameraBox, this.selectionSource, this.selectionPreview, this.selectionBox);
    this.selection = null;
    this.updateSelectionBox();
    this.drawArt();
    this.updateCameraBox();
    this.status.textContent = this.statusText();
  }

  /** Shows the level's background behind the grid: floors tile per space, scenic skies tile their sky. */
  private renderGridBackground(): void {
    const lvl = this.level;
    const bg = getBackground(lvl.background);
    const style = this.grid.style;
    style.backgroundColor = bg?.color ?? lvl.color ?? BACKGROUND_COLORS[0];
    const tile = bg?.type === 'tile' ? bg.tile : bg?.sky;
    style.backgroundImage = tile ? `url(${imageUrl(tile)})` : '';
    style.backgroundSize = bg?.type === 'tile' ? `${this.cellSize}px` : `${this.cellSize * 3}px`;
    // Tinted skies (sunset, night) multiply their colour over the art, as the game does.
    if (bg?.tint) style.backgroundColor = bg.tint;
    style.backgroundBlendMode = bg?.tint ? 'multiply' : '';
  }

  /** Sizes the art canvas to the grid in screen pixels and draws every space. */
  private drawArt(): void {
    const lvl = this.level;
    const s = this.cellSize;
    this.artScale = window.devicePixelRatio || 1;
    this.art.width = Math.round(lvl.cols * s * this.artScale);
    this.art.height = Math.round(lvl.rows * s * this.artScale);
    this.art.style.width = lvl.cols * s + 'px';
    this.art.style.height = lvl.rows * s + 'px';
    for (let y = 0; y < lvl.rows; y++) for (let x = 0; x < lvl.cols; x++) this.drawSpace(x, y);
  }

  /** Draws one space's sprite (the joined piece and any inner corner steps), filling the space exactly. */
  private drawSpace(x: number, y: number): void {
    const ctx = this.art.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const edge = (n: number) => Math.round(n * this.cellSize * this.artScale);
    const [l, t, r, b] = [edge(x), edge(y), edge(x + 1), edge(y + 1)];
    ctx.clearRect(l, t, r - l, b - t);
    const look = cellLook(this.level.cells, x, y);
    const img = look && this.image(look.image);
    if (!look || !img) return;
    // Square images fill the space exactly, even when rounding makes it a pixel wider than it is tall, so
    // joined pieces meet. Any other shape is fitted inside it, centred.
    const w = r - l;
    const h = b - t;
    if (img.naturalWidth === img.naturalHeight) ctx.drawImage(img, l, t, w, h);
    else {
      const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
      const iw = Math.round(img.naturalWidth * k);
      const ih = Math.round(img.naturalHeight * k);
      ctx.drawImage(img, l + Math.round((w - iw) / 2), t + Math.round((h - ih) / 2), iw, ih);
    }
    if (!look.outline) return;
    ctx.fillStyle = look.outline;
    const px = (n: number, size: number) => Math.round((n * size) / look.pixels);
    for (const [cx, cy, cw, ch] of cornerRects(look.corners, look.pixels)) {
      const x0 = l + px(cx, w);
      const y0 = t + px(cy, h);
      ctx.fillRect(x0, y0, l + px(cx + cw, w) - x0, t + px(cy + ch, h) - y0);
    }
  }

  /** A loaded sprite image, or null while it loads (the art is redrawn once it arrives). */
  private image(name: string): HTMLImageElement | null {
    let img = this.images.get(name);
    if (!img) {
      img = new Image();
      img.onload = () => {
        if (this.redrawQueued) return;
        this.redrawQueued = true;
        requestAnimationFrame(() => {
          this.redrawQueued = false;
          this.drawArt();
        });
      };
      img.src = imageUrl(name);
      this.images.set(name, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  private paintCell(cell: HTMLElement, x: number, y: number): void {
    const assetId = this.level.cells[cellKey(x, y)];
    const asset = getAsset(assetId);
    cell.title = asset ? asset.name + (assetId === this.level.player ? ' (player)' : '') : '';
    cell.classList.toggle('player', !!assetId && assetId === this.level.player);
  }

  /** Outline showing what the camera sees at the start of the level. */
  private updateCameraBox(): void {
    const lvl = this.level;
    const vw = viewCols(lvl.view);
    const vh = lvl.view;
    const playerKey = Object.keys(lvl.cells).find((k) => lvl.player && lvl.cells[k] === lvl.player);
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
    if (this.brush === SELECT && e.button === 0) {
      // Inside the selection: pick it up to move it. Anywhere else: start marking a new area.
      if (this.selection && inRect(this.selection, ...pos)) this.moving = { from: pos, dx: 0, dy: 0 };
      else {
        this.selection = null;
        this.selecting = { from: pos, to: pos };
      }
      this.updateSelectionBox();
      return;
    }
    if (e.button === 2 || this.brush === ERASER) this.painting = 'erase';
    // Starting on a space that already holds the brush sprite toggles it off, and the drag keeps clearing it.
    else this.painting = this.level.cells[cellKey(...pos)] === this.brush ? 'unpaint' : 'paint';
    this.lastCell = pos;
    this.applyBrush(...pos);
  }

  private onPointerMove(e: PointerEvent): void {
    const pos = this.cellFromEvent(e);
    if (!pos) return;
    const asset = getAsset(this.level.cells[cellKey(...pos)]);
    this.status.textContent = `Space ${pos[0]}, ${pos[1]}${asset ? ' – ' + asset.name : ''}`;
    if (this.selecting) {
      this.selecting.to = pos;
      this.updateSelectionBox();
      return;
    }
    if (this.moving && this.selection) {
      // Keep the whole selection inside the level.
      const r = this.selection;
      const lvl = this.level;
      this.moving.dx = Math.max(-r.x0, Math.min(lvl.cols - 1 - r.x1, pos[0] - this.moving.from[0]));
      this.moving.dy = Math.max(-r.y0, Math.min(lvl.rows - 1 - r.y1, pos[1] - this.moving.from[1]));
      this.updateSelectionBox();
      return;
    }
    if (this.brush === SELECT) {
      this.grid.classList.toggle('over-selection', !!this.selection && inRect(this.selection, ...pos));
    }
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
    if (this.painting === 'unpaint' && lvl.cells[key] !== this.brush) return;
    const value = this.painting === 'paint' ? this.brush : undefined;
    if (lvl.cells[key] === value) return;
    if (value) lvl.cells[key] = value;
    else delete lvl.cells[key];
    // The first character painted into a level without a player becomes the player.
    if (value && !lvl.player && getSprite(value)?.cls === 'character') {
      lvl.player = value;
      this.renderPalette();
    }
    // Neighbours of joinable textures may need a different piece now.
    for (let cy = y - 1; cy <= y + 1; cy++) {
      for (let cx = x - 1; cx <= x + 1; cx++) {
        if (cx < 0 || cy < 0 || cx >= lvl.cols || cy >= lvl.rows) continue;
        this.paintCell(this.cells[cy * lvl.cols + cx], cx, cy);
        this.drawSpace(cx, cy);
      }
    }
    this.dirty = true;
  }

  private endPaint(): void {
    if (this.selecting) {
      const { from, to } = this.selecting;
      this.selecting = null;
      // A click without a drag just clears the selection.
      this.selection =
        from[0] === to[0] && from[1] === to[1]
          ? null
          : {
              x0: Math.min(from[0], to[0]),
              y0: Math.min(from[1], to[1]),
              x1: Math.max(from[0], to[0]),
              y1: Math.max(from[1], to[1]),
            };
      this.updateSelectionBox();
      return;
    }
    if (this.moving) {
      const { dx, dy } = this.moving;
      this.moving = null;
      if (dx || dy) this.moveSelection(dx, dy);
      // The selection is cleared once it has been moved (or put back where it was).
      this.clearSelection();
      return;
    }
    if (!this.painting) return;
    this.painting = null;
    this.lastCell = null;
    if (this.dirty) {
      this.dirty = false;
      this.updateCameraBox();
      this.changed();
    }
  }

  // ---------------------------------------------------------------- selection

  private clearSelection(): void {
    this.selection = null;
    this.selecting = null;
    this.moving = null;
    this.grid.classList.remove('over-selection');
    this.updateSelectionBox();
  }

  /** The area being marked, or the selection (shifted while it is being dragged). */
  private shownRect(): Rect | null {
    if (this.selecting) {
      const { from, to } = this.selecting;
      return { x0: Math.min(from[0], to[0]), y0: Math.min(from[1], to[1]), x1: Math.max(from[0], to[0]), y1: Math.max(from[1], to[1]) };
    }
    if (!this.selection) return null;
    const dx = this.moving?.dx ?? 0;
    const dy = this.moving?.dy ?? 0;
    const r = this.selection;
    return { x0: r.x0 + dx, y0: r.y0 + dy, x1: r.x1 + dx, y1: r.y1 + dy };
  }

  /** Draws the dashed border, and while moving, a preview of the selected sprites at the new place. */
  private updateSelectionBox(): void {
    const r = this.shownRect();
    const s = this.cellSize;
    this.selectionBox.hidden = !r;
    this.selectionBox.classList.toggle('moving', !!this.moving);
    this.selectionPreview.hidden = !(r && this.moving && this.selection);
    this.selectionSource.hidden = this.selectionPreview.hidden;
    if (!r) return;
    const w = r.x1 - r.x0 + 1;
    const h = r.y1 - r.y0 + 1;
    Object.assign(this.selectionBox.style, { left: r.x0 * s + 'px', top: r.y0 * s + 'px', width: w * s + 'px', height: h * s + 'px' });
    if (this.selectionPreview.hidden || !this.selection) return;
    const src = this.selection;
    const scale = window.devicePixelRatio || 1;
    const edge = (n: number) => Math.round(n * s * scale);
    const cellRect = (lx: number, ly: number) => [edge(lx), edge(ly), edge(lx + 1) - edge(lx), edge(ly + 1) - edge(ly)] as const;
    const cells = this.selectedCells();
    // Where the sprites are now: each one washed out, so it reads as "leaving". Background squares stay as they are.
    const sw = src.x1 - src.x0 + 1;
    const sh = src.y1 - src.y0 + 1;
    const fade = this.selectionSource;
    fade.width = edge(sw);
    fade.height = edge(sh);
    Object.assign(fade.style, { left: src.x0 * s + 'px', top: src.y0 * s + 'px', width: sw * s + 'px', height: sh * s + 'px' });
    const fctx = fade.getContext('2d')!;
    fctx.imageSmoothingEnabled = false;
    for (const [x, y] of cells) {
      const look = cellLook(this.level.cells, x, y);
      const img = look && this.image(look.image);
      if (img) fctx.drawImage(img, ...cellRect(x - src.x0, y - src.y0));
    }
    fctx.globalCompositeOperation = 'source-atop';
    fctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    fctx.fillRect(0, 0, fade.width, fade.height);
    const canvas = this.selectionPreview;
    canvas.width = Math.round(w * s * scale);
    canvas.height = Math.round(h * s * scale);
    Object.assign(canvas.style, { left: r.x0 * s + 'px', top: r.y0 * s + 'px', width: w * s + 'px', height: h * s + 'px' });
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    // Spaces whose sprites will be replaced (or cleared) by the move get a red wash.
    const moving = new Set(cells.map(([x, y]) => cellKey(x - src.x0, y - src.y0)));
    ctx.fillStyle = 'rgba(224, 82, 79, 0.5)';
    for (let ly = 0; ly < h; ly++) {
      for (let lx = 0; lx < w; lx++) {
        const x = r.x0 + lx;
        const y = r.y0 + ly;
        const occupied = !!this.level.cells[cellKey(x, y)] && !inRect(src, x, y);
        if (occupied && (this.moveEmpty || moving.has(cellKey(lx, ly)))) ctx.fillRect(...cellRect(lx, ly));
      }
    }
    // The moving sprites, tinted blue. Pieces are drawn as they join with each other inside the selection.
    const sprites = document.createElement('canvas');
    sprites.width = canvas.width;
    sprites.height = canvas.height;
    const sctx = sprites.getContext('2d')!;
    sctx.imageSmoothingEnabled = false;
    const shifted: Record<string, string> = {};
    for (const [x, y, id] of cells) shifted[cellKey(x - src.x0, y - src.y0)] = id;
    for (const [x, y] of cells) {
      const look = cellLook(shifted, x - src.x0, y - src.y0);
      const img = look && this.image(look.image);
      if (img) sctx.drawImage(img, ...cellRect(x - src.x0, y - src.y0));
    }
    sctx.globalCompositeOperation = 'source-atop';
    sctx.fillStyle = 'rgba(63, 143, 214, 0.45)';
    sctx.fillRect(0, 0, sprites.width, sprites.height);
    ctx.drawImage(sprites, 0, 0);
  }

  /** The sprites inside the selection, as [x, y, asset id]. */
  private selectedCells(): [number, number, string][] {
    const r = this.selection;
    if (!r) return [];
    const out: [number, number, string][] = [];
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const id = this.level.cells[cellKey(x, y)];
        if (id) out.push([x, y, id]);
      }
    }
    return out;
  }

  /**
   * Moves the selected sprites by (dx, dy). Sprites they land on are replaced. With "move empty spaces too",
   * every space in the new area is emptied first, so the area arrives exactly as it was selected.
   */
  private moveSelection(dx: number, dy: number): void {
    const r = this.selection;
    if (!r) return;
    const lvl = this.level;
    const moved = this.selectedCells();
    for (const [x, y] of moved) delete lvl.cells[cellKey(x, y)];
    if (this.moveEmpty) {
      for (let y = r.y0 + dy; y <= r.y1 + dy; y++) for (let x = r.x0 + dx; x <= r.x1 + dx; x++) delete lvl.cells[cellKey(x, y)];
    }
    for (const [x, y, id] of moved) lvl.cells[cellKey(x + dx, y + dy)] = id;
    // Redraw both areas and their neighbours (joined pieces change at the edges).
    for (let y = Math.min(r.y0, r.y0 + dy) - 1; y <= Math.max(r.y1, r.y1 + dy) + 1; y++) {
      for (let x = Math.min(r.x0, r.x0 + dx) - 1; x <= Math.max(r.x1, r.x1 + dx) + 1; x++) {
        if (x < 0 || y < 0 || x >= lvl.cols || y >= lvl.rows) continue;
        this.paintCell(this.cells[y * lvl.cols + x], x, y);
        this.drawSpace(x, y);
      }
    }
    this.updateCameraBox();
    this.changed();
  }

  private statusText(): string {
    const n = Object.keys(this.level.cells).length;
    return (
      `${this.level.cols}×${this.level.rows} spaces · ${n} sprites · Drag to paint. Start on the same sprite to ` +
      'remove it instead. Right-click or the eraser removes anything. ★ marks the player.'
    );
  }
}
