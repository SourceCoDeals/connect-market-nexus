
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { seedDatabase } from './seed.ts'
import { BrowserRouter } from 'react-router-dom'

// Seed database with sample data for development only
if (import.meta.env.DEV) {
  seedDatabase().catch(() => {
    // Error already logged by seedDatabase function
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
