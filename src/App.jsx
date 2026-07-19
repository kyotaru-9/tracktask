import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from "./pages/LandingPage/LandingPage";
import Login from "./pages/Login/Login";
import Mayor from "./pages/Mayor/Mayor";
import CityAdministrator from './pages/CityAdministrator/CityAdministrator'
import CityEnro from './pages/CityEnro/CityEnro'
import SWMSecretary from './pages/SWMSecretary/SWMSecretary'
import Divisions from './pages/Divisions/Divisions'
import RequestDocumentPage from './pages/LandingPage/RequestDocumentPage'
import TrackDocumentsPage from './pages/LandingPage/TrackDocumentsPage'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/request-document" element={<RequestDocumentPage />} />
        <Route path="/track-documents" element={<TrackDocumentsPage />} />
        <Route path="/dashboard" element={<Mayor />} />
        <Route path="/city-administrator" element={<CityAdministrator />} />
        <Route path="/city-enro" element={<CityEnro />} />
        <Route path="/swm-secretary" element={<SWMSecretary />} />
        <Route path="/divisions" element={<Divisions />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App