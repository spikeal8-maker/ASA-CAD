import { useMemo } from 'react';
import commandRegistryJson from '../../spec/ui/command-registry.v1.json';
import {
  createCadUiActions,
  indexCadUiActions,
  searchCadUiActions,
  type CadUiAction,
  type CadUiCommandDefinition,
} from './CadUiAction';
import {
  createM2CadUiActionBindings,
  type M2CadUiActionHandlers,
  type M2CadUiActionState,
} from './M2CadUiActions';

const definitions = commandRegistryJson.commands as CadUiCommandDefinition[];

export interface M2CadUiActionCatalog {
  actions: readonly CadUiAction[];
  byId: ReadonlyMap<string, CadUiAction>;
  search(query: string, limit?: number): CadUiAction[];
}

/**
 * React adapter for the permanent command presentation path. Metadata stays in
 * command-registry, editor state/handlers stay in bindings, and presentation
 * surfaces consume the resulting action objects.
 */
export function useM2CadUiActions(
  handlers: M2CadUiActionHandlers,
  state: M2CadUiActionState,
): M2CadUiActionCatalog {
  const actions = useMemo(
    () => createCadUiActions(definitions, createM2CadUiActionBindings(handlers, state)),
    [handlers, state],
  );
  const byId = useMemo(() => indexCadUiActions(actions), [actions]);

  return useMemo(() => ({
    actions,
    byId,
    search: (query: string, limit = 8) => searchCadUiActions(actions, query, limit),
  }), [actions, byId]);
}
