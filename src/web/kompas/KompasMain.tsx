import React from 'react';
import type { CadPlaneName } from '../../contracts/commands';
import type { CadShellMainProps } from '../CadShellMain';
import { CoincidentPartStage } from '../CoincidentPartModelStage';
import { DocumentTree, type DocumentTreeProps } from '../DocumentTree';
import { KompasDialogs } from './KompasDialogs';
import { KIcon } from './KompasIcon';
import { KompasLegend } from './KompasLegend';
import { KompasQuickAccess } from './KompasQuickAccess';
import { KompasTree } from './KompasTree';
import { kompasMenus } from './kompasMenus';
import type { KompasPanelTab, KompasViewName } from './kompasMenuTypes';
import { kompasShell, useKompasShell } from './kompasShellStore';

const VIEW_LABELS: Record<KompasViewName, string> = {
  front: 'Спереди', back: 'Сзади', top: 'Сверху', bottom: 'Снизу', left: 'Слева', right: 'Справа', iso: 'Изометрия', dim: 'Диметрия',
};
/** «Нормально к...»: the view that looks along the plane normal. */
const NORMAL_VIEW: Record<CadPlaneName, KompasViewName> = { XY: 'top', XZ: 'front', YZ: 'right' };
const RAIL: ReadonlyArray<readonly [KompasPanelTab, string, string]> = [
  ['tree', 'Дерево', 'tree'], ['params', 'Параметры', 'params'], ['vars', 'Переменные', 'fx'], ['libs', 'Библиотеки', 'libs'],
];

/** Props of a slot element, when the slot is the expected product component. */
function slotProps<P>(node: React.ReactNode, type: React.ComponentType<P>): P | null {
  return React.isValidElement<P>(node) && node.type === type ? node.props : null;
}

/**
 * Body of the KOMPAS shell: management rail, panel (tree / parameters / variables /
 * libraries), splitter and the graphics area with the quick-access toolbar.
 * The scene, tree data and parameters stay the product's own components and state.
 */
export function KompasMain(props: CadShellMainProps) {
  const shell = useKompasShell();
  const tree = slotProps<DocumentTreeProps>(props.treeContent, DocumentTree);
  const stage = slotProps<React.ComponentProps<typeof CoincidentPartStage>>(props.modelContent, CoincidentPartStage);
  const sketchMode = stage?.activeWorkspace === 'sketch' && Boolean(stage.activeSketch);
  const support = stage?.activeSketch?.support;
  const sketchPlane: CadPlaneName | null = support === 'XY' || support === 'XZ' || support === 'YZ' ? support as CadPlaneName : null;
  const [extraTab, setExtraTab] = React.useState<'vars' | 'libs' | null>(null);
  const open = props.activePanel !== 'closed';
  const tab: KompasPanelTab = extraTab ?? (props.activePanel === 'parameters' ? 'params' : 'tree');

  React.useEffect(() => { setExtraTab(null); }, [props.activePanel]);
  /* КОМПАС держит панель параметров открытой, пока работает команда: значения вводятся в ней. */
  React.useEffect(() => {
    if (props.activeCommand && props.activePanel === 'closed') props.setActivePanel('parameters');
  }, [props.activeCommand, props.activePanel]);
  React.useEffect(() => {
    kompasShell.set({ panelOpen: open, activeCommand: props.activeCommand ?? null, sketchMode });
  }, [open, props.activeCommand, sketchMode]);

  const showTab = React.useCallback((next: KompasPanelTab) => {
    if (next === 'vars' || next === 'libs') {
      if (!open) props.setActivePanel('tree');
      setExtraTab(next);
    } else {
      setExtraTab(null);
      props.setActivePanel(next === 'params' ? 'parameters' : 'tree');
    }
  }, [open, props.setActivePanel]);

  React.useEffect(() => {
    const request = shell.panelRequest;
    if (!request) return;
    if (request.tab === 'toggle') props.setActivePanel(open ? 'closed' : 'tree');
    else showTab(request.tab);
  }, [shell.panelRequest?.seq]);

  const view = (name: KompasViewName) => {
    if (name === 'dim') { kompasShell.toast('Диметрии в ASA-CAD пока нет'); return; }
    props.requestView(VIEW_LABELS[name]);
  };
  const normal = () => {
    const plane = sketchMode ? sketchPlane : tree?.selectedPlane ?? null;
    if (plane) view(NORMAL_VIEW[plane]);
    else kompasShell.toast('Выберите плоскость или эскиз — вид встанет нормально к нему');
  };
  kompasShell.hooks.normal = normal;

  const lists = kompasMenus({
    canUndo: false, canRedo: false, panelsOpen: open,
    fit: () => props.requestView('Показать всё'),
    zoom: () => kompasShell.toast('Масштабируйте колесом мыши'),
    view, normal,
    refreshView: () => undefined,
    togglePanels: () => props.setActivePanel(open ? 'closed' : 'tree'),
    showTab,
    openSettings: () => kompasShell.set({ dialog: 'settings' }),
    openAbout: () => kompasShell.set({ dialog: 'about' }),
    openDocInfo: () => kompasShell.set({ dialog: 'docinfo' }),
  });

  return (
    <main className={`k-ui k-content${open ? '' : ' k-collapsed'}`} data-panel-tab={open ? tab : ''}>
      <nav className="k-management-rail" role="tablist" aria-label="Панели управления">
        {RAIL.map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            className="k-rail-tab"
            role="tab"
            aria-selected={open && tab === key}
            data-tip={label}
            aria-label={label}
            onClick={() => (open && tab === key ? props.setActivePanel('closed') : showTab(key))}
          ><KIcon name={icon} size={16} /></button>
        ))}
      </nav>
      <aside className="k-management-panel">
        {tab === 'tree' && (tree ? <KompasTree {...tree} /> : props.treeContent)}
        {tab === 'params' && (
          <div className="k-params-panel">
            <div className="k-panel-head"><span>Параметры</span><span /></div>
            <div className="k-params-body">{props.parametersContent}</div>
          </div>
        )}
        {tab === 'vars' && (
          <>
            <div className="k-panel-head"><span>Переменные</span><span /></div>
            <table className="k-var-table"><thead><tr><th>Имя</th><th>Выражение</th><th>Значение</th></tr></thead><tbody><tr><td colSpan={3}>{tree?.document.title ?? ''}</td></tr></tbody></table>
            <div className="k-muted-note">Переменных нет.</div>
          </>
        )}
        {tab === 'libs' && (
          <>
            <div className="k-panel-head"><span>Библиотеки</span><span /></div>
            <div className="k-muted-note">Менеджера библиотек в ASA-CAD пока нет.</div>
          </>
        )}
      </aside>
      <div className="k-splitter" />
      <section className="k-work-area" aria-label="Графическая область">
        <div className="k-model-stage">{props.modelContent}</div>
        <KompasQuickAccess
          sketch={sketchMode}
          lists={lists}
          view={view}
          fit={() => props.requestView('Показать всё')}
          normal={normal}
          commandActive={Boolean(props.activeCommand)}
          commit={() => { void props.commitActiveCommand(); }}
          cancel={props.cancelCommand}
        />
        {sketchMode && (
          <button type="button" className="k-sketch-exit" title="Выйти из эскиза" aria-label="Выйти из эскиза" data-command-id="sketch.finish"
            onClick={() => kompasShell.run('sketch.finish', 'Выйти из эскиза')}><KIcon name="ts_sketch" size={34} /></button>
        )}
        <KompasLegend />
      </section>
      {tree && <KompasDialogs document={tree.document} />}
    </main>
  );
}
