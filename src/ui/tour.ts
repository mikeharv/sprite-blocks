// Optional guided tour: spotlights each part of the app and explains the flow of making a game.
import { el } from './modal';

interface TourStep {
  title: string;
  text: string;
  /** Element to spotlight. Omitted for centred steps. */
  target?: string;
  /** Tab to switch to before showing the step. */
  tab?: string;
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to Sprite Blocks!',
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

let active: { close: () => void } | null = null;

export function startTour(): void {
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
    requestAnimationFrame(place);
    next.focus();
  };

  const close = () => {
    layer.remove();
    window.removeEventListener('resize', place);
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
  document.addEventListener('keydown', onKey);
  active = { close };
  show();
}
