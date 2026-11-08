import React, { useRef } from 'react';
import { LauncherArt } from './LauncherArt';
import './launcher.css';

export type LauncherModeId = 'kompas' | 'fusion' | 'blocks3d';

export interface LauncherPageProps {
  modes: readonly {
    id: LauncherModeId;
    title: string;
    description: string;
    available: boolean;
    status: string;
    external?: boolean;
  }[];
  recent: readonly {
    id: string;
    title: string;
    mode: 'kompas' | 'fusion';
    updatedAt?: string;
    legacy?: boolean;
  }[];
  onCreate(mode: LauncherModeId): void;
  onOpen(mode: LauncherModeId): void;
  onContinue(projectId: string, mode: 'kompas' | 'fusion'): void;
  onSettings(): void;
  onBackup?(): void;
  accountHref: string;
  error?: string;
}

type GlyphName = 'folder' | 'plus' | 'arrow' | 'external' | 'settings' | 'user' | 'backup';
const glyphPaths: Record<GlyphName, string> = {
  folder: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 4h18',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  external: 'M14 4h6v6M20 4 10 14M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  settings: 'M4 7h16M4 17h16M9 4v6M15 14v6',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  backup: 'M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4',
};

function Glyph({ name }: { name: GlyphName }) {
  return <svg className="asa-launcher-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={glyphPaths[name]} /></svg>;
}

function SavedDate({ value }: { value?: string }) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return <time dateTime={date.toISOString()}>{date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>;
}

/** Presentation only: all navigation, identity and project data belong to the host. */
export function LauncherPage(props: LauncherPageProps) {
  const projects = useRef<HTMLElement>(null);
  function showProjects() {
    projects.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    projects.current?.focus({ preventScroll: true });
  }

  return (
    <div className="asa-launcher" data-testid="three-mode-launcher">
      <header className="asa-launcher-header">
        <div className="asa-launcher-brand" aria-label="ASA CAD">
          <svg className="asa-launcher-logo" viewBox="0 0 44 44" fill="none" aria-hidden="true"><rect width="44" height="44" rx="12" fill="#0B3558" /><path d="m22 9 12 7v13l-12 7-12-7V16L22 9Z" stroke="white" strokeWidth="1.7" /><path d="m10 16 12 7 12-7M22 23v13" stroke="#53D2E8" strokeWidth="1.7" /></svg>
          <span>ASA <strong>CAD</strong></span>
        </div>
        <nav className="asa-launcher-nav" aria-label="Главная навигация">
          <button type="button" className="asa-launcher-projects-link" aria-label="Мои проекты" onClick={showProjects}><Glyph name="folder" /><span>Мои проекты</span></button>
          <button type="button" className="asa-launcher-settings" aria-label="Настройки интерфейса" title="Настройки интерфейса" aria-haspopup="dialog" onClick={props.onSettings}><Glyph name="settings" /></button>
          <a className="asa-launcher-account" href={props.accountHref} target="_blank" rel="noopener noreferrer" title="Войти в ASA Lab в новой вкладке"><Glyph name="user" /><span>Войти в ASA Lab</span><Glyph name="external" /></a>
        </nav>
      </header>

      <main className="asa-launcher-main">
        <section className="asa-launcher-intro" aria-labelledby="asa-launcher-title">
          <p className="asa-launcher-eyebrow">3D-моделирование</p>
          <h1 id="asa-launcher-title">Выберите редактор</h1>
          <p>От первых фигур до инженерных деталей. Начните новую модель или продолжите свой проект.</p>
        </section>

        {props.error && <div className="asa-launcher-error" role="alert">{props.error}</div>}

        <section className="asa-launcher-modes" aria-label="Три режима моделирования">
          {props.modes.map((mode) => (
            <article className={`asa-launcher-card asa-launcher-card-${mode.id}`} key={mode.id} aria-labelledby={`asa-mode-${mode.id}`}>
              <div className="asa-launcher-art">
                <LauncherArt mode={mode.id} />
              </div>
              <div className="asa-launcher-card-body">
                <h2 id={`asa-mode-${mode.id}`}>{mode.title}</h2>
                <p className="asa-launcher-description">{mode.description}</p>
                <p className={`asa-launcher-connection${mode.available ? '' : ' asa-launcher-unavailable'}`}>
                  <span className="asa-launcher-status-dot" aria-hidden="true" />{mode.status}
                </p>
                <div className="asa-launcher-card-actions">
                  <button type="button" className="asa-launcher-create" aria-label={`Создать проект — ${mode.title}`} disabled={!mode.available} onClick={() => props.onCreate(mode.id)}><Glyph name="plus" /><span>Создать проект</span></button>
                  <button type="button" className="asa-launcher-open" aria-label={`Открыть проект — ${mode.title}`} disabled={!mode.available} onClick={() => props.onOpen(mode.id)}><Glyph name="folder" /><span>Открыть проект</span></button>
                </div>
                <p className="asa-launcher-location">{mode.external ? <><Glyph name="external" />Откроется отдельный редактор ASA Lab</> : 'Сохранение в этом браузере'}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="asa-launcher-recent" ref={projects} tabIndex={-1} aria-labelledby="asa-recent-title">
          <div className="asa-launcher-section-heading">
            <div><h2 id="asa-recent-title">Недавние проекты</h2><p>Модели, сохранённые в этом браузере.</p></div>
            {props.onBackup && <button type="button" className="asa-launcher-backup" onClick={props.onBackup}><Glyph name="backup" /><span>Скачать резервную копию</span></button>}
          </div>
          {props.recent.length ? (
            <ul className="asa-launcher-project-list">
              {props.recent.map((project) => (
                <li key={`${project.mode}:${project.id}`}>
                  <button className="asa-launcher-project" type="button" aria-label={`Продолжить: ${project.title}`} onClick={() => props.onContinue(project.id, project.mode)}>
                    <span className="asa-launcher-project-icon"><Glyph name="folder" /></span>
                    <span className="asa-launcher-project-name"><strong title={project.title}>{project.title}</strong><span>{project.mode === 'kompas' ? 'Компас' : 'Fusion'}{project.legacy ? ' · Из прежней версии' : ''}</span></span>
                    <SavedDate value={project.updatedAt} />
                    <span className="asa-launcher-continue">Продолжить<Glyph name="arrow" /></span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="asa-launcher-empty"><span><Glyph name="folder" /></span><div><h3>Здесь появятся ваши проекты</h3><p>Создайте модель в Компасе или Fusion и сохраните её.</p></div></div>
          )}
        </section>
        <footer className="asa-launcher-footer"><span>ASA CAD</span><p>Проекты 3D-конструктора доступны в вашем аккаунте ASA Lab.</p></footer>
      </main>
    </div>
  );
}
