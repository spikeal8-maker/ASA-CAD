import type { CadUiAction } from './CadUiAction';
import { CadShellMenu } from './CadShellMenu';

const FILE_ACTION_IDS = ['system.new', 'system.open', 'system.save'] as const;

export function CadFileMenu(props: { getAction(id: string): CadUiAction }) {
  return <CadShellMenu menuKey="file" label="Файл" actionIds={FILE_ACTION_IDS} getAction={props.getAction} />;
}
