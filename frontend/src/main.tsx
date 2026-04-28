import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import Report from './pages/Report'
import Revenue from './pages/Revenue'
import Costs from './pages/Costs'
import ToastContainer from './components/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/rapport" element={<Report />} />
        <Route path="/omzet" element={<Revenue />} />
        <Route path="/kosten" element={<Costs />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
