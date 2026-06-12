import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import ReloadPrompt from './components/ReloadPrompt.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <ReloadPrompt />
  </StrictMode>,
)
