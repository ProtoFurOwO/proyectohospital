import { useState, useEffect } from 'react'

const API_CITAS = 'http://localhost:8001'
const API_PERSONAL = 'http://localhost:8005'

function Horarios() {
  const [citas, setCitas] = useState([])
  const [medicos, setMedicos] = useState([])
  const [turnoActual, setTurnoActual] = useState('manana')
  const [loading, setLoading] = useState(true)

  const TURNOS = {
    manana: { nombre: 'Mañana', horario: '08:00 - 16:00', color: '#ffa502' },
    tarde: { nombre: 'Tarde', horario: '16:00 - 00:00', color: '#3742fa' },
    noche: { nombre: 'Noche', horario: '00:00 - 08:00', color: '#5f27cd' }
  }

  const BLOQUES_HORARIOS = [
    '08:00', '12:00', '16:00', '20:00', '00:00', '04:00'
  ]

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [turnoActual])

  const fetchData = async () => {
    try {
      const [citasRes, medicosRes] = await Promise.all([
        fetch(`${API_CITAS}/citas?turno=${turnoActual}`),
        fetch(`${API_PERSONAL}/personal/medicos?turno=${turnoActual}`)
      ])

      if (citasRes.ok && medicosRes.ok) {
        const citasData = await citasRes.json()
        const medicosData = await medicosRes.json()
        setCitas(citasData)
        setMedicos(medicosData)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMedicoOperaciones = (medicoId) => {
    return citas.filter(c => c.medico_id === medicoId && c.estado === 'programada').length
  }

  const getCitasPorHora = (hora) => {
    return citas.filter(c => {
      if (!c.fecha_cita) return false
      const citaHora = new Date(c.fecha_cita).getHours()
      const bloqueHora = parseInt(hora.split(':')[0])
      return citaHora === bloqueHora
    })
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Cargando horarios...</div>
  }

  return (
    <div>
      {/* Header con turnos */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
          📅 Gestión de Horarios y Turnos
        </h2>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          {Object.entries(TURNOS).map(([key, turno]) => (
            <button
              key={key}
              onClick={() => setTurnoActual(key)}
              style={{
                padding: '1rem 2rem',
                background: turnoActual === key ? turno.color : '#16213e',
                border: `2px solid ${turno.color}`,
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                flex: 1,
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{turno.nombre}</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{turno.horario}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Stats del turno */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: '#16213e',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #0f3460'
        }}>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Médicos en turno</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#00ff88' }}>
            {medicos.length}
          </div>
        </div>

        <div style={{
          background: '#16213e',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #0f3460'
        }}>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Cirugías programadas</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#3742fa' }}>
            {citas.length}
          </div>
        </div>

        <div style={{
          background: '#16213e',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #0f3460'
        }}>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Médicos disponibles</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ffa502' }}>
            {medicos.filter(m => m.disponible && m.operaciones_hoy < 2).length}
          </div>
        </div>

        <div style={{
          background: '#16213e',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #0f3460'
        }}>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Urgencias</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ff4757' }}>
            {citas.filter(c => c.es_urgencia).length}
          </div>
        </div>
      </div>

      {/* Grid de médicos con sus cargas */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', color: '#3742fa' }}>
          👨‍⚕️ Médicos del turno - Algoritmo de Jineteo
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '1rem'
        }}>
          {medicos.slice(0, 12).map(medico => {
            const operaciones = getMedicoOperaciones(medico.id)
            const disponible = medico.disponible && medico.operaciones_hoy < 2

            return (
              <div key={medico.id} style={{
                background: '#16213e',
                padding: '1rem',
                borderRadius: '8px',
                border: `2px solid ${disponible ? '#00ff88' : '#666'}`,
                opacity: disponible ? 1 : 0.6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '600' }}>{medico.nombre}</span>
                  {disponible && <span style={{ color: '#00ff88', fontSize: '0.8rem' }}>✓</span>}
                </div>
                <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  {medico.especialidad}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{
                    background: medico.operaciones_hoy === 0 ? '#00ff88' : medico.operaciones_hoy === 1 ? '#ffa502' : '#ff4757',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: '#000',
                    fontWeight: '600'
                  }}>
                    {medico.operaciones_hoy}/2 ops
                  </div>
                  <div style={{ color: '#666', fontSize: '0.75rem' }}>
                    {operaciones} programadas
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Timeline de bloques de 4 horas */}
      <div>
        <h3 style={{ marginBottom: '1rem', color: '#3742fa' }}>
          🕐 Bloques de cirugías (4 horas cada uno)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {BLOQUES_HORARIOS.map(hora => {
            const citasBloque = getCitasPorHora(hora)
            const horaFin = (parseInt(hora.split(':')[0]) + 4) % 24
            const horaFinStr = `${horaFin.toString().padStart(2, '0')}:00`

            return (
              <div key={hora} style={{
                background: '#16213e',
                border: '1px solid #0f3460',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>{hora} - {horaFinStr}</span>
                    <span style={{ color: '#888', marginLeft: '1rem', fontSize: '0.85rem' }}>
                      (3h cirugía + 1h limpieza)
                    </span>
                  </div>
                  <span style={{
                    background: citasBloque.length > 0 ? '#3742fa' : '#0f3460',
                    padding: '0.25rem 1rem',
                    borderRadius: '20px',
                    fontSize: '0.85rem'
                  }}>
                    {citasBloque.length} cirugías
                  </span>
                </div>

                {citasBloque.length > 0 ? (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {citasBloque.map(cita => (
                      <div key={cita.id} style={{
                        background: '#0f3460',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: cita.es_urgencia ? '2px solid #ff4757' : 'none'
                      }}>
                        <div>
                          <div style={{ fontWeight: '600' }}>
                            {cita.paciente_nombre}
                            {cita.es_urgencia && <span style={{ color: '#ff4757', marginLeft: '0.5rem' }}>⚠️ URGENCIA</span>}
                          </div>
                          <div style={{ color: '#888', fontSize: '0.85rem' }}>
                            {cita.tipo_cirugia} - Dr. {cita.medico_nombre}
                          </div>
                        </div>
                        <div style={{
                          background: '#3742fa',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}>
                          Q#{cita.quirofano_id || '--'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>
                    Sin cirugías programadas
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Horarios
