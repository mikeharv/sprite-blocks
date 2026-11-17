// Level editor: a scrollable DOM grid for placing sprites, plus level list and settings.
import { BACKGROUNDS, cellLook, cornerRects, getAsset, getBackground, getSprite, imageUrl, thumbUrl } from '../assets';
import type { GameMode, Level, ViewSize } from '../model';
import { BACKGROUND_COLORS, SPRITE_CLASSES, cellKey, newLevel, parseCellKey, uid, viewCols } from '../model';
import { state } from '../state';
import { confirmDialog, el, promptDialog } from './modal';

const ERASER = '__eraser__';

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
    root.append(
      el('div', { className: 'level-toolbar' }, [this.levelTabs, this.settings]),
      el('div', { className: 'level-body' }, [this.palette, this.gridScroll]),
      this.status,
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
      size('Width', lvl.cols, (n) => this.resize(n, lvl.rows)),
      size('Height', lvl.rows, (n) => this.resize(lvl.cols, n)),
      el('label', { className: 'field' }, ['Camera', view]),
      el('label', { className: 'field' }, ['Background', bg]),
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
    if (this.brush !== ERASER && !ids.includes(this.brush)) this.brush = ids[0] ?? ERASER;
    const button = (id: string, label: string, img?: string) => {
      const b = el('button', { className: 'palette-item', type: 'button', title: label }, [
        img ? el('img', { src: img, alt: '' }) : el('span', { className: 'eraser-icon', textContent: '⌫' }),
        el('span', { className: 'palette-name', textContent: label }),
      ]);
      b.classList.toggle('active', this.brush === id);
      b.addEventListener('click', () => {
        this.brush = id;
        this.renderPalette();
      });
      return b;
    };
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
    this.palette.replaceChildren(
      button(ERASER, 'Eraser'),
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
    this.grid.replaceChildren(this.art, frag, this.cameraBox);
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
    return (
      `${this.level.cols}×${this.level.rows} spaces · ${n} sprites · Drag to paint. Start on the same sprite to ` +
      'remove it instead. Right-click or the eraser removes anything. ★ marks the player.'
    );
  }
}
