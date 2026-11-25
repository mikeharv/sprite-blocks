// Optional guided tour: spotlights each part of the app and explains the flow of making a game.
import { el } from './modal';

export interface TourStep {
  title: string;
  text: string;
  /** Element to spotlight. Omitted for centred steps. */
  target?: string;
  /** Tab to switch to before showing the step. */
  tab?: string;
}

const APP_STEPS: TourStep[] = [
  {
    title: 'Welcome to Sprite Paths!',
    text:
      'You make a game in four steps, left to right along the tabs: choose sprites, build levels, add rules ' +
      'with blocks, and give sprites paths to follow. Then press Run, play, and keep improving it. ' +
      'This short tour shows where each step happens.',
  },
  {
    title: '1. Sprites',
    tab: 'sprites',
    target: '.editor-pane',
    text:
      'Start by adding sprites and sounds to your project. Characters move around, platforms can be jumped ' +
      'through from below, obstacles are solid, and items do whatever your rules say. Click a sound to hear it.',
  },
  {
    title: '2. Levels',
    tab: 'level',
    target: '.editor-pane',
    text:
      'Pick a sprite from the palette and click or drag across the grid to place it; use the eraser or ' +
      'right-click to remove. The ★ next to a character makes it the player. Choose platformer or top-down, ' +
      'the size, the camera and a background. The dashed box shows what the camera sees.',
  },
  {
    title: '3. Rules',
    tab: 'rules',
    target: '.editor-pane',
    text:
      'Rules go here. Start with an Events block such as “when the player touches coin”, then add actions: ' +
      'remove “other sprite”, change the score, play a sound, go to the next level… Blocks that aren’t ' +
      'inside an event don’t run.',
  },
  {
    title: '4. Paths',
    tab: 'paths',
    target: '.editor-pane',
    text:
      'Paths make sprites move by themselves, like an enemy that patrols, a coin that bobs or a sparkle ' +
      'that flies forward. Build them from move blocks here, then use “set path” on the Rules tab to give ' +
      'them to sprites.',
  },
  {
    title: 'Run and play',
    target: '.game-pane',
    text:
      'Press Run to play, then click the game so it gets your keyboard. ⤢ makes the game bigger and ' +
      '{ } shows the code your blocks make. Change something, run again, repeat!',
  },
  {
    title: 'Save your work',
    target: '.file-actions',
    text:
      'Your game is autosaved in this browser, but give it a name and press Save to keep versions you can ' +
      'Open later. Export downloads a file you can share; Import loads one. New starts over or opens an ' +
      'example game. You can replay this tour with the Tour button.',
  },
];

/** A short tour of the simplified level editor that tutorials show (just the grid and the palette). */
export const LEVEL_EDITOR_STEPS: TourStep[] = [
  {
    title: 'Build your level',
    target: '.level-body',
    text: 'This is where you build the level for your game: put sprites where you want them. Let’s look around!',
  },
  {
    title: 'Pick a sprite',
    target: '.palette',
    text: 'These are your sprites. Click one to pick it. People and animals are at the top, then walls, then other things.',
  },
  {
    title: 'Paint it in',
    target: '.grid-scroll',
    text: 'Click a square to put your sprite there. Hold the mouse down and drag to paint lots of squares at once.',
  },
  {
    title: 'Choose the player',
    target: '.palette-row',
    text: 'Click the ☆ next to a character to make it the player. That’s the one you move with the arrow keys.',
  },
  {
    title: 'Fix mistakes',
    target: '[data-tool="eraser"]',
    text: 'Pick the eraser and click squares to clear them. You can also click a sprite again with the same sprite picked.',
  },
  {
    title: 'Move things around',
    target: '[data-tool="select"]',
    text: 'Pick this, then drag a box around some sprites. Drag the box to move them all at once.',
  },
  {
    title: 'Try it out',
    target: '.game-pane',
    text: 'Press ▶ Run to play your new level. You can see this tour again with the “Show me how” button.',
  },
];

