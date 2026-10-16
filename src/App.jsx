import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from "./pages/LandingPage/LandingPage";
import Login from "./pages/Login/Login";
import RequestDocumentPage from './pages/LandingPage/RequestDocumentPage'
import TrackDocumentsPage from './pages/LandingPage/TrackDocumentsPage'
import Dashboard from './pages/Dashboard/Dashboard'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/request-document" element={<RequestDocumentPage />} />
        <Route path="/track-documents" element={<TrackDocumentsPage />} />

        {/* Single role-aware dashboard; legacy role paths redirect here */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/city-administrator" element={<Navigate to="/dashboard" replace />} />
        <Route path="/city-enro" element={<Navigate to="/dashboard" replace />} />
        <Route path="/swm-secretary" element={<Navigate to="/dashboard" replace />} />
        <Route path="/divisions" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
