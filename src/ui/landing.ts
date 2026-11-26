// The start page: a map of the tutorial paths (start here, then follow the arrows), or free play in the full
// editor. The arrows come from each tutorial's `start` and `after` fields.
import { getTutorial, TUTORIALS } from '../tutorial/content';
import { loadProgress, passedCount, resetProgress } from '../tutorial/progress';
import type { Tutorial } from '../tutorial/types';
import { loadAutosave } from '../storage';
import { confirmDialog, el } from './modal';

const asset = (path: string) => import.meta.env.BASE_URL + 'assets/' + path;
const SVG = 'http://www.w3.org/2000/svg';
/** Length of an arrowhead, in pixels. Lines stop this far short of a card, where the head's back edge sits. */
const HEAD = 14;
/** Distance between the dots of a trail not yet walked (matches `.path-link.todo` in style.css). */
const DOT_SPACING = 9.1;
/** Every trail ends with a short straight run, so it meets the arrowhead head-on. */
const LEAD_IN = 12;

/**
 * Where each path sits on the map (a grid area; see `.path-map` in style.css): two columns, a row per stage.
 * More Blocks leads down to Bigger Games and Variables; Variables leads down to Loops and Logic, and Paths arcs
 * around Variables to reach it. A path missing here goes at the end.
 */
const MAP_AREAS: Record<string, string> = {
  'more-blocks': 'more',
  paths: 'paths',
  'bigger-games': 'bigger',
  variables: 'vars',
  'loops-logic': 'logic',
};

interface PathState {
  done: number;
  total: number;
  started: boolean;
  finished: boolean;
}

function pathState(t: Tutorial): PathState {
  const progress = loadProgress(t.id);
  const total = t.steps.length;
  const done = passedCount(progress, total);
  return { done, total, started: done > 0 || Object.keys(progress.steps).length > 0, finished: done === total };
}

