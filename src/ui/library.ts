// Sprites tab: choose which sprites and backgrounds are part of the project, and preview sounds.
import { ASSETS, SOUNDS, imageUrl, thumbUrl } from '../assets';
import type { Asset } from '../model';
import { SPRITE_CLASSES } from '../model';
import { playSound, unlockAudio } from '../runtime/audio';
import { state } from '../state';
import { el } from './modal';

const TURN_LABEL = { flip: 'turns to face movement', rotate: 'rotates to face movement', none: 'does not turn' };

function describe(asset: Asset): string {
  if (asset.kind === 'background') return asset.type === 'tile' ? 'tiled floor' : 'scenic sky';
  const n = asset.frames.length;
  const anim = n === 1 ? '1 costume' : `${n} costumes, ${asset.animate === 'move' ? 'animate when moving' : 'always animate'}`;
  return `${anim} · ${TURN_LABEL[asset.turn]}${asset.oneWay ? ' · one-way' : ''}`;
}

export class AssetLibrary {
  private body = el('div', { className: 'library' });

  constructor(root: HTMLElement) {
    root.append(this.body);
    state.on((kind) => {
      if (kind === 'project' || kind === 'assets') this.render();
    });
  }

  private render(): void {
    const selected = new Set(state.project.assets);
    const groups = [
      ...SPRITE_CLASSES.map((c) => ({
        title: c.plural[0].toUpperCase() + c.plural.slice(1),
        assets: ASSETS.filter((a) => a.kind === 'sprite' && a.cls === c.id),
      })),
      { title: 'Backgrounds', assets: ASSETS.filter((a) => a.kind === 'background') },
    ];

    this.body.replaceChildren(
      el('p', {
        className: 'hint',
        textContent:
          'Click a card to add it to your project or remove it. Added sprites appear in the level editor and in ' +
          'block dropdowns. A sprite’s class (player, hazard…) decides how it behaves.',
      }),
    );
    for (const group of groups) {
      const grid = el('div', { className: 'library-grid' });
      for (const asset of group.assets) grid.append(this.card(asset, selected.has(asset.id)));
      this.body.append(el('h3', { textContent: group.title }), grid);
    }

    const sounds = el('div', { className: 'sound-list' });
    for (const s of SOUNDS) {
      sounds.append(
        el('button', {
          className: 'btn small sound-button',
          type: 'button',
          textContent: '▶ ' + s.name,
          title: 'Play “' + s.name + '”',
          onclick: () => {
            unlockAudio();
            playSound(s.id);
          },
        }),
      );
    }
    this.body.append(
      el('h3', { textContent: 'Sounds' }),
      el('p', {
        className: 'hint',
        textContent: 'All sounds are available in the “play sound” and “set sound for” blocks. Click to listen.',
      }),
      sounds,
    );
  }

  private card(asset: Asset, isSelected: boolean): HTMLElement {
    const costumes =
      asset.kind === 'sprite' && asset.frames.length > 1
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

  private toggle(id: string): void {
    const project = state.project;
    if (!project.assets.includes(id)) {
      const order = ASSETS.map((a) => a.id);
      project.assets = order.filter((a) => a === id || project.assets.includes(a));
      state.emit('assets');
      return;
    }
    const used = project.levels.filter((l) => Object.values(l.cells).includes(id) || l.background === id);
    if (used.length && !confirm(`This is used in ${used.map((l) => '“' + l.name + '”').join(', ')}. Remove it from those levels too?`)) {
      return;
    }
    for (const level of project.levels) {
      for (const [key, value] of Object.entries(level.cells)) if (value === id) delete level.cells[key];
      if (level.background === id) level.background = null;
    }
    project.assets = project.assets.filter((a) => a !== id);
    state.emit('assets');
  }
}
