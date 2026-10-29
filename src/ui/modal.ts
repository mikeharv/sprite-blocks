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
  /** Styles a primary button for an action that removes or discards something. */
  danger?: boolean;
  onClick?: () => boolean | void;
}

export function openModal(
  title: string,
  content: Node,
  buttons: ModalButton[] = [{ label: 'Close' }],
  opts: { wide?: boolean; onClose?: () => void } = {},
): () => void {
  const root = document.getElementById('modal-root')!;
  const backdrop = el('div', { className: 'modal-backdrop' });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    opts.onClose?.();
  };
  // Only the topmost dialog answers Escape, so a confirmation over another dialog closes alone.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && root.lastElementChild === backdrop) {
      e.stopPropagation();
      close();
    }
  };
  const footer = el(
    'footer',
    { className: 'modal-footer' },
    buttons.map((b) =>
      el('button', {
        className: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger-fill' : ''),
        type: 'button',
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
  // Focus the main action, except a destructive one: then Cancel has focus, so Enter is safe.
  const focus = footer.querySelector<HTMLElement>('.primary:not(.danger-fill)') ?? footer.querySelector<HTMLElement>('.btn');
  focus?.focus();
  return close;
}

/** Asks a yes/no question in a dialog. Resolves false if it is cancelled or dismissed. */
export function confirmDialog(opts: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false;
    openModal(
      opts.title,
      el('p', { className: 'dialog-message', textContent: opts.message }),
      [
        { label: opts.cancelLabel ?? 'Cancel' },
        { label: opts.confirmLabel, primary: true, danger: opts.danger, onClick: () => void (answer = true) },
      ],
      { onClose: () => resolve(answer) },
    );
  });
}

/** Asks for a line of text in a dialog. Resolves the trimmed text, or null if cancelled or left empty. */
export function promptDialog(opts: { title: string; label: string; value?: string; confirmLabel: string }): Promise<string | null> {
  return new Promise((resolve) => {
    let answer: string | null = null;
    const input = el('input', { className: 'dialog-input', type: 'text', value: opts.value ?? '' });
    const close = openModal(
      opts.title,
      el('label', { className: 'dialog-field' }, [opts.label, input]),
      [
        { label: 'Cancel' },
        { label: opts.confirmLabel, primary: true, onClick: () => void (answer = input.value.trim() || null) },
      ],
      { onClose: () => resolve(answer) },
    );
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      answer = input.value.trim() || null;
      close();
    });
    input.focus();
    input.select();
  });
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
