import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { seedDatabase } from './seed.ts';
import { BrowserRouter } from 'react-router-dom';

// Remove pre-React loading indicator once JS modules have loaded
const preLoader = document.getElementById('pre-react-loader');
if (preLoader) {
  preLoader.style.opacity = '0';
  setTimeout(() => preLoader.remove(), 300);
}

// Seed database with sample data for development only
if (import.meta.env.DEV) {
  seedDatabase().catch(() => {
    // Error already logged by seedDatabase function
  });
}

// Mount React with error recovery
const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>,
    );
  } catch (err) {
    console.error('Fatal: React failed to mount', err);
    rootElement.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter,system-ui,sans-serif;background:#FCF9F0">' +
      '<div style="text-align:center;max-width:400px;padding:20px">' +
      '<p style="font-size:16px;font-weight:600;margin-bottom:8px">Something went wrong</p>' +
      '<p style="color:#666;font-size:14px;margin-bottom:16px">The application failed to start. Please try refreshing.</p>' +
      '<button onclick="location.reload()" style="padding:8px 24px;background:#0E101A;color:#FCF9F0;border:none;border-radius:6px;cursor:pointer;font-size:14px">Reload Page</button>' +
      '</div></div>';
  }
}
