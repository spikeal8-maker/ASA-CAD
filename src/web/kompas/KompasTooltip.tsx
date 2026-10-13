import React from 'react';
import { createPortal } from 'react-dom';
import { KOMPAS_STATUS_TEXT, kompasShell, type KompasCommandStatus } from './kompasShellStore';

interface Tip { text: string; sub: string; left: number; top: number }

/**
 * Yellow KOMPAS tooltip for any element with `data-tip`. The second line is the
 * reason a command cannot run (`data-dis`) or, for registry commands that are
 * not implemented, their ASA-CAD status.
 */
export function KompasTooltip() {
  const [tip, setTip] = React.useState<Tip | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let timer = 0;
    let target: Element | null = null;
    let x = 0;
    let y = 0;
    const hide = () => { window.clearTimeout(timer); target = null; setTip(null); };
    const onMove = (event: PointerEvent) => { x = event.clientX; y = event.clientY; };
    const onOver = (event: PointerEvent) => {
      const next = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-tip]') : null;
      if (next === target) return;
      hide();
      if (!next || event.pointerType === 'touch') return;
      target = next;
      timer = window.setTimeout(() => {
        if (target !== next || !document.body.contains(next)) return;
        const status = next.dataset.st as KompasCommandStatus | undefined;
        const sub = next.dataset.dis
          ?? (status && (status !== 'implemented' || kompasShell.get().status) ? KOMPAS_STATUS_TEXT[status] : '');
        setTip({ text: next.dataset.tip ?? '', sub, left: x + 12, top: y + 20 });
      }, 550);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerdown', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      hide();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerdown', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !tip) return;
    const w = element.offsetWidth;
    const h = element.offsetHeight;
    element.style.left = `${Math.max(4, Math.min(window.innerWidth - w - 4, tip.left))}px`;
    element.style.top = `${tip.top + h > window.innerHeight - 4 ? tip.top - h - 28 : tip.top}px`;
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div ref={ref} className="k-ui k-tip" role="tooltip">
      {tip.text}
      {tip.sub && <small>{tip.sub}</small>}
    </div>,
    document.body,
  );
}
