import { useState } from 'react'

const API_URL = 'http://localhost:8003'

function QuirofanoCard({ quirofano, onUpdate, onManualStart }) {
  const [loading, setLoading] = useState(false)

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'disponible': return '#14b8a6'
      case 'ocupado': return '#ff4757'
      case 'limpieza': return '#ffa502'
      default: return '#666'
    }
  }

  const getEstadoTexto = (estado) => {
    switch (estado) {
      case 'disponible': return 'DISPONIBLE'
      case 'ocupado': return 'OCUPADO'
      case 'limpieza': return 'EN LIMPIEZA'
      default: return estado.toUpperCase()
    }
  }

  const handleAction = async (action, payload) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/quirofanos/${quirofano.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined
      })

      if (response.ok) {
        const data = await response.json()
        if (onUpdate) onUpdate(data.data)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  const cardStyle = {
    background: `linear-gradient(135deg, #ffffff 0%, ${getEstadoColor(quirofano.estado)}15 100%)`,
    border: `2px solid ${getEstadoColor(quirofano.estado)}`,
    borderRadius: '12px',
    padding: '1.25rem',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden'
  }

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem'
  }

  const numeroStyle = {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#16324b'
  }

  const statusBadge = {
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '600',
    background: getEstadoColor(quirofano.estado),
    color: quirofano.estado === 'disponible' ? '#000' : '#fff'
  }

  const infoStyle = {
    marginBottom: '1rem',
    minHeight: '60px'
  }

  const labelStyle = {
    color: '#607890',
    fontSize: '0.75rem',
    marginBottom: '0.25rem'
  }

  const valueStyle = {
    color: '#1f435f',
    fontSize: '0.9rem'
  }

  const buttonContainer = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  }

  return (
    <div style={cardStyle}>
      {quirofano.es_urgencia && (
        <div style={{
          position: 'absolute',
          top: '0',
          right: '0',
          background: '#ff4757',
          color: '#fff',
          padding: '0.25rem 1rem',
          fontSize: '0.7rem',
          fontWeight: '700',
          borderBottomLeftRadius: '8px'
        }}>
          URGENCIA
        </div>
      )}

      <div style={headerStyle}>
        <span style={numeroStyle}>Quirofano #{quirofano.numero}</span>
        <span style={statusBadge}>{getEstadoTexto(quirofano.estado)}</span>
      </div>

      <div style={infoStyle}>
        {quirofano.estado === 'ocupado' && (
          <>
            <div style={labelStyle}>Paciente</div>
            <div style={valueStyle}>{quirofano.paciente_nombre || 'Sin asignar'}</div>
            <div style={labelStyle}>Medico</div>
            <div style={valueStyle}>{quirofano.medico_nombre || 'Sin asignar'}</div>
            <div style={labelStyle}>Anestesiologo</div>
            <div style={valueStyle}>{quirofano.anestesiologo_nombre || '-'}</div>
            <div style={labelStyle}>Especialidad</div>
            <div style={valueStyle}>{quirofano.especialidad || '-'}</div>
            {quirofano.tipo_cirugia && (
              <>
                <div style={labelStyle}>Cirugia</div>
                <div style={valueStyle}>{quirofano.tipo_cirugia}</div>
              </>
            )}
            {quirofano.inicio_operacion && (
              <>
                <div style={labelStyle}>Inicio</div>
                <div style={valueStyle}>{formatTime(quirofano.inicio_operacion)}</div>
              </>
            )}
          </>
        )}

        {quirofano.estado === 'limpieza' && quirofano.fin_estimado && (
          <>
            <div style={labelStyle}>Fin estimado limpieza</div>
            <div style={valueStyle}>{formatTime(quirofano.fin_estimado)}</div>
          </>
        )}

        {quirofano.estado === 'disponible' && (
          <div style={{ color: '#14b8a6', fontSize: '0.9rem' }}>
            Listo para cirugia
          </div>
        )}
      </div>

      <div style={buttonContainer}>
        {quirofano.estado === 'disponible' && (
          <button
            className="btn btn-success"
            onClick={() => onManualStart?.(quirofano)}
            disabled={loading}
          >
            {loading ? 'Iniciando...' : 'Iniciar Cirugia'}
          </button>
        )}

        {quirofano.estado === 'ocupado' && (
          <button
            className="btn btn-warning"
            onClick={() => handleAction('terminar')}
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Terminar Cirugia'}
          </button>
        )}

        {quirofano.estado === 'limpieza' && (
          <button
            className="btn btn-primary"
            onClick={() => handleAction('limpiar')}
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Limpieza Lista'}
          </button>
        )}

        {quirofano.estado !== 'ocupado' && (
          <button
            className="btn btn-danger"
            onClick={() => handleAction('urgencia')}
            disabled={loading}
            style={{ fontSize: '0.75rem' }}
          >
            URGENCIA
          </button>
        )}
      </div>
    </div>
  )
}

export default QuirofanoCard
