import React from 'react';
import type { CadUiAction } from './CadUiAction';

export interface CadUiActionButtonProps {
  action: CadUiAction;
  symbol: string;
  large?: boolean;
  accent?: boolean;
  text?: boolean;
  selected?: boolean;
  className?: string;
  titleSuffix?: string;
}

/**
 * Presentation-only command button. It receives a fully bound CadUiAction and
 * never knows how the command is implemented, persisted or computed.
 */
export function CadUiActionButton(props: CadUiActionButtonProps) {
  const { action } = props;
  const title = action.enabled
    ? `${action.label}${props.titleSuffix ? ` ${props.titleSuffix}` : ''}`
    : `${action.label}: ${action.disabledReason ?? 'Недоступно'}`;

  return (
    <button
      className={`ribbon-command ${props.className ?? ''} ${props.text ? 'text-command' : ''} ${props.large ? 'large' : ''} ${props.accent ? 'accent' : ''} ${props.selected ? 'selected' : ''}`}
      type="button"
      disabled={!action.enabled}
      title={title}
      onClick={() => { void action.execute(); }}
      data-command-id={action.id}
      aria-pressed={props.selected ? true : undefined}
    >
      <span className="ribbon-command-icon" aria-hidden="true">{props.symbol}</span>
      <span>{action.label}</span>
      {!action.enabled && action.status !== 'implemented' && <span className="planned-badge">позже</span>}
    </button>
  );
}

export function CadUiGlobalActionButton(props: {
  action: CadUiAction;
  children: React.ReactNode;
  titleSuffix?: string;
}) {
  const title = props.action.enabled
    ? `${props.action.label}${props.titleSuffix ? ` ${props.titleSuffix}` : ''}`
    : `${props.action.label}: ${props.action.disabledReason ?? 'Недоступно'}`;
  return (
    <button
      type="button"
      title={title}
      disabled={!props.action.enabled}
      onClick={() => { void props.action.execute(); }}
      data-command-id={props.action.id}
    >
      {props.children}
    </button>
  );
}

export function CadUiActionSearchResults(props: {
  actions: readonly CadUiAction[];
  onPicked?: (action: CadUiAction) => void;
}) {
  if (props.actions.length === 0) return null;
  return (
    <div className="command-search-results">
      {props.actions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={!action.enabled}
          title={!action.enabled ? action.disabledReason : action.label}
          data-command-id={action.id}
          onClick={() => {
            if (!action.enabled) return;
            props.onPicked?.(action);
            void action.execute();
          }}
        >
          <span>{action.label}</span>
          <small>{action.milestone}</small>
        </button>
      ))}
    </div>
  );
}