/** The level editor tour with every control: levels, size, camera and background, then painting. */
export const LEVEL_EDITOR_FULL_STEPS: TourStep[] = [
  {
    title: 'Your levels',
    target: '.level-tabs',
    text: 'A big game can have lots of levels. Click a level’s name to work on it. The game starts on level 1, and “go to next level” goes along this list.',
  },
  {
    title: 'Add a level',
    target: '.level-add',
    text: '+ Level adds a new, empty level at the end. Double-click a level’s name to rename it.',
  },
  {
    title: 'Make it bigger',
    target: '.level-size',
    text: 'Change the Width and Height to make the level bigger. The camera follows the player, so a big level scrolls as you move.',
  },
  {
    title: 'Camera',
    target: '.level-camera',
    text: 'Close shows a small part of the level. Wide shows more of it at once.',
  },
  {
    title: 'Background',
    target: '.level-background',
    text: 'Pick a sky that scrolls behind the level, a floor tile, or a plain color.',
  },
  {
    title: 'Build it',
    target: '.level-body',
    text: 'Pick a sprite on the left and click or drag on the grid to paint it. Use the ☆ to choose the player, the eraser to fix mistakes, and Undo if you change your mind.',
  },
  {
    title: 'Try it out',
    target: '.game-pane',
    text: 'Press ▶ Run to play. The game starts on level 1. You can see this tour again with the “Show me how” button.',
  },
];

/** The tour for the level editor as shown: simplified (tutorials) or with every control. */
export function levelTour(simple: boolean): TourStep[] {
  return simple ? LEVEL_EDITOR_STEPS : LEVEL_EDITOR_FULL_STEPS;
}

let active: { close: () => void } | null = null;

/** Shows a tour: the full app tour, or the given steps. `onClose` runs when it ends or is skipped. */
export function startTour(STEPS: TourStep[] = APP_STEPS, onClose?: () => void): void {
  active?.close();
  let index = 0;

  const spotlight = el('div', { className: 'tour-spotlight' });
  const title = el('h3');
  const text = el('p');
  const progress = el('span', { className: 'tour-progress' });
  const back = el('button', { className: 'btn', type: 'button', textContent: 'Back' });
  const next = el('button', { className: 'btn primary', type: 'button' });
  const skip = el('button', { className: 'btn tour-skip', type: 'button', textContent: 'Skip tour' });
  const card = el('div', { className: 'tour-card' }, [
    title,
    text,
    el('div', { className: 'tour-actions' }, [progress, el('span', { className: 'spacer' }), skip, back, next]),
  ]);
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-live', 'polite');
  const layer = el('div', { className: 'tour-layer' }, [spotlight, card]);
  document.body.append(layer);

  const place = () => {
    const step = STEPS[index];
    const target = step.target ? document.querySelector<HTMLElement>(step.target) : null;
    const rect = target?.getBoundingClientRect();
    layer.classList.toggle('centered', !rect);
    if (!rect) {
      Object.assign(spotlight.style, { left: '50%', top: '50%', width: '0px', height: '0px' });
      Object.assign(card.style, { left: '', top: '' });
      return;
    }
    const pad = 6;
    Object.assign(spotlight.style, {
      left: rect.left - pad + 'px',
      top: rect.top - pad + 'px',
      width: rect.width + pad * 2 + 'px',
      height: rect.height + pad * 2 + 'px',
    });
    // Put the card beside the target where there is room, otherwise below or inside it.
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left: number;
    let top: number;
    if (rect.right + 16 + cw < vw) {
      left = rect.right + 16;
      top = rect.top;
    } else if (rect.left - 16 - cw > 0) {
      left = rect.left - 16 - cw;
      top = rect.top;
    } else if (rect.bottom + 16 + ch < vh) {
      left = rect.left;
      top = rect.bottom + 16;
    } else {
      left = rect.left + (rect.width - cw) / 2;
      top = rect.top + 40;
    }
    card.style.left = Math.max(12, Math.min(vw - cw - 12, left)) + 'px';
    card.style.top = Math.max(12, Math.min(vh - ch - 12, top)) + 'px';
  };

  const show = () => {
    const step = STEPS[index];
    if (step.tab) document.querySelector<HTMLElement>(`.tab[data-tab="${step.tab}"]`)?.click();
    title.textContent = step.title;
    text.textContent = step.text;
    progress.textContent = `${index + 1} of ${STEPS.length}`;
    back.disabled = index === 0;
    next.textContent = index === STEPS.length - 1 ? 'Finish' : index === 0 ? 'Start' : 'Next';
    // On a short screen the target may be scrolled out of sight.
    if (step.target) document.querySelector(step.target)?.scrollIntoView({ block: 'nearest' });
    requestAnimationFrame(place);
    next.focus();
  };

  const close = () => {
    onClose?.();
    layer.remove();
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    document.removeEventListener('keydown', onKey);
    active = null;
  };
  const go = (delta: number) => {
    const i = index + delta;
    if (i >= STEPS.length) return close();
    index = Math.max(0, i);
    show();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  };

  back.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  skip.addEventListener('click', close);
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  document.addEventListener('keydown', onKey);
  active = { close };
  show();
}
