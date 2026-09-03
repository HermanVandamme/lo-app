import { Routes, Route, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import ErrorBoundary from './components/ErrorBoundary'
import InstallPrompt from './components/InstallPrompt'
import Home from './pages/Home'
import SportDetail from './pages/SportDetail'
import SportEvaluatie from './pages/SportEvaluatie'
import Evaluatie from './pages/Evaluatie'
import Resultaten from './pages/Resultaten'
import Jaarplan from './pages/Jaarplan'
import Admin from './pages/Admin'

function AppShell() {
  // De key zorgt dat een foutmelding verdwijnt zodra je naar een ander scherm
  // navigeert — anders blijf je op de melding hangen tot je herlaadt.
  const { pathname } = useLocation()

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <NavBar />
      <InstallPrompt />
      <main className="flex-1 container mx-auto px-3 py-5 max-w-3xl">
        <ErrorBoundary key={pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sport/:sportId" element={<SportDetail />} />
          <Route path="/sport/:sportId/graad/:graad/evaluatie" element={<SportEvaluatie />} />
          <Route path="/evaluatie" element={<Evaluatie />} />
          <Route path="/resultaten" element={<Resultaten />} />
          <Route path="/jaarplan" element={<Jaarplan />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default function App() {
  return <AppShell />
}
