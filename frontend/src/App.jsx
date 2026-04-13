import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Horarios from './pages/Horarios'
import AsignacionMedicos from './pages/AsignacionMedicos'
import DoctorPortal from './pages/DoctorPortal'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="app">
      <header className="header">
        <h1>Sistema Hospitalario</h1>
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard Quirofanos
          </button>
          <button
            className={`nav-tab ${activeTab === 'asignacion' ? 'active' : ''}`}
            onClick={() => setActiveTab('asignacion')}
          >
            Asignar Bloques (Admin)
          </button>
          <button
            className={`nav-tab ${activeTab === 'horarios' ? 'active' : ''}`}
            onClick={() => setActiveTab('horarios')}
          >
            Ver Horarios
          </button>
          <button
            className={`nav-tab ${activeTab === 'portal-doctor' ? 'active' : ''}`}
            onClick={() => setActiveTab('portal-doctor')}
          >
            Portal Doctores
          </button>
        </nav>
      </header>

      <main className="container">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'asignacion' && <AsignacionMedicos />}
        {activeTab === 'horarios' && <Horarios />}
        {activeTab === 'portal-doctor' && <DoctorPortal />}
      </main>
    </div>
  )
}

export default App
