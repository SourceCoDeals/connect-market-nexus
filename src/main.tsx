
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { seedDatabase } from './seed.ts'

// Seed database with sample data for development
if (import.meta.env.DEV) {
  seedDatabase().catch(console.error);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
