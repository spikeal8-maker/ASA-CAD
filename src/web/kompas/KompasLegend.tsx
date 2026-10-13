import { KOMPAS_TOOLSETS } from './kompasToolsets';
import { kompasShell, useKompasShell, type KompasCommandStatus } from './kompasShellStore';

/** «Статус в ASA-CAD»: how many commands of the current toolset the product already has. */
export function KompasLegend() {
  const shell = useKompasShell();
  if (!shell.status) return null;
  const toolset = KOMPAS_TOOLSETS[shell.toolset];
  const count: Record<KompasCommandStatus, number> = { implemented: 0, planned: 0, deferred: 0, none: 0 };
  for (const panel of toolset.panels) {
    for (const column of panel.cols) {
      for (const command of column) count[kompasShell.commands.status(command.id)] += 1;
    }
  }
  return (
    <div className="k-legend">
      <h3>Статус команд набора «{toolset.label}»</h3>
      <div className="k-lrow"><span className="k-sw" style={{ background: 'var(--k-st-impl)' }} />Реализовано в ASA-CAD<b>{count.implemented}</b></div>
      <div className="k-lrow"><span className="k-sw" style={{ background: 'var(--k-st-plan)' }} />Запланировано<b>{count.planned}</b></div>
      <div className="k-lrow"><span className="k-sw" style={{ background: 'var(--k-st-def)' }} />Отложено<b>{count.deferred}</b></div>
      <div className="k-lrow"><span className="k-sw k-none" />Нет в реестре<b>{count.none}</b></div>
      <p>Статусы — реестр spec/ui/command-registry.v1.json. Сетка — layout.json v25 (PR #146), наполнение панелей — КОМПАС-3D v23.</p>
    </div>
  );
}
