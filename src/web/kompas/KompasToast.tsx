import React from 'react';
import { kompasShell, useKompasShell } from './kompasShellStore';

const QUIET = new Set(['Готово', '']);

/**
 * KOMPAS-style message at the bottom of the graphics area. It shows shell
 * explanations and every new product notice (the old status line text).
 */
export function KompasToast(props: { notice: string }) {
  const shell = useKompasShell();
  const [visible, setVisible] = React.useState(false);
  const [text, setText] = React.useState('');

  React.useEffect(() => {
    if (QUIET.has(props.notice)) return;
    kompasShell.toast(props.notice);
  }, [props.notice]);

  React.useEffect(() => {
    if (!shell.toast) return;
    setText(shell.toast.text);
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 3400);
    return () => window.clearTimeout(timer);
  }, [shell.toast]);

  return (
    <div className={`k-ui k-toast k-toast-fixed${visible ? ' k-show' : ''}`} role="status" aria-live="polite" data-notice={props.notice}>
      {text}
    </div>
  );
}
