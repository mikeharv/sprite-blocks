// Sprites tab: choose which sprites and sounds are part of the project.
import { ASSETS, SOUNDS, cellBackground, cellLook, getAsset, getSound, imageUrl, thumbUrl, type SoundInfo } from '../assets';
import { FieldSound, soundIcon } from '../blocks/fields';
import type { SpriteAsset } from '../model';
import { SPRITE_CLASSES } from '../model';
import { playSound, unlockAudio } from '../runtime/audio';
import { state } from '../state';
import { mainWorkspace, pathsWorkspace } from '../workspaces';
import { confirmDialog, el } from './modal';

const TURN_LABEL = { flip: 'turns to face movement', rotate: 'rotates to face movement', none: 'does not turn' };

const CLASS_HINT: Record<SpriteAsset['cls'], string> = {
  character: 'Characters move around. Star one in the level editor to make it the player; the rest are yours to program.',
  platform: 'Stand on platforms and jump up through them from below.',
  obstacle: 'Obstacles are solid on every side.',
  item: 'Things to collect, throw, avoid, reach or decorate with. Your rules decide what they do.',
};

function describe(asset: SpriteAsset): string {
  if (asset.join) {
    const pieces = asset.join.edges.length;
    const corners = asset.frames.length - pieces;
    return (
      `joins up ${{ row: 'in rows', column: 'in columns', grid: 'in rows and columns' }[asset.join.connect]} · ${pieces} pieces` +
      (corners ? ` + ${corners} inner corners` : '')
    );
  }
  const n = asset.frames.length;
  const anim = n === 1 ? '1 costume' : `${n} costumes, ${asset.animate === 'move' ? 'animate when moving' : 'always animate'}`;
  const extras = [anim, TURN_LABEL[asset.turn]];
  if (asset.cls === 'character' && asset.gravity === false) extras.push('flies');
  if (asset.cls === 'item' && asset.layer === 'back') extras.push('drawn behind');
  return extras.join(' · ');
}

/** Number of blocks that use a sound. */
function soundUses(id: string): number {
  let n = 0;
  for (const ws of [mainWorkspace(), pathsWorkspace()]) {
    for (const block of ws.getAllBlocks(false)) {
      for (const input of block.inputList) {
        for (const field of input.fieldRow) if (field instanceof FieldSound && field.getValue() === id) n++;
      }
    }
  }
  return n;
}

/** A small joined-up shape (a row or a block) showing how a texture fits together. */
function joinPreview(asset: SpriteAsset): HTMLElement {
  const shape = { row: ['###'], column: ['#', '#', '#'], grid: ['##.', '###', '###'] }[asset.join!.connect];
  const cells: Record<string, string> = {};
  shape.forEach((line, y) => [...line].forEach((c, x) => c === '#' && (cells[x + ',' + y] = asset.id)));
  const preview = el('span', { className: 'join-preview' });
  preview.style.gridTemplateColumns = `repeat(${shape[0].length}, 18px)`;
  shape.forEach((line, y) =>
    [...line].forEach((_, x) => {
      const tile = el('span');
      tile.style.background = cellBackground(cellLook(cells, x, y), 18);
      preview.append(tile);
    }),
  );
  return preview;
}

export class AssetLibrary {
  private body = el('div', { className: 'library' });

  constructor(root: HTMLElement) {
    root.append(this.body);
    state.on((kind) => {
      if (kind === 'project' || kind === 'assets' || kind === 'sounds') this.render();
    });
  }