export function showLanding(root: HTMLElement): void {
  const states = new Map(TUTORIALS.map((t) => [t.id, pathState(t)]));
  const starts = TUTORIALS.filter((t) => t.start);
  const finished = (id: string) =>
    id === 'start' ? starts.some((t) => states.get(t.id)!.finished) : !!states.get(id)?.finished;
  const nameOf = (id: string) => (id === 'start' ? 'a first path' : (getTutorial(id)?.title ?? id));

  const tutorialCard = (t: Tutorial) => {
    const { done, total, started, finished: isDone } = states.get(t.id)!;
    const status = isDone
      ? 'Finished ✓'
      : started
        ? `Step ${Math.min(loadProgress(t.id).step, total - 1) + 1} of ${total}`
        : `${total} steps`;
    const open = `#/tutorial/${t.id}`;
    const startOver = el('button', { className: 'btn small', type: 'button', textContent: 'Start over' });
    startOver.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Start over?',
        message: `This clears your work in every step of “${t.title}” and starts again at step 1.`,
        confirmLabel: 'Start over',
        danger: true,
      });
      if (!ok) return;
      resetProgress(t.id);
      location.hash = `${open}/1`;
    });
    // Not started: one way in. Started or finished: pick up where you were, or start again.
    const actions = started
      ? [startOver, el('a', { className: 'btn primary small', href: open, textContent: 'Resume' })]
      : [el('a', { className: 'btn primary small', href: open, textContent: 'Start' })];
    // Ready for it: everything it builds on is finished, and it isn't started yet.
    const after = t.after ?? [];
    const ready = !t.start && !started && after.every(finished);
    const card = el('div', { className: 'landing-card tutorial-card' + (isDone ? ' finished' : ready ? ' ready' : '') }, [
      el('a', { className: 'landing-thumb-link', href: open, tabIndex: -1, ariaHidden: 'true' }, [
        el('img', { className: 'landing-thumb', src: asset(t.thumbnail), alt: '' }),
      ]),
      el('div', { className: 'landing-card-body' }, [
        ...(ready ? [el('span', { className: 'path-badge next', textContent: 'Up next' })] : []),
        el('h3', { textContent: t.title }),
        el('p', { textContent: t.description }),
        ...(after.length
          ? [el('p', { className: 'path-after', textContent: `Builds on ${after.map(nameOf).join(' and ')}` })]
          : []),
        el('div', { className: 'landing-card-foot' }, [
          el('span', { className: 'landing-progress', textContent: status }),
          el('span', { className: 'landing-actions' }, actions),
        ]),
        el('div', { className: 'progress-track', ariaHidden: 'true' }, [
          (() => {
            const fill = el('span', { className: 'progress-fill' });
            fill.style.width = `${(done / total) * 100}%`;
            return fill;
          })(),
        ]),
      ]),
    ]);
    card.dataset.path = t.id;
    return card;
  };

  // The first paths, together: either one is a fine place to begin.
  const startGroup = el('div', { className: 'path-start' }, [
    el('div', { className: 'path-start-head' }, [
      el('span', { className: 'path-badge start', textContent: '★ Start here' }),
      el('span', { className: 'path-start-note', textContent: 'Pick either one. They teach the same blocks.' }),
    ]),
    el(
      'div',
      { className: 'path-start-cards' },
      starts.flatMap((t, i) => (i ? [el('span', { className: 'path-or', textContent: 'or' }), tutorialCard(t)] : [tutorialCard(t)])),
    ),
  ]);
  startGroup.dataset.path = 'start';

  const later = TUTORIALS.filter((t) => !t.start).map((t) => {
    const card = tutorialCard(t);
    if (MAP_AREAS[t.id]) card.style.gridArea = MAP_AREAS[t.id];
    return card;
  });
  const links = document.createElementNS(SVG, 'svg');
  links.classList.add('path-links');
  links.setAttribute('aria-hidden', 'true');
  const map = el('div', { className: 'path-map' }, [startGroup, ...later]);
  map.prepend(links);

  let current: string | null = null;
  try {
    current = loadAutosave()?.name ?? null;
  } catch {
    current = null;
  }

  root.replaceChildren(
    el('div', { className: 'landing' }, [
      el('section', { className: 'landing-hero' }, [
        el('h1', { textContent: 'Make your own game' }),
        el('p', { textContent: 'Paint levels, send sprites along paths, and write the rules with blocks.' }),
        el('a', { className: 'landing-card free-card', href: '#/play' }, [
          el('div', { className: 'free-icon', textContent: '🎮', ariaHidden: 'true' }),
          el('div', { className: 'landing-card-body' }, [
            el('h3', { textContent: 'Open the game maker' }),
            el('p', {
              textContent: current
                ? `Every block, sprite and sound. Pick up where you left off with “${current}”.`
                : 'Every block, sprite and sound. Start from an example or a blank game.',
            }),
          ]),
          el('span', { className: 'btn primary', textContent: 'Open' }),
        ]),
      ]),
      el('section', { className: 'landing-section' }, [
        el('h2', { textContent: 'Choose your path' }),
        el('p', {
          className: 'landing-note',
          textContent: 'Each path builds one game, a step at a time. Start at the top, then follow the arrows to the next ones.',
        }),
        map,
      ]),
    ]),
  );

  // Arrows follow the cards as the page resizes and the pictures load.
  const draw = () => drawLinks(map, links, finished);
  const observer = new ResizeObserver(draw);
  observer.observe(map);
  map.querySelectorAll('.landing-card').forEach((c) => observer.observe(c));
  draw();
}

/**
 * Draws an arrow from each path to every path that builds on it. A path below another gets an arrow from the
 * bottom of one to the top of the other; a path beside another gets one from side to side. Arrows from finished
 * paths are solid; the rest are a dotted trail. On a narrow page the cards stack and "Builds on" says it instead.
 */
