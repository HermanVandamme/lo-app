import { Routes, Route, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import InstallPrompt from './components/InstallPrompt'
import Home from './pages/Home'
import SportDetail from './pages/SportDetail'
import LesDetail from './pages/LesDetail'
import Evaluatie from './pages/Evaluatie'
import Admin from './pages/Admin'
import Zelfevaluatie from './pages/Zelfevaluatie'

function AppShell() {
  const { pathname } = useLocation()
  const isPublic = pathname.startsWith('/zelfeval')

  if (isPublic) {
    return (
      <Routes>
        <Route path="/zelfeval" element={<Zelfevaluatie />} />
      </Routes>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <NavBar />
      <InstallPrompt />
      <main className="flex-1 container mx-auto px-3 py-5 max-w-3xl">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sport/:sportId" element={<SportDetail />} />
          <Route path="/sport/:sportId/graad/:graad/les/:les" element={<LesDetail />} />
          <Route path="/evaluatie" element={<Evaluatie />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return <AppShell />
}
