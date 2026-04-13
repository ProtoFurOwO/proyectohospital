import { useState, useEffect } from 'react'
import QuirofanoCard from '../components/QuirofanoCard'

const API_URL = 'http://localhost:8003'

function Dashboard() {
  const [quirofanos, setQuirofanos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchQuirofanos = async () => {
    try {
      const response = await fetch(`${API_URL}/quirofanos`)
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
          />
        ))}
      </div>
    </div>
  )
}

export default Dashboard
