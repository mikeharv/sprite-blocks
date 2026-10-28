// Small DOM helpers and a generic modal dialog.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  children: (Node | string | null | false | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) if (c) node.append(c);
  return node;
}

export interface ModalButton {
  label: string;
  primary?: boolean;
  onClick?: () => boolean | void;
}

export function openModal(
  title: string,
  content: Node,
  buttons: ModalButton[] = [{ label: 'Close' }],
  opts: { wide?: boolean } = {},
): () => void {
  const root = document.getElementById('modal-root')!;
  const backdrop = el('div', { className: 'modal-backdrop' });
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const footer = el(
    'footer',
    { className: 'modal-footer' },
    buttons.map((b) =>
      el('button', {
        className: b.primary ? 'btn primary' : 'btn',
        textContent: b.label,
        onclick: () => {
          if (b.onClick?.() !== false) close();
        },
      }),
    ),
  );
  const card = el('div', { className: 'modal-card' + (opts.wide ? ' wide' : '') }, [
    el('header', { className: 'modal-header' }, [el('h2', { textContent: title })]),
    el('div', { className: 'modal-body' }, [content]),
    footer,
  ]);
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', title);
  backdrop.append(card);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);
  root.append(backdrop);
  (footer.querySelector('.primary') as HTMLElement | null)?.focus();
  return close;
}

export function toast(message: string): void {
  const t = el('div', { className: 'toast', textContent: message });
  document.body.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2200);
}