function drawLinks(map: HTMLElement, svg: SVGSVGElement, finished: (id: string) => boolean): void {
  svg.replaceChildren();
  if (getComputedStyle(svg).display === 'none') return;
  const origin = map.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`);
  svg.setAttribute('width', String(origin.width));
  svg.setAttribute('height', String(origin.height));
  const box = (id: string) => {
    const node = map.querySelector<HTMLElement>(`:scope > [data-path="${id}"]`);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { l: r.left - origin.left, t: r.top - origin.top, r: r.right - origin.left, b: r.bottom - origin.top };
  };

  const defs = document.createElementNS(SVG, 'defs');
  for (const kind of ['todo', 'done']) {
    const marker = document.createElementNS(SVG, 'marker');
    marker.id = `path-arrow-${kind}`;
    // Anchored at the middle of its back edge: the line ends there, and the point reaches the card.
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '0');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    marker.setAttribute('markerWidth', String(HEAD));
    marker.setAttribute('markerHeight', String(HEAD));
    marker.setAttribute('orient', 'auto-start-reverse');
    const head = document.createElementNS(SVG, 'path');
    head.setAttribute('d', 'M0 0L10 5L0 10Z');
    head.classList.add('path-arrowhead', kind);
    marker.append(head);
    defs.append(marker);
  }
  svg.append(defs);

  // Every card and the start group: an arrow that would run straight through one arcs around it instead.
  const boxes = [...map.querySelectorAll<HTMLElement>(':scope > [data-path]')].map((n) => ({ id: n.dataset.path!, ...box(n.dataset.path!)! }));
  const blocked = (x1: number, x2: number, y1: number, y2: number, skip: string[]) =>
    boxes.some((b) => !skip.includes(b.id) && b.l < Math.max(x1, x2) + 4 && b.r > Math.min(x1, x2) - 4 && b.t < y2 && b.b > y1);

  for (const t of TUTORIALS) {
    const to = box(t.id);
    if (!to) continue;
    const gap = 6;
    // How each arrow arrives: from above (side by side if several), from beside, or arcing around a card.
    const routes = (t.after ?? []).flatMap((from) => {
      const a = box(from);
      if (!a) return [];
      const below = to.t >= a.b;
      const tx = (to.l + to.r) / 2;
      const sx = Math.max(a.l + 24, Math.min(a.r - 24, tx));
      const kind = !below ? ('beside' as const) : blocked(sx, tx, a.b, to.t, [from, t.id]) ? ('arc' as const) : ('above' as const);
      return [{ from, a, kind }];
    });
    const fromAbove = routes.filter((r) => r.kind === 'above');
    routes.forEach(({ from, a, kind: route }) => {
      let d: string;
      if (route === 'above') {
        // Below: leave the bottom (under the target, if the source is wide) and arrive at the top.
        const spread = (fromAbove.findIndex((r) => r.from === from) - (fromAbove.length - 1) / 2) * 44;
        const tx = (to.l + to.r) / 2 + spread;
        const sx = Math.max(a.l + 24, Math.min(a.r - 24, tx));
        const sy = a.b + gap;
        const ty = to.t - gap - HEAD;
        const by = ty - LEAD_IN;
        const bend = (by - sy) / 2;
        d = `M${sx} ${sy}C${sx} ${sy + bend} ${tx} ${by - bend} ${tx} ${by}L${tx} ${ty}`;
      } else if (route === 'arc') {
        // A card is in the way: swing out past the outer edge (right for the right column) and come back in.
        const right = to.r > origin.width / 2;
        const side = (b: { l: number; r: number }) => (right ? b.r + gap : b.l - gap);
        const sx = side(a);
        const tx = side(to) + (right ? HEAD : -HEAD);
        const sy = (a.t + a.b) / 2;
        const ty = (to.t + to.b) / 2;
        // A curve swings out about three quarters of its handles' reach: keep it on screen in a narrow window.
        const page = (map.closest('#landing') as HTMLElement | null)?.clientWidth ?? window.innerWidth;
        const room = right ? page - (origin.left + tx) - 6 : origin.left + tx - 6;
        const out = (right ? 1 : -1) * Math.max(24, Math.min(64, room / 0.75));
        const bx = tx + (right ? LEAD_IN : -LEAD_IN);
        d = `M${sx} ${sy}C${sx + out} ${sy} ${bx + out} ${ty} ${bx} ${ty}L${tx} ${ty}`;
      } else {
        // Beside: from the facing side, at the middle of where the two overlap up and down.
        const right = to.l >= a.r;
        const y = (Math.max(a.t, to.t) + Math.min(a.b, to.b)) / 2;
        const sx = right ? a.r + gap : a.l - gap;
        const tx = right ? to.l - gap - HEAD : to.r + gap + HEAD;
        d = `M${sx} ${y}L${tx} ${y}`;
      }
      const kind = finished(from) ? 'done' : 'todo';
      const line = document.createElementNS(SVG, 'path');
      line.setAttribute('d', d);
      line.classList.add('path-link', kind);
      line.setAttribute('marker-end', `url(#path-arrow-${kind})`);
      svg.append(line);
      // Dotted trails: a whole number of dot spacings, so a dot sits at each end (one right at the arrowhead).
      if (kind === 'todo') {
        const dots = Math.max(1, Math.round(line.getTotalLength() / DOT_SPACING));
        line.setAttribute('pathLength', String(dots * DOT_SPACING));
        // A dot exactly at the end isn't drawn: nudge them all back a hair, so the last lands just inside.
        line.style.strokeDashoffset = '0.1';
      }
    });
  }
}
