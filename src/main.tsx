import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Global error handlers to prevent silent script termination
window.addEventListener('error', (event) => {
  console.warn('[NotaScribe Client Error]:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.warn('[NotaScribe Unhandled Rejection]:', event.reason);
});

// Register Service Worker for PWA installability and offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('NotaScribe Service Worker registrado con éxito:', reg.scope);
      })
      .catch((err) => {
        console.warn('Error al registrar Service Worker:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
