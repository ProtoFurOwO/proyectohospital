import { useState, useEffect } from 'react'

const API_CITAS = 'http://localhost:8001'
const API_PERSONAL = 'http://localhost:8005'

function AsignacionMedicos() {
  const [medicos, setMedicos] = useState([])
  const [citas, setCitas] = useState([])
  const [medicoSeleccionado, setMedicoSeleccionado] = useState(null)
  const [turnoFiltro, setTurnoFiltro] = useState('todos')
  const [loading, setLoading] = useState(true)

  const TURNOS = [
    { key: 'manana', nombre: 'Mañana', horario: '08:00-16:00', bloques: ['08:00', '12:00'] },
    { key: 'tarde', nombre: 'Tarde', horario: '16:00-00:00', bloques: ['16:00', '20:00'] },
    { key: 'noche', nombre: 'Noche', horario: '00:00-08:00', bloques: ['00:00', '04:00'] }
  ]

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const [medicosRes, citasRes] = await Promise.all([
        fetch(`${API_PERSONAL}/personal/medicos`),
        fetch(`${API_CITAS}/citas`)
      ])

      if (medicosRes.ok && citasRes.ok) {
        setMedicos(await medicosRes.json())
        setCitas(await citasRes.json())
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getBloqueOcupado = (turno, horaInicio) => {
    return citas.find(c => {
      if (!c.fecha_cita || c.turno !== turno) return false
      const citaHora = new Date(c.fecha_cita).getHours()
      const bloqueHora = parseInt(horaInicio.split(':')[0])
      return citaHora === bloqueHora
    })
  }

  const handleAsignarBloque = async (turno, horaInicio) => {
    if (!medicoSeleccionado) {
      alert('Primero selecciona un médico')
      return
    }

    const medico = medicos.find(m => m.id === medicoSeleccionado)

    if (!medico.disponible || medico.operaciones_hoy >= 2) {
      alert('Este médico ya alcanzó su límite de 2 operaciones diarias')
      return
    }

    const bloqueOcupado = getBloqueOcupado(turno, horaInicio)
    if (bloqueOcupado) {
      alert('Este bloque ya está ocupado')
      return
    }

    try {
      // Crear cita en el bloque
      const horaNum = parseInt(horaInicio.split(':')[0])
      const fechaCita = new Date()
      fechaCita.setHours(horaNum, 0, 0, 0)

      const response = await fetch(`${API_CITAS}/citas/programar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_id: Math.floor(Math.random() * 1000),
          paciente_nombre: 'Paciente Programado',
          medico_id: medico.id,
          medico_nombre: medico.nombre,
          fecha_cita: fechaCita.toISOString(),
          tipo_cirugia: medico.especialidad,
          turno: turno,
          es_urgencia: false
        })
      })

      if (response.ok) {
        // Asignar el médico
        await fetch(`${API_PERSONAL}/personal/asignar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            medico_id: medico.id,
            quirofano_id: 1
          })
        })

        alert(`✓ Bloque asignado a ${medico.nombre}`)
        fetchData()
      }
    } catch (error) {
      alert('Error al asignar bloque')
    }
  }

  const getMedicosFiltrados = () => {
    if (turnoFiltro === 'todos') return medicos
    return medicos.filter(m => m.turno === turnoFiltro)
  }

  const getCitasPorMedico = (medicoId) => {
    return citas.filter(c => c.medico_id === medicoId && c.estado === 'programada')
  }

  const getSugerenciaJineteo = (turno) => {
    const candidatos = medicos.filter(m =>
      m.turno === turno &&
      m.disponible &&
      m.operaciones_hoy < 2
    )

    if (candidatos.length === 0) return null

    candidatos.sort((a, b) => a.operaciones_hoy - b.operaciones_hoy)
    return candidatos[0]
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</div>
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
        🗓️ Asignación de Bloques - Médicos
      </h2>
      <p style={{ color: '#888', marginBottom: '2rem' }}>
        Los médicos pueden seleccionar bloques de 4 horas (3h cirugía + 1h limpieza). Máximo 2 operaciones por día.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
        {/* Panel izquierdo - Selección de médico */}
        <div>
          <div style={{
            background: '#16213e',
            border: '1px solid #0f3460',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            position: 'sticky',
            top: '1rem'
          }}>
            <h3 style={{ marginBottom: '1rem', color: '#3742fa' }}>
              Seleccionar Médico
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              <select
                value={turnoFiltro}
                onChange={(e) => setTurnoFiltro(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#0f3460',
                  border: '1px solid #3742fa',
                  borderRadius: '4px',
                  color: '#fff',
                  marginBottom: '1rem'
                }}
              >
                <option value="todos">Todos los turnos</option>
                <option value="manana">Mañana</option>
                <option value="tarde">Tarde</option>
                <option value="noche">Noche</option>
              </select>
            </div>

            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {getMedicosFiltrados().map(medico => (
                <div
                  key={medico.id}
                  onClick={() => setMedicoSeleccionado(medico.id)}
                  style={{
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    background: medicoSeleccionado === medico.id ? '#3742fa' : '#0f3460',
                    border: `2px solid ${medico.disponible && medico.operaciones_hoy < 2 ? '#00ff88' : '#666'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: medico.disponible && medico.operaciones_hoy < 2 ? 1 : 0.5
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                    {medico.nombre}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>
                    {medico.especialidad}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{
                      background: medico.operaciones_hoy === 0 ? '#00ff88' : medico.operaciones_hoy === 1 ? '#ffa502' : '#ff4757',
                      color: '#000',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      fontWeight: '600'
                    }}>
                      {medico.operaciones_hoy}/2
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#666' }}>
                      {medico.turno}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {medicoSeleccionado && (
            <div style={{
              background: '#16213e',
              border: '2px solid #00ff88',
              borderRadius: '8px',
              padding: '1rem'
            }}>
              <div style={{ fontWeight: '600', color: '#00ff88', marginBottom: '0.5rem' }}>
                ✓ Médico seleccionado
              </div>
              <div style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                {medicos.find(m => m.id === medicoSeleccionado)?.nombre}
              </div>

              {/* Cirugías programadas */}
              <div style={{ borderTop: '1px solid #0f3460', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                  Cirugías programadas:
                </div>
                {getCitasPorMedico(medicoSeleccionado).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {getCitasPorMedico(medicoSeleccionado).map(cita => (
                      <div key={cita.id} style={{
                        background: '#0f3460',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        <div style={{ fontWeight: '600' }}>{cita.paciente_nombre}</div>
                        <div style={{ color: '#888' }}>{cita.tipo_cirugia}</div>
                        <div style={{ color: '#3742fa', fontSize: '0.75rem' }}>
                          {new Date(cita.fecha_cita).toLocaleString('es-MX')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#666', fontSize: '0.8rem' }}>
                    Sin cirugías programadas
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Panel derecho - Bloques por turno */}
        <div>
          {TURNOS.map(turno => {
            const sugerencia = getSugerenciaJineteo(turno.key)

            return (
              <div key={turno.key} style={{
                background: '#16213e',
                border: '1px solid #0f3460',
                borderRadius: '8px',
                padding: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>
                      {turno.nombre}
                    </h3>
                    <div style={{ color: '#888', fontSize: '0.9rem' }}>{turno.horario}</div>
                  </div>

                  {sugerencia && (
                    <div style={{
                      background: '#ffa502',
                      color: '#000',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: '600'
                    }}>
                      💡 Jineteo sugiere: {sugerencia.nombre}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  {turno.bloques.map(horaInicio => {
                    const horaFin = (parseInt(horaInicio.split(':')[0]) + 4) % 24
                    const horaFinStr = `${horaFin.toString().padStart(2, '0')}:00`
                    const citaOcupada = getBloqueOcupado(turno.key, horaInicio)
                    const esSugerido = sugerencia && medicoSeleccionado === sugerencia.id

                    return (
                      <div key={horaInicio} style={{
                        background: citaOcupada ? '#0f3460' : '#1a1a2e',
                        border: `2px solid ${citaOcupada ? '#666' : esSugerido ? '#ffa502' : '#3742fa'}`,
                        borderRadius: '8px',
                        padding: '1rem',
                        position: 'relative'
                      }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                          {horaInicio} - {horaFinStr}
                        </div>
                        <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '1rem' }}>
                          3h cirugía + 1h limpieza
                        </div>

                        {citaOcupada ? (
                          <div style={{
                            background: '#ff4757',
                            color: '#fff',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.85rem'
                          }}>
                            <div style={{ fontWeight: '600' }}>OCUPADO</div>
                            <div style={{ fontSize: '0.75rem' }}>
                              {citaOcupada.medico_nombre}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAsignarBloque(turno.key, horaInicio)}
                            disabled={!medicoSeleccionado}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              background: medicoSeleccionado ? (esSugerido ? '#ffa502' : '#00ff88') : '#666',
                              color: '#000',
                              border: 'none',
                              borderRadius: '6px',
                              fontWeight: '600',
                              cursor: medicoSeleccionado ? 'pointer' : 'not-allowed',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {esSugerido ? '⭐ Agarrar (Sugerido)' : 'Agarrar bloque'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AsignacionMedicos
