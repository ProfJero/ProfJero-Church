import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import { App } from './App';
import { registerServiceWorker } from './register-sw';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();

console.log(
  '%c CWC %c Crafted by ProfJero — Building Solutions. Empowering Lives. ',
  'background:#1e3a8a;color:#fff;font-weight:700;padding:3px 6px;border-radius:4px 0 0 4px',
  'background:#eef3ff;color:#1e3a8a;padding:3px 6px;border-radius:0 4px 4px 0',
);
