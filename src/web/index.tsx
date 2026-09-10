import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('ASA-CAD root element not found');

// ASA-CAD owns an imperative WebGL/WASM runtime with explicit lifecycle and
// browser regression coverage. Do not wrap the entire runtime root in
// React.StrictMode: its development-only mount/effect replay duplicates
// OpenCascade/fixture initialization and is not representative of production.
createRoot(root).render(<App />);
