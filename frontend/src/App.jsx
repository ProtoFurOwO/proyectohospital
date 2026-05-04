import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Horarios from './pages/Horarios'
import AsignacionMedicos from './pages/AsignacionMedicos'
import DoctorPortal from './pages/DoctorPortal'
import CitasAdmin from './pages/CitasAdmin'
import ExpedientesAdmin from './pages/ExpedientesAdmin'
import AdminMedicos from './pages/AdminMedicos'
import { API } from './config'

function App() {
  const [activeTab, setActiveTab] = useState('horarios')
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('hospital_admin') === '1')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    // Si la tab activa es admin-only y el usuario cierra sesion, redirigir
    const adminTabs = ['dashboard', 'asignacion', 'admin-medicos']
    if (!isAdmin && adminTabs.includes(activeTab)) {
      setActiveTab('horarios')
    }
  }, [isAdmin, activeTab])

  const handleLogin = async () => {
    try {
      const response = await fetch(API.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      })

      if (response.ok) {
        const data = await response.json()
        setIsAdmin(true)
        sessionStorage.setItem('hospital_admin', '1')
        sessionStorage.setItem('hospital_jwt', data.token)
        setShowLoginModal(false)
        setLoginUser('')
        setLoginPass('')
        setLoginError('')
      } else {
        setLoginError('Usuario o contraseña incorrectos')
      }
    } catch (error) {
      setLoginError('Error de conexión con el servidor')
    }
  }

  const handleLogout = () => {
    setIsAdmin(false)
    sessionStorage.removeItem('hospital_admin')
    sessionStorage.removeItem('hospital_jwt')
    setActiveTab('horarios')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <h1>Sistema Hospitalario</h1>
          <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            ☰
          </button>
        </div>
        <nav className={`nav-tabs ${isMenuOpen ? 'open' : ''}`}>
          {/* === Tabs publicos (siempre visibles) === */}
          <button
            className={`nav-tab ${activeTab === 'horarios' ? 'active' : ''}`}
            onClick={() => { setActiveTab('horarios'); setIsMenuOpen(false); }}
          >
            Ver Horarios
          </button>
          <button
            className={`nav-tab ${activeTab === 'portal-doctor' ? 'active' : ''}`}
            onClick={() => { setActiveTab('portal-doctor'); setIsMenuOpen(false); }}
          >
            Portal Doctores
          </button>
          <button
            className={`nav-tab ${activeTab === 'citas-admin' ? 'active' : ''}`}
            onClick={() => { setActiveTab('citas-admin'); setIsMenuOpen(false); }}
          >
            Citas
          </button>
          <button
            className={`nav-tab ${activeTab === 'expedientes-admin' ? 'active' : ''}`}
            onClick={() => { setActiveTab('expedientes-admin'); setIsMenuOpen(false); }}
          >
            Expedientes
          </button>

          {/* === Tabs admin (solo con login) === */}
          {isAdmin && (
            <>
              <button
                className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => { setActiveTab('dashboard'); setIsMenuOpen(false); }}
              >
                Dashboard Quirofanos
              </button>
              <button
                className={`nav-tab ${activeTab === 'asignacion' ? 'active' : ''}`}
                onClick={() => { setActiveTab('asignacion'); setIsMenuOpen(false); }}
              >
                Asignar Bloques
              </button>
              <button
                className={`nav-tab ${activeTab === 'admin-medicos' ? 'active' : ''}`}
                onClick={() => { setActiveTab('admin-medicos'); setIsMenuOpen(false); }}
                style={{ color: '#ec4899' }}
              >
                👨‍⚕️ Admin Médicos
              </button>
              <button
                className="nav-tab"
                onClick={() => { window.open(window.location.origin + '/compiler/', '_blank'); setIsMenuOpen(false); }}
                style={{ color: '#f59e0b' }}
              >
                ⚙️ Motor SQL
              </button>
            </>
          )}

          {/* === Login / Logout === */}
          {!isAdmin ? (
            <button
              className="nav-tab nav-tab-login"
              onClick={() => { setShowLoginModal(true); setIsMenuOpen(false); }}
            >
              🔒 Admin
            </button>
          ) : (
            <button
              className="nav-tab nav-tab-logout"
              onClick={() => { handleLogout(); setIsMenuOpen(false); }}
            >
              🔓 Cerrar sesión
            </button>
          )}
        </nav>
      </header>

      <main className="container">
        {activeTab === 'horarios' && <Horarios />}
        {activeTab === 'portal-doctor' && <DoctorPortal />}
        {activeTab === 'citas-admin' && <CitasAdmin />}
        {activeTab === 'expedientes-admin' && <ExpedientesAdmin />}
        {isAdmin && activeTab === 'dashboard' && <Dashboard />}
        {isAdmin && activeTab === 'asignacion' && <AsignacionMedicos />}
        {isAdmin && activeTab === 'admin-medicos' && <AdminMedicos />}
      </main>

      {/* === Modal de Login === */}
      {showLoginModal && (
        <div className="login-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="login-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="login-title">Acceso Administrador</h2>
            <p className="login-subtitle">Ingresa tus credenciales para acceder al panel de control</p>

            <div className="login-field">
              <label>Usuario</label>
              <input
                type="text"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="admin"
                autoFocus
              />
            </div>

            <div className="login-field">
              <label>Contraseña</label>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="••••••••"
              />
            </div>

            {loginError && <div className="login-error">{loginError}</div>}

            <div className="login-actions">
              <button className="btn btn-primary login-btn" onClick={handleLogin}>
                Iniciar sesión
              </button>
              <button className="btn login-btn-cancel" onClick={() => setShowLoginModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

