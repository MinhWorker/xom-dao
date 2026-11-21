import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { ToastRegion } from './kit/index.js';
import { sounds } from './sound/index.js';
import './styles/fonts.js';
import './styles/tokens.css';
import './styles/base.css';

sounds.listen(document);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
      <ToastRegion />
    </StrictMode>,
  );
}
