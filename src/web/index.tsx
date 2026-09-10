import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installUiScaleController } from './UiScale';
import { UiScaleSettings } from './UiScaleSettings';
import './styles.css';
import './responsive.css';
import './ui-scale.css';
import './mobile-settings.css';

const root = document.getElementById('root');
if (!root) throw new Error('ASA-CAD root element not found');

// Install scale before first render so the initial shell never flashes at the
// wrong size. The controller changes CSS tokens only; it does not touch model
// units, Three camera coordinates or the OpenCascade runtime.
window.__ASA_CAD_UI_SCALE__ = installUiScaleController();

// ASA-CAD owns an imperative WebGL/WASM runtime with explicit lifecycle and
// browser regression coverage. Do not wrap the entire runtime root in
// React.StrictMode: its development-only mount/effect replay duplicates
// OpenCascade/fixture initialization and is not representative of production.
createRoot(root).render(
  <>
    <App />
    <UiScaleSettings />
  </>,
);
