// On-screen controls for touch devices, in a bar under the game: arrows on the left (laid out like a keyboard's),
// and on the right a jump button (platformer levels) plus buttons for keys the learner's "when … key" rules use.
import type { Game } from '../runtime/engine';
import { hasTouch } from './device';
import { el } from './modal';

const ARROWS = ['up', 'left', 'right', 'down'] as const;
const ARROW_LABELS: Record<string, string> = { up: '▲', left: '◀', right: '▶', down: '▼' };
/** Rule keys with their own buttons: three beside Jump on platformer levels, four on top-down ones. */
const MAX_KEYS = { platformer: 3, topdown: 4 };
/** Where each button goes when there are four or five: a diamond (plus the middle), like a game controller's. */
const DIAMOND = ['top', 'left', 'right', 'bottom', 'middle'];

/** Keys that the project's enabled "when … key" blocks listen for, in the order the blocks appear. */
export function ruleKeys(main: object): string[] {
  const keys: string[] = [];
  const walk = (b: { type?: string; enabled?: boolean; fields?: { KEY?: string }; inputs?: Record<string, { block?: unknown }>; next?: { block?: unknown } } | undefined) => {
    if (!b) return;
    if (b.type === 'sb_when_key' && b.enabled !== false && b.fields?.KEY && !keys.includes(b.fields.KEY)) keys.push(b.fields.KEY);
    for (const input of Object.values(b.inputs ?? {})) walk(input.block as never);
    walk(b.next?.block as never);
  };
  ((main as { blocks?: { blocks?: unknown[] } }).blocks?.blocks ?? []).forEach((b) => walk(b as never));
  return keys;
}

const keyLabel = (key: string) => (key === 'space' ? 'Space' : key === 'enter' ? 'Enter' : key.toUpperCase());

export class TouchControls {
  private root = el('div', { className: 'touch-controls' });
  private actions = el('div', { className: 'touch-actions' });
  /** Whether this device gets the controls: touch-first, or touched at least once. */
  enabled = hasTouch();
  private ruleKeyList: string[] = [];
  /** What the right-hand buttons were built for, so they're only rebuilt when that changes. */
  private built = '';
  private held = new Set<string>();

  /** `after` is the game's element: the bar goes right under it. */
  constructor(
    private game: Game,
    after: HTMLElement,
  ) {
    const pad = el(
      'div',
      { className: 'touch-pad' },
      ARROWS.map((k) => this.button(k, ARROW_LABELS[k], `arrow arrow-${k}`, `${k} arrow`)),
    );
    this.root.append(pad, this.actions);
    this.root.hidden = true;
    after.after(this.root);
    // A touchscreen laptop starts with the mouse, but switches on the controls the first time it's touched.
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && !this.enabled) {
        this.enabled = true;
        this.update();
      }
    });
  }

  /** Reads the keys the learner's rules use (call when the game starts). */
  setRules(main: object): void {
    this.ruleKeyList = ruleKeys(main);
    this.built = '';
    this.update();
  }

  /** Shows the controls while a game is being played, with a jump button on platformer levels. */
  update(): void {
    const show = this.enabled && this.game.running && !this.game.finished;
    if (this.root.hidden === show) this.root.hidden = !show;
    document.body.classList.toggle('touch-playing', show);
    this.game.touchControls = show;
    if (!show) {
      this.releaseAll();
      document.body.style.removeProperty('--touch-h');
      return;
    }
    const platformer = this.game.levelMode === 'platformer';
    const extra = this.ruleKeyList
      .filter((k) => !(ARROWS as readonly string[]).includes(k) && !(platformer && k === 'space'))
      .slice(0, platformer ? MAX_KEYS.platformer : MAX_KEYS.topdown);
    const plan = `${platformer}|${extra.join(',')}`;
    if (plan === this.built) {
      if (!document.body.style.getPropertyValue('--touch-h')) this.fitGame();
      return;
    }
    this.built = plan;
    this.releaseAll();
    // Up to three buttons sit in a row (Jump last, at the edge); four or five make a diamond, Jump at the bottom.
    const buttons = extra.map((k) => this.button(k, keyLabel(k), 'extra', `${keyLabel(k)} key`));
    const jump = platformer ? this.button('space', 'Jump', 'jump', 'Jump') : null;
    const diamond = buttons.length + (jump ? 1 : 0) >= 4;
    if (diamond && jump) buttons.splice(3, 0, jump);
    else if (jump) buttons.push(jump);
    if (diamond) buttons.forEach((b, i) => b.classList.add(`at-${DIAMOND[i]}`));
    this.actions.className = `touch-actions ${diamond ? 'diamond' : 'row'}`;
    this.actions.replaceChildren(...buttons);
    this.fitGame();
  }

  /** Shrinks the full-size game to leave room for the bar, however tall its buttons make it. */
  private fitGame(): void {
    document.body.style.setProperty('--touch-h', `${this.root.offsetHeight}px`);
  }

  private button(key: string, label: string, className: string, name: string): HTMLButtonElement {
    const b = el('button', { className: `touch-btn ${className}`, type: 'button', textContent: label, tabIndex: -1 });
    b.setAttribute('aria-label', name);
    const release = () => {
      if (!b.classList.contains('held')) return;
      b.classList.remove('held');
      this.held.delete(key);
      // Another button for the same key may still be held.
      if (![...this.root.querySelectorAll<HTMLElement>('.touch-btn.held')].some((o) => o.dataset.key === key)) {
        this.game.releaseKey(key);
      }
    };
    b.dataset.key = key;
    b.addEventListener('pointerdown', (e) => {
      // Keep focus (and keyboard input) on the game, and stop the touch from scrolling or selecting.
      e.preventDefault();
      try {
        // Keeps the press going if the finger slides off the button.
        b.setPointerCapture(e.pointerId);
      } catch {
        // Not a capturable pointer: the press still counts until it lifts.
      }
      b.classList.add('held');
      this.held.add(key);
      this.game.pressKey(key);
    });
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  }

  private releaseAll(): void {
    this.root.querySelectorAll('.touch-btn.held').forEach((b) => b.classList.remove('held'));
    this.held.forEach((k) => this.game.releaseKey(k));
    this.held.clear();
  }
}
