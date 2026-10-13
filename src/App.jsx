import { Navigate, Route, Routes } from 'react-router'
import MemoPage from './pages/MemoPage.jsx'
import TypingPage from './pages/TypingPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MemoPage />} />
      <Route path="/typing" element={<TypingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
