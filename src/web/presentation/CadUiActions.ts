import commandRegistryJson from '../../../spec/ui/command-registry.v1.json';
import type { CadDocumentKind } from '../../contracts/document';

export type CadUiCommandStatus = 'implemented' | 'experimental' | 'planned' | 'deferred';

export interface CadUiCommandMeta {
  id: string;
  labelRu: string;
  kinds: Array<CadDocumentKind | 'all'>;
  workspace: string;
  group: string;
  control: string;
  milestone: string;
  status: CadUiCommandStatus;
  backendCommand?: string;
}

export interface CadUiAction {
  id: string;
  label: string;
  status: CadUiCommandStatus;
  milestone: string;
  workspace: string;
  group: string;
  control: string;
  enabled: boolean;
  active: boolean;
  reason?: string;
  invoke(): void | Promise<void>;
}

export interface CadUiActionBinding {
  enabled?: boolean;
  active?: boolean;
  reason?: string;
  invoke(): void | Promise<void>;
}

const registry = commandRegistryJson as { commands: CadUiCommandMeta[] };

export const cadUiCommandCatalog: readonly CadUiCommandMeta[] = registry.commands;
export const cadUiCommandById = new Map(cadUiCommandCatalog.map((entry) => [entry.id, entry]));

export function getCadUiCommandMeta(id: string): CadUiCommandMeta {
  const meta = cadUiCommandById.get(id);
  if (!meta) throw new Error(`Unknown ASA-CAD UI command: ${id}`);
  return meta;
}

export function cadUiCommandLabel(id: string, fallback = id): string {
  return cadUiCommandById.get(id)?.labelRu ?? fallback;
}

export function createCadUiAction(id: string, binding: CadUiActionBinding): CadUiAction {
  const meta = getCadUiCommandMeta(id);
  return {
    id: meta.id,
    label: meta.labelRu,
    status: meta.status,
    milestone: meta.milestone,
    workspace: meta.workspace,
    group: meta.group,
    control: meta.control,
    enabled: binding.enabled ?? true,
    active: binding.active ?? false,
    reason: binding.reason,
    invoke: binding.invoke,
  };
}

export function createCadUiActionMap(
  bindings: Record<string, CadUiActionBinding>,
): ReadonlyMap<string, CadUiAction> {
  return new Map(Object.entries(bindings).map(([id, binding]) => [id, createCadUiAction(id, binding)]));
}

export function searchableCadUiCommands(
  query: string,
  documentKind?: CadDocumentKind,
): CadUiCommandMeta[] {
  const normalized = query.trim().toLocaleLowerCase('ru');
  if (!normalized) return [];
  return cadUiCommandCatalog.filter((entry) => {
    if (entry.status === 'planned' || entry.status === 'deferred') return false;
    if (documentKind && !entry.kinds.includes('all') && !entry.kinds.includes(documentKind)) return false;
    return entry.labelRu.toLocaleLowerCase('ru').includes(normalized);
  });
}
