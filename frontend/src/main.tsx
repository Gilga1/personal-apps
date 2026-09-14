import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './stress-buster.css'
import { StressBusterApp } from './StressBusterApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StressBusterApp />
  </StrictMode>,
)
