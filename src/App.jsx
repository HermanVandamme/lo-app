import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import InstallPrompt from './components/InstallPrompt'
import Home from './pages/Home'
import SportDetail from './pages/SportDetail'
import SportEvaluatie from './pages/SportEvaluatie'
import Evaluatie from './pages/Evaluatie'
import Resultaten from './pages/Resultaten'
import Admin from './pages/Admin'

function AppShell() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <NavBar />
      <InstallPrompt />
      <main className="flex-1 container mx-auto px-3 py-5 max-w-3xl">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sport/:sportId" element={<SportDetail />} />
          <Route path="/sport/:sportId/graad/:graad/evaluatie" element={<SportEvaluatie />} />
          <Route path="/evaluatie" element={<Evaluatie />} />
          <Route path="/resultaten" element={<Resultaten />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return <AppShell />
}