  private render(): void {
    const selected = new Set(state.project.assets);
    this.body.replaceChildren(
      el('p', {
        className: 'hint',
        textContent:
          'Click a card to add it to your project or remove it. Added sprites appear in the level editor and in ' +
          'block dropdowns; added sounds appear in sound blocks. Backgrounds are chosen for each level on the Levels tab.',
      }),
    );
    for (const c of SPRITE_CLASSES) {
      const grid = el('div', { className: 'library-grid' });
      for (const asset of ASSETS) {
        if (asset.kind === 'sprite' && asset.cls === c.id) grid.append(this.card(asset, selected.has(asset.id)));
      }
      this.body.append(
        el('h3', { textContent: c.plural[0].toUpperCase() + c.plural.slice(1) }),
        el('p', { className: 'hint class-hint', textContent: CLASS_HINT[c.id] }),
        grid,
      );
    }

    const sounds = new Set(state.project.sounds);
    const grid = el('div', { className: 'library-grid' });
    for (const s of SOUNDS) grid.append(this.soundCard(s, sounds.has(s.id)));
    this.body.append(
      el('h3', { textContent: 'Sounds' }),
      el('p', {
        className: 'hint class-hint',
        textContent: 'Click to listen and add. 🎵 tunes are short melodies; 🔊 effects are quick sounds.',
      }),
      grid,
    );
  }

  private card(asset: SpriteAsset, isSelected: boolean): HTMLElement {
    const costumes = asset.join
      ? joinPreview(asset)
      : asset.frames.length > 1
        ? el(
            'span',
            { className: 'costumes' },
            asset.frames.map((f) => el('img', { src: imageUrl(f), alt: '' })),
          )
        : null;
    const card = el('button', { className: 'library-card', type: 'button' }, [
      el('img', { src: thumbUrl(asset), alt: '' }),
      el('span', { className: 'name', textContent: asset.name }),
      costumes,
      el('span', { className: 'meta', textContent: describe(asset) }),
    ]);
    card.classList.toggle('selected', isSelected);
    card.setAttribute('aria-pressed', String(isSelected));
    card.addEventListener('click', () => this.toggle(asset.id));
    return card;
  }

  private soundCard(sound: SoundInfo, isSelected: boolean): HTMLElement {
    const card = el('button', { className: 'library-card sound-card', type: 'button', title: 'Play and add or remove' }, [
      el('span', { className: 'sound-icon', textContent: soundIcon(sound.id) }),
      el('span', { className: 'name', textContent: sound.name }),
      el('span', { className: 'meta', textContent: sound.kind === 'tune' ? 'tune' : 'effect' }),
    ]);
    card.classList.toggle('selected', isSelected);
    card.setAttribute('aria-pressed', String(isSelected));
    card.addEventListener('click', () => this.toggleSound(sound.id));
    return card;
  }

  private async toggle(id: string): Promise<void> {
    const project = state.project;
    if (!project.assets.includes(id)) {
      const order = ASSETS.map((a) => a.id);
      project.assets = order.filter((a) => a === id || project.assets.includes(a));
      state.emit('assets');
      return;
    }
    const used = project.levels.filter((l) => Object.values(l.cells).includes(id));
    if (used.length) {
      const where = used.map((l) => '“' + l.name + '”').join(', ');
      const ok = await confirmDialog({
        title: `Remove ${getAsset(id)!.name}?`,
        message: `It is placed in ${where}. Removing it from the project also removes it from ${used.length === 1 ? 'that level' : 'those levels'}.`,
        confirmLabel: 'Remove',
        danger: true,
      });
      if (!ok) return;
    }
    for (const level of project.levels) {
      for (const [key, value] of Object.entries(level.cells)) if (value === id) delete level.cells[key];
      if (level.player === id) level.player = null;
    }
    project.assets = project.assets.filter((a) => a !== id);
    state.emit('assets');
  }

  /** Adds or removes a sound; adding plays it as a preview. */
  private async toggleSound(id: string): Promise<void> {
    const project = state.project;
    if (!project.sounds.includes(id)) {
      unlockAudio();
      playSound(id);
      project.sounds = SOUNDS.map((s) => s.id).filter((s) => s === id || project.sounds.includes(s));
      state.emit('sounds');
      return;
    }
    const uses = soundUses(id);
    if (uses) {
      const ok = await confirmDialog({
        title: `Remove ${getSound(id)!.name}?`,
        message: `${uses} block${uses === 1 ? ' uses' : 's use'} this sound. ${uses === 1 ? 'It' : 'They'} will show a warning until you pick another sound.`,
        confirmLabel: 'Remove',
        danger: true,
      });
      if (!ok) return;
    }
    project.sounds = project.sounds.filter((s) => s !== id);
    state.emit('sounds');
  }
}
