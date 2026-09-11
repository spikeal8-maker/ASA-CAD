import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/web/App.tsx';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`O5.1 codemod could not find ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  'DocumentTree import',
  "import { MobileToolsPanel } from './MobileToolsPanel';\n",
  "import { MobileToolsPanel } from './MobileToolsPanel';\nimport { DocumentTree } from './DocumentTree';\n",
);

replaceOnce(
  'local DocumentTree/TreeRow block',
  `function DocumentTree({
  document,
  selectedBodyId,
  onSelectBody,
  onEditDimension,
}: {
  document: CadDocument;
  selectedBodyId: CadBodyId | null;
  onSelectBody: (id: CadBodyId | null) => void;
  onEditDimension: (id: CadDimensionId) => void;
}) {
  return (
    <div className="tree-panel">
      <div className="panel-title-row">
        <strong>Дерево</strong>
        <button type="button" title="Параметры дерева">⋯</button>
      </div>
      <div className="tree-search"><span>⌕</span><input placeholder="Найти в дереве" /></div>
      <div className="tree-root">
        <TreeRow depth={0} icon={kindIcon(document.kind)} label={document.title} bold />
        {document.kind === 'part' && (
          <>
            <TreeRow depth={1} icon="⌖" label="Начало координат" />
            <TreeRow depth={2} icon="▱" label="Плоскость XY" muted />
            <TreeRow depth={2} icon="▱" label="Плоскость XZ" muted />
            <TreeRow depth={2} icon="▱" label="Плоскость YZ" muted />
            {document.sketches.map((item) => (
              <TreeRow key={item.id} depth={1} icon="⌗" label={item.name} />
            ))}
            {document.dimensions.map((dimension) => (
              <TreeRow
                key={dimension.id}
                depth={2}
                icon={dimension.type === 'diameter' ? 'Ø' : '↔'}
                label={\`${'${dimensionLabel(dimension.name, dimension.type)}'}: ${'${dimension.value}'} мм\`}
                onClick={() => onEditDimension(dimension.id)}
              />
            ))}
            {document.features.map((feature) => (
              <TreeRow key={feature.id} depth={1} icon="◇" label={feature.name} />
            ))}
            {document.bodies.map((body) => (
              <TreeRow
                key={body.id}
                depth={1}
                icon="⬡"
                label={body.name}
                selected={body.id === selectedBodyId}
                bodyId={body.id}
                onClick={() => onSelectBody(body.id)}
              />
            ))}
          </>
        )}
        {document.kind === 'assembly' && <TreeRow depth={1} icon="＋" label="Компоненты появятся в M4A" muted />}
        {document.kind === 'drawing' && <TreeRow depth={1} icon="▱" label="Листы появятся в M6" muted />}
        {document.kind === 'fragment' && <TreeRow depth={1} icon="⌗" label="Геометрия появится в M6" muted />}
        {document.kind === 'specification' && <TreeRow depth={1} icon="≣" label="Разделы появятся в M6A" muted />}
        {document.kind === 'text' && <TreeRow depth={1} icon="¶" label="Структура появится в M6A" muted />}
      </div>
    </div>
  );
}

function TreeRow(props: {
  depth: number;
  icon: string;
  label: string;
  muted?: boolean;
  bold?: boolean;
  selected?: boolean;
  bodyId?: CadBodyId;
  onClick?: () => void;
}) {
  return (
    <button
      className={\`tree-row ${'${props.muted ? \'muted\' : \'\'}'} ${'${props.bold ? \'bold\' : \'\'}'} ${'${props.onClick ? \'interactive\' : \'\'}'} ${'${props.selected ? \'selected\' : \'\'}'}\`}
      type="button"
      style={{ paddingInlineStart: 10 + props.depth * 18 }}
      onClick={props.onClick}
      data-body-id={props.bodyId}
      aria-pressed={props.bodyId ? Boolean(props.selected) : undefined}
    >
      <span className="tree-chevron">{props.depth < 2 ? '›' : ''}</span>
      <span className="tree-icon">{props.icon}</span>
      <span className="tree-label">{props.label}</span>
    </button>
  );
}

`,
  '',
);

writeFileSync(path, source);
console.log('Applied O5.1 DocumentTree extraction');
