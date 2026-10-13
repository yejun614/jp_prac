import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'pretendard-jp/dist/web/variable/pretendardvariable-jp-dynamic-subset.css'
import './index.css'
import { BrowserRouter } from 'react-router'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
