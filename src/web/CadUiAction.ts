export type CadUiActionStatus = 'planned' | 'implemented' | 'experimental' | 'deferred';

export type CadUiActionPresentation =
  | 'button'
  | 'split-button'
  | 'dropdown'
  | 'toggle';

export interface CadUiCommandDefinition {
  id: string;
  labelRu: string;
  milestone: string;
  status: CadUiActionStatus;
  control?: CadUiActionPresentation;
  workspace?: string;
  group?: string;
  backendCommand?: string;
}

export type CadUiActionExecutor = () => void | Promise<void>;

export interface CadUiActionBinding {
  execute?: CadUiActionExecutor;
  enabled?: boolean;
  disabledReason?: string;
  checked?: boolean;
}

/**
 * Runtime presentation object shared by desktop/mobile/search/shortcut surfaces.
 * It contains no DOM reference and no kernel/vendor object.
 */
export interface CadUiAction {
  id: string;
  label: string;
  milestone: string;
  status: CadUiActionStatus;
  presentation: CadUiActionPresentation;
  workspace?: string;
  group?: string;
  backendCommand?: string;
  enabled: boolean;
  disabledReason?: string;
  checked?: boolean;
  execute: CadUiActionExecutor;
}

export type CadUiActionBindings = Readonly<Record<string, CadUiActionBinding | undefined>>;

const NOOP: CadUiActionExecutor = () => undefined;

/**
 * Combines stable command-registry metadata with editor-state bindings.
 *
 * Registry metadata owns identity/label/presentation. The editor binding owns
 * current enablement and execution. A command is executable only when the
 * registry says the product path is implemented and an executor is supplied.
 */
export function createCadUiActions(
  definitions: readonly CadUiCommandDefinition[],
  bindings: CadUiActionBindings,
): CadUiAction[] {
  return definitions.map((definition) => {
    const binding = bindings[definition.id];
    const productImplemented = definition.status === 'implemented';
    const hasExecutor = typeof binding?.execute === 'function';
    const enabledByContext = binding?.enabled ?? true;
    const enabled = productImplemented && hasExecutor && enabledByContext;

    let disabledReason = binding?.disabledReason;
    if (!productImplemented) {
      disabledReason ??= definition.status === 'deferred'
        ? 'Команда отложена'
        : 'Команда пока не реализована';
    } else if (!hasExecutor) {
      disabledReason ??= 'Нет обработчика команды';
    }

    return {
      id: definition.id,
      label: definition.labelRu,
      milestone: definition.milestone,
      status: definition.status,
      presentation: definition.control ?? 'button',
      workspace: definition.workspace,
      group: definition.group,
      backendCommand: definition.backendCommand,
      enabled,
      disabledReason: enabled ? undefined : disabledReason,
      checked: binding?.checked,
      execute: binding?.execute ?? NOOP,
    };
  });
}

export function indexCadUiActions(actions: readonly CadUiAction[]): ReadonlyMap<string, CadUiAction> {
  const result = new Map<string, CadUiAction>();
  for (const action of actions) {
    if (result.has(action.id)) throw new Error(`Duplicate CadUiAction id: ${action.id}`);
    result.set(action.id, action);
  }
  return result;
}

export function searchCadUiActions(
  actions: readonly CadUiAction[],
  query: string,
  limit = 8,
): CadUiAction[] {
  const normalized = query.trim().toLocaleLowerCase('ru');
  if (!normalized) return [];
  return actions
    .filter((action) => action.label.toLocaleLowerCase('ru').includes(normalized))
    .slice(0, Math.max(0, limit));
}

export async function executeCadUiAction(action: CadUiAction): Promise<boolean> {
  if (!action.enabled) return false;
  await action.execute();
  return true;
}
