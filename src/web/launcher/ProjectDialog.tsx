import { useState } from 'react';
import type { CadEditorMode } from '../../browser/editorModes';
import type { LocalCadProject } from '../../host/LocalCadProjects';

export function ProjectDialog(props: {
  kind: 'new' | 'open'; mode: CadEditorMode; projects: LocalCadProject[];
  onCreate(title: string): void; onOpen(id: string): void; onClose(): void;
}) {
  const [title, setTitle] = useState('Новая деталь');
  const modeName = props.mode === 'kompas' ? 'Компас' : 'Fusion';
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) props.onClose();
  }}>
    <section className="new-document-dialog launcher-project-dialog" role="dialog" aria-modal="true"
      aria-labelledby="project-dialog-title" onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); props.onClose(); }
      }}>
      <header><h2 id="project-dialog-title">{props.kind === 'new' ? 'Создать проект' : 'Открыть проект'} · {modeName}</h2>
        <button type="button" aria-label="Закрыть" onClick={props.onClose}>×</button></header>
      {props.kind === 'new' ? <form onSubmit={event => { event.preventDefault(); props.onCreate(title); }}>
        <label>Название проекта<input autoFocus aria-label="Название проекта" value={title} maxLength={120}
          required onChange={event => setTitle(event.target.value)} /></label>
        <p>Проект сохранится в этом браузере. Компас и Fusion открывают один формат документа.</p>
        <footer><button type="button" onClick={props.onClose}>Отмена</button>
          <button className="primary" type="submit" disabled={!title.trim()}>Создать и открыть</button></footer>
      </form> : <div className="launcher-project-picker">
        <p>Каждую из этих моделей можно продолжить в выбранном редакторе.</p>
        {props.projects.length ? props.projects.map(project => <button type="button" key={project.id}
          onClick={() => props.onOpen(project.id)}><strong>{project.title}</strong>
          <span>{project.legacy ? 'Из прежней версии' : project.mode === 'kompas' ? 'Компас' : 'Fusion'}</span></button>)
          : <p>Сохранённых проектов пока нет. Создайте первую модель на главной странице.</p>}
      </div>}
    </section>
  </div>;
}
