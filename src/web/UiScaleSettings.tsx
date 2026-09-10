import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CAD_UI_SCALE_OPTIONS,
  type CadUiScalePreference,
  type CadUiScaleResolved,
} from './UiScale';

interface UiScaleSettingsContextValue {
  openSettings(): void;
  closeSettings(): void;
  preference: CadUiScalePreference;
  resolved: CadUiScaleResolved;
}

const UiScaleSettingsContext = createContext<UiScaleSettingsContextValue | null>(null);

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

export function useUiScaleSettings(): UiScaleSettingsContextValue {
  const value = useContext(UiScaleSettingsContext);
  if (!value) throw new Error('useUiScaleSettings must be used inside UiScaleSettingsProvider');
  return value;
}

/**
 * Owns interface-settings state. Shell controls call a typed React action;
 * presentation no longer discovers or clicks another component's DOM.
 */
export function UiScaleSettingsProvider({ children }: React.PropsWithChildren) {
  const initial = readControllerState();
  const [open, setOpen] = useState(false);
  const [preference, setPreferenceState] = useState<CadUiScalePreference>(initial.preference);
  const [resolved, setResolved] = useState<CadUiScaleResolved>(initial.resolved);

  const sync = useCallback(() => {
    const next = readControllerState();
    setPreferenceState(next.preference);
    setResolved(next.resolved);
  }, []);

  const openSettings = useCallback(() => {
    sync();
    setOpen(true);
  }, [sync]);
  const closeSettings = useCallback(() => setOpen(false), []);

  useEffect(() => {
    window.addEventListener('asa-cad-ui-scale-change', sync as EventListener);
    window.addEventListener('resize', sync, { passive: true });
    return () => {
      window.removeEventListener('asa-cad-ui-scale-change', sync as EventListener);
      window.removeEventListener('resize', sync);
    };
  }, [sync]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      closeSettings();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [closeSettings, open]);

  const applyPreference = (next: CadUiScalePreference) => {
    const controller = window.__ASA_CAD_UI_SCALE__;
    if (!controller) return;
    controller.setPreference(next);
    setPreferenceState(controller.getPreference());
    setResolved(controller.getResolved());
  };

  const context = useMemo<UiScaleSettingsContextValue>(() => ({
    openSettings,
    closeSettings,
    preference,
    resolved,
  }), [closeSettings, openSettings, preference, resolved]);

  return (
    <UiScaleSettingsContext.Provider value={context}>
      {children}

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
            if (event.target === event.currentTarget) closeSettings();
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
              <button type="button" onClick={closeSettings} aria-label="Закрыть настройки">×</button>
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
    </UiScaleSettingsContext.Provider>
  );
}
