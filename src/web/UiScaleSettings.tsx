import React, { useEffect, useState } from 'react';
import {
  CAD_UI_SCALE_OPTIONS,
  type CadUiScalePreference,
  type CadUiScaleResolved,
} from './UiScale';

function readControllerState(): { preference: CadUiScalePreference; resolved: CadUiScaleResolved } {
  const controller = window.__ASA_CAD_UI_SCALE__;
  return {
    preference: controller?.getPreference() ?? 'auto',
    resolved: controller?.getResolved() ?? 100,
  };
}

function optionLabel(value: CadUiScalePreference): string {
  return value === 'auto' ? 'Авто' : `${value}%`;
}

export function UiScaleSettings() {
  const initial = readControllerState();
  const [open, setOpen] = useState(false);
  const [preference, setPreferenceState] = useState<CadUiScalePreference>(initial.preference);
  const [resolved, setResolved] = useState<CadUiScaleResolved>(initial.resolved);

  const openSettings = () => {
    const next = readControllerState();
    setPreferenceState(next.preference);
    setResolved(next.resolved);
    setOpen(true);
  };

  useEffect(() => {
    const settingsButton = document.querySelector<HTMLButtonElement>('.global-actions button[title="Настройки"]');
    if (!settingsButton) return;
    const onOpen = (event: Event) => {
      event.preventDefault();
      openSettings();
    };
    settingsButton.addEventListener('click', onOpen);
    settingsButton.setAttribute('aria-haspopup', 'dialog');
    settingsButton.setAttribute('aria-controls', 'asa-cad-interface-settings');
    return () => settingsButton.removeEventListener('click', onOpen);
  }, []);

  useEffect(() => {
    const sync = () => {
      const next = readControllerState();
      setPreferenceState(next.preference);
      setResolved(next.resolved);
    };
    window.addEventListener('asa-cad-ui-scale-change', sync as EventListener);
    window.addEventListener('resize', sync, { passive: true });
    return () => {
      window.removeEventListener('asa-cad-ui-scale-change', sync as EventListener);
      window.removeEventListener('resize', sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  const applyPreference = (next: CadUiScalePreference) => {
    const controller = window.__ASA_CAD_UI_SCALE__;
    if (!controller) return;
    controller.setPreference(next);
    setPreferenceState(controller.getPreference());
    setResolved(controller.getResolved());
  };

  return (
    <>
      <div className="ui-scale-status" data-testid="ui-scale-status" aria-label={`Масштаб интерфейса ${resolved}%`}>
        UI {resolved}%
      </div>

      <button
        type="button"
        className="mobile-ui-settings-launcher"
        aria-label="Настройки интерфейса"
        aria-haspopup="dialog"
        aria-controls="asa-cad-interface-settings"
        onClick={openSettings}
      >
        ⚙
      </button>

      {open && (
        <div
          className="interface-settings-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            id="asa-cad-interface-settings"
            className="interface-settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asa-cad-interface-settings-title"
          >
            <header>
              <div>
                <h2 id="asa-cad-interface-settings-title">Настройки интерфейса</h2>
                <p>Масштабирует панели, текст и команды. Геометрия CAD и координаты модели не меняются.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть настройки">×</button>
            </header>

            <div className="interface-settings-body">
              <div className="settings-row-heading">
                <div>
                  <strong>Масштаб интерфейса</strong>
                  <span>Текущий эффективный масштаб: {resolved}%</span>
                </div>
              </div>

              <div className="ui-scale-options" role="radiogroup" aria-label="Масштаб интерфейса">
                {CAD_UI_SCALE_OPTIONS.map((value) => {
                  const selected = preference === value;
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={selected ? 'selected' : ''}
                      onClick={() => applyPreference(value)}
                    >
                      <span className="ui-scale-radio" aria-hidden="true">{selected ? '●' : '○'}</span>
                      <span>
                        <strong>{optionLabel(value)}</strong>
                        {value === 'auto' && <small>По эффективному размеру экрана, высоте и DPI</small>}
                        {value === 90 && <small>Компактно; не уменьшает touch-цели на телефоне</small>}
                        {value === 100 && <small>Базовый размер для Full HD</small>}
                        {value === 110 && <small>Увеличенный интерфейс для 2K</small>}
                        {value === 125 && <small>Крупный интерфейс для большого 4K пространства</small>}
                        {value === 150 && <small>Максимальное ручное увеличение</small>}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="ui-scale-note">
                Системный масштаб Windows/macOS и browser zoom уже изменяют эффективный CSS viewport. ASA-CAD не умножает их повторно.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
