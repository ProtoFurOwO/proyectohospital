import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import SqlTerminal from './pages/SqlTerminal'
import Horarios from './pages/Horarios'
import AsignacionMedicos from './pages/AsignacionMedicos'

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
            Asignar Bloques
          </button>
          <button
            className={`nav-tab ${activeTab === 'horarios' ? 'active' : ''}`}
            onClick={() => setActiveTab('horarios')}
          >
            Ver Horarios
          </button>
          <button
            className={`nav-tab ${activeTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminal')}
          >
            Terminal SQL
          </button>
        </nav>
      </header>

      <main className="container">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'asignacion' && <AsignacionMedicos />}
        {activeTab === 'horarios' && <Horarios />}
        {activeTab === 'terminal' && <SqlTerminal />}
      </main>
    </div>
  )
}

export default App
