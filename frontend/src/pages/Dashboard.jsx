import { useState, useEffect } from 'react'
import { API_QUIROFANOS, API_EXPEDIENTES } from '../config'
import QuirofanoCard from '../components/QuirofanoCard'


function Dashboard() {
  const [quirofanos, setQuirofanos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState({
    open: false,
    loading: false,
    error: null,
    quirofano: null,
    expedientes: [],
    selectedId: ''
  })

  const fetchQuirofanos = async () => {
    try {
      const response = await fetch(`${API_QUIROFANOS}/quirofanos`)
      if (!response.ok) throw new Error('Error al cargar quirofanos')
      const data = await response.json()
      // Ordenar por número
      data.sort((a, b) => a.numero - b.numero)
      setQuirofanos(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuirofanos()
    // Polling cada 5 segundos
    const interval = setInterval(fetchQuirofanos, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleQuirofanoUpdate = (updatedQuirofano) => {
    setQuirofanos(prev =>
      prev.map(q =>
        q.id === updatedQuirofano.id ? updatedQuirofano : q
      )
    )
  }

  const abrirInicioManual = async (quirofano) => {
    setModal({
      open: true,
      loading: true,
      error: null,
      quirofano,
      expedientes: [],
      selectedId: ''
    })

    try {
      const response = await fetch(
        `${API_EXPEDIENTES}/expedientes/listos?quirofano_id=${quirofano.id}`
      )
      if (!response.ok) {
        setModal((prev) => ({
          ...prev,
          loading: false,
          error: 'No se pudieron cargar los expedientes listos.'
        }))
        return
      }
      const data = await response.json()
      setModal((prev) => ({
        ...prev,
        loading: false,
        expedientes: Array.isArray(data) ? data : []
      }))
    } catch (err) {
      setModal((prev) => ({
        ...prev,
        loading: false,
        error: 'Error de conexion al cargar expedientes.'
      }))
    }
  }

  const cerrarModal = () => {
    setModal({
      open: false,
      loading: false,
      error: null,
      quirofano: null,
      expedientes: [],
      selectedId: ''
    })
  }

  const iniciarCirugiaManual = async () => {
    if (!modal.selectedId) {
      setModal((prev) => ({ ...prev, error: 'Selecciona un expediente listo.' }))
      return
    }

    setModal((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetch(
        `${API_EXPEDIENTES}/expedientes/${modal.selectedId}/iniciar-cirugia`,
        { method: 'POST' }
      )
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setModal((prev) => ({
          ...prev,
          loading: false,
          error: data?.detail || 'No se pudo iniciar la cirugia.'
        }))
        return
      }

      await fetchQuirofanos()
      cerrarModal()
    } catch (err) {
      setModal((prev) => ({
        ...prev,
        loading: false,
        error: 'Error de conexion al iniciar cirugia.'
      }))
    }
  }

  const getStats = () => {
    const disponibles = quirofanos.filter(q => q.estado === 'disponible').length
    const ocupados = quirofanos.filter(q => q.estado === 'ocupado').length
    const limpieza = quirofanos.filter(q => q.estado === 'limpieza').length
    const urgencias = quirofanos.filter(q => q.es_urgencia).length
    return { disponibles, ocupados, limpieza, urgencias }
  }

  const stats = getStats()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Cargando quirofanos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: '#ff4757' }}>Error: {error}</p>
        <p style={{ color: '#888', fontSize: '0.9rem' }}>
          Asegurate de que el backend este corriendo en el puerto 8003
        </p>
        <button className="btn btn-primary" onClick={fetchQuirofanos}>
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-dot verde"></span>
          <span>Disponibles: <strong>{stats.disponibles}</strong></span>
        </div>
        <div className="stat-item">
          <span className="stat-dot rojo"></span>
          <span>Ocupados: <strong>{stats.ocupados}</strong></span>
        </div>
        <div className="stat-item">
          <span className="stat-dot amarillo"></span>
          <span>En Limpieza: <strong>{stats.limpieza}</strong></span>
        </div>
        {stats.urgencias > 0 && (
          <div className="stat-item" style={{ color: '#ff4757' }}>
            <span>URGENCIAS: <strong>{stats.urgencias}</strong></span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', color: '#888', fontSize: '0.85rem' }}>
          Total: {quirofanos.length} quirofanos
        </div>
      </div>

      <div className="quirofanos-grid">
        {quirofanos.map(quirofano => (
          <QuirofanoCard
            key={quirofano.id}
            quirofano={quirofano}
            onUpdate={handleQuirofanoUpdate}
            onManualStart={abrirInicioManual}
          />
        ))}
      </div>

      {modal.open && (
        <div className="study-modal-backdrop" onClick={cerrarModal}>
          <section className="study-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-toolbar" style={{ marginBottom: '0.75rem' }}>
              <div>
                <h3 className="admin-card-title" style={{ marginBottom: '0.25rem' }}>
                  Iniciar cirugia manual
                </h3>
                <div style={{ color: '#5e7791', fontSize: '0.85rem' }}>
                  Quirofano #{modal.quirofano?.numero}
                </div>
              </div>
              <button className="btn btn-danger" onClick={cerrarModal}>Cerrar</button>
            </div>

            {modal.loading && (
              <div style={{ color: '#5e7791', padding: '0.5rem 0' }}>Cargando expedientes listos...</div>
            )}

            {!modal.loading && modal.error && (
              <div className="admin-result error" style={{ marginBottom: '0.75rem' }}>{modal.error}</div>
            )}

            {!modal.loading && modal.expedientes.length === 0 && !modal.error && (
              <div style={{ color: '#5e7791' }}>No hay expedientes listos para este quirofano.</div>
            )}

            {!modal.loading && modal.expedientes.length > 0 && (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div className="admin-field-group">
                  <label className="admin-label">Selecciona expediente listo</label>
                  <select
                    className="sql-input admin-field"
                    value={modal.selectedId}
                    onChange={(e) => setModal((prev) => ({ ...prev, selectedId: e.target.value }))}
                  >
                    <option value="">Selecciona una opcion...</option>
                    {modal.expedientes.map((exp) => (
                      <option key={exp.id} value={exp.id}>
                        {exp.numero_expediente_clinico} | {exp.nombre} | {exp.hora_inicio_cirugia}
                      </option>
                    ))}
                  </select>
                </div>

                <button className="btn btn-success" onClick={iniciarCirugiaManual} disabled={modal.loading}>
                  {modal.loading ? 'Iniciando...' : 'Iniciar cirugia'}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default Dashboard
