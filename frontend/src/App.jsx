import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Horarios from './pages/Horarios'
import AsignacionMedicos from './pages/AsignacionMedicos'
import DoctorPortal from './pages/DoctorPortal'
import CitasAdmin from './pages/CitasAdmin'
import ExpedientesAdmin from './pages/ExpedientesAdmin'
import AdminMedicos from './pages/AdminMedicos'

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
          <button
            className={`nav-tab ${activeTab === 'citas-admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('citas-admin')}
          >
            Citas Admin
          </button>
          <button
            className={`nav-tab ${activeTab === 'expedientes-admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('expedientes-admin')}
          >
            Expedientes Admin
          </button>
          <button
            className={`nav-tab ${activeTab === 'admin-medicos' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin-medicos')}
            style={{ color: '#ec4899' }}
          >
            👨‍⚕️ Admin Médicos
          </button>
        </nav>
      </header>

      <main className="container">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'asignacion' && <AsignacionMedicos />}
        {activeTab === 'horarios' && <Horarios />}
        {activeTab === 'portal-doctor' && <DoctorPortal />}
        {activeTab === 'citas-admin' && <CitasAdmin />}
        {activeTab === 'expedientes-admin' && <ExpedientesAdmin />}
        {activeTab === 'admin-medicos' && <AdminMedicos />}
      </main>
    </div>
  )
}

export default App
