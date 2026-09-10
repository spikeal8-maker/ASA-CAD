import React from 'react';
import layoutRegistryJson from '../../../spec/ui/layout-registry.v2.json';
import type { CadUiAction } from './CadUiActions';

interface LayoutGroup {
  id: string;
  label: string;
  order: number;
  collapsePriority: number;
  mobile: string;
  commands: string[];
}

interface LayoutRegistry {
  workspaces: {
    part: { groups: Record<string, LayoutGroup[]> };
    sketch: { groups: LayoutGroup[] };
  };
}

const layoutRegistry = layoutRegistryJson as LayoutRegistry;

export type RibbonWorkspace = 'solid' | 'sketch' | 'diagnostics' | 'view';

export interface WorkspaceRibbonProps {
  workspace: RibbonWorkspace;
  actions: ReadonlyMap<string, CadUiAction>;
  dimensionSummary?: string | null;
}

function groupsFor(workspace: RibbonWorkspace): LayoutGroup[] {
  if (workspace === 'sketch') return [...layoutRegistry.workspaces.sketch.groups].sort((a, b) => a.order - b.order);
  return [...(layoutRegistry.workspaces.part.groups[workspace] ?? [])].sort((a, b) => a.order - b.order);
}

export function WorkspaceRibbon({ workspace, actions, dimensionSummary }: WorkspaceRibbonProps) {
  const groups = groupsFor(workspace);
  const visibleGroups = groups.flatMap((group) => {
    const groupActions = group.commands.flatMap((id) => {
      const action = actions.get(id);
      return action ? [action] : [];
    });
    const showDimensionSummary = workspace === 'sketch' && group.id === 'dimensions' && Boolean(dimensionSummary);
    return groupActions.length || showDimensionSummary ? [{ group, groupActions, showDimensionSummary }] : [];
  });

  return (
    <>
      {visibleGroups.map(({ group, groupActions, showDimensionSummary }) => (
        <section
          className={`command-group ${groupActions.length <= 1 ? 'compact' : ''}`}
          key={group.id}
          data-layout-group={group.id}
          data-collapse-priority={group.collapsePriority}
          data-mobile-placement={group.mobile}
        >
          <div className="command-group-content">
            {groupActions.map((action, index) => (
              <ActionButton
                key={action.id}
                action={action}
                large={action.id === 'part.sketch.create' || (workspace === 'sketch' && index === 0)}
              />
            ))}
            {showDimensionSummary && (
              <button className="ribbon-command text-command" type="button" disabled>
                <span className="ribbon-command-icon">↔</span>
                <span>{dimensionSummary}</span>
              </button>
            )}
          </div>
          <div className="command-group-label">{group.label}</div>
        </section>
      ))}
    </>
  );
}

function ActionButton({ action, large }: { action: CadUiAction; large?: boolean }) {
  return (
    <button
      className={`ribbon-command ${large ? 'large' : ''} ${action.active ? 'accent selected' : ''}`}
      type="button"
      disabled={!action.enabled}
      title={!action.enabled && action.reason ? `${action.label}: ${action.reason}` : action.label}
      onClick={() => void action.invoke()}
      data-command-id={action.id}
      data-command-status={action.status}
    >
      <span className="ribbon-command-icon" aria-hidden="true">{commandSymbol(action.id)}</span>
      <span>{action.label}</span>
    </button>
  );
}

function commandSymbol(id: string): string {
  if (id === 'system.rebuild') return '↻';
  if (id.includes('sketch')) return '▱';
  if (id.includes('circle')) return '○';
  if (id.includes('cut')) return '▣';
  if (id.includes('extrude')) return '▤';
  if (id.includes('fillet')) return '◜';
  if (id.startsWith('view.')) return '◇';
  return '◇';
}
