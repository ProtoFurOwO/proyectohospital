import { useMemo, useEffect, useState } from 'react'

const API_PERSONAL = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE : 'http://localhost:8005'

const TURNOS = [
  { key: 'manana', nombre: 'Mañana', horario: '08:00-16:00', bloques: ['08:00', '12:00'] },
  { key: 'tarde', nombre: 'Tarde', horario: '16:00-00:00', bloques: ['16:00', '20:00'] },
  { key: 'noche', nombre: 'Noche', horario: '00:00-08:00', bloques: ['00:00', '04:00'] }
]

function AsignacionMedicos() {
  const [medicos, setMedicos] = useState([])
  const [slots, setSlots] = useState([])
  const [medicoSeleccionado, setMedicoSeleccionado] = useState(null)
  const [turnoFiltro, setTurnoFiltro] = useState('todos')
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => new Date().toISOString().slice(0, 10))
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(true)

  const medicoActivo = useMemo(
    () => medicos.find((item) => item.id === medicoSeleccionado) || null,
    [medicos, medicoSeleccionado]
  )

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fechaSeleccionada])

  const fetchData = async () => {
    try {
      const [medicosRes, slotsRes] = await Promise.all([
        fetch(`${API_PERSONAL}/personal/medicos`),
        fetch(`${API_PERSONAL}/personal/portal/slots?fecha=${fechaSeleccionada}`)
      ])

      if (medicosRes.ok) {
        setMedicos(await medicosRes.json())
      }

      if (slotsRes.ok) {
        const slotsData = await slotsRes.json()
        setSlots(slotsData.slots || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMedicosFiltrados = () => {
    if (turnoFiltro === 'todos') return medicos
    return medicos.filter((item) => item.turno === turnoFiltro)
  }

  const getSlotsPorBloque = (turno, bloque) => {
    return slots
      .filter((item) => item.turno === turno && item.bloque === bloque)
      .sort((a, b) => a.quirofano_id - b.quirofano_id)
  }

  const getProgramacionesPorMedico = (medicoId) => {
    return slots
      .filter((item) => item.ocupado && item.medico_id === medicoId)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
  }

  const getSugerenciaJineteo = (turno) => {
    const candidatos = medicos.filter((item) => (
      item.turno === turno && item.disponible && item.operaciones_hoy < 2
    ))

    if (candidatos.length === 0) return null

    candidatos.sort((a, b) => a.operaciones_hoy - b.operaciones_hoy)
    return candidatos[0]
  }

  const formatTurno = (turno) => {
    if (turno === 'manana') return 'Mañana'
    if (turno === 'tarde') return 'Tarde'
    if (turno === 'noche') return 'Noche'
    return turno
  }

  const handleAsignarSlot = async (slot) => {
    if (!medicoActivo) {
      setResultado({ success: false, message: 'Selecciona un medico primero.' })
      return
    }

    if (slot.ocupado) {
      setResultado({ success: false, message: `El slot ${slot.bloque} en Q${slot.quirofano_id} ya esta ocupado.` })
      return
    }

    try {
      const response = await fetch(`${API_PERSONAL}/personal/portal/solicitar-turno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medico_id: medicoActivo.id,
          turno_deseado: slot.turno,
          fecha_deseada: fechaSeleccionada,
          bloque_deseado: slot.bloque,
          quirofano_id: slot.quirofano_id,
          origen: 'admin'
        })
      })

      const data = await response.json()

      setResultado({
        success: !!data.success,
        message: data.message || 'No fue posible asignar el bloque.'
      })

      await fetchData()
    } catch (error) {
      setResultado({ success: false, message: 'Error de conexion al asignar el slot.' })
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</div>
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
        Asignacion de Bloques - Admin
      </h2>
      <p style={{ color: '#888', marginBottom: '1rem' }}>
        Demo estricta: 30 quirofanos (Q1-Q30), 10 por turno y 5 por bloque en la fecha elegida.
      </p>

      <div style={{ marginBottom: '1rem', maxWidth: '260px' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: '#607890', marginBottom: '0.3rem' }}>
          Fecha de asignacion
        </label>
        <input
          type="date"
          value={fechaSeleccionada}
          onChange={(e) => setFechaSeleccionada(e.target.value)}
          className="sql-input admin-field"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem' }}>
        <div>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e6f5ff',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            position: 'sticky',
            top: '1rem'
          }}>
            <h3 style={{ marginBottom: '0.75rem', color: '#0a78b5' }}>Seleccionar Medico</h3>

            <select
              value={turnoFiltro}
              onChange={(e) => setTurnoFiltro(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#e6f5ff',
                border: '1px solid #0a78b5',
                borderRadius: '4px',
                color: '#1f435f',
                marginBottom: '1rem'
              }}
            >
              <option value="todos">Todos los turnos</option>
              <option value="manana">Mañana</option>
              <option value="tarde">Tarde</option>
              <option value="noche">Noche</option>
            </select>

            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {getMedicosFiltrados().map((medico) => (
                <div
                  key={medico.id}
                  onClick={() => setMedicoSeleccionado(medico.id)}
                  style={{
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    background: medicoSeleccionado === medico.id ? '#0a78b5' : '#e6f5ff',
                    border: `2px solid ${medico.disponible && medico.operaciones_hoy < 2 ? '#14b8a6' : '#666'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: medico.disponible && medico.operaciones_hoy < 2 ? 1 : 0.55,
                    color: medicoSeleccionado === medico.id ? '#fff' : '#1f435f'
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{medico.nombre}</div>
                  <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem', color: medicoSeleccionado === medico.id ? '#d7eefb' : '#68819a' }}>
                    {medico.especialidad}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{
                      background: medico.operaciones_hoy === 0 ? '#14b8a6' : medico.operaciones_hoy === 1 ? '#ffa502' : '#ff4757',
                      color: '#000',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      fontWeight: '600'
                    }}>
                      {medico.operaciones_hoy}/2
                    </span>
                    {turnoFiltro !== 'todos' && (
                      <span style={{ fontSize: '0.7rem', color: medicoSeleccionado === medico.id ? '#d7eefb' : '#607890' }}>
                        {formatTurno(medico.turno)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {medicoActivo && (
            <div style={{
              background: '#ffffff',
              border: '2px solid #14b8a6',
              borderRadius: '8px',
              padding: '1rem'
            }}>
              <div style={{ fontWeight: '600', color: '#14b8a6', marginBottom: '0.5rem' }}>
                Medico seleccionado
              </div>
              <div style={{ fontSize: '0.9rem', marginBottom: '0.85rem' }}>
                {medicoActivo.nombre}
              </div>

              <div style={{ borderTop: '1px solid #e6f5ff', paddingTop: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#607890', marginBottom: '0.5rem' }}>
                  Slots asignados en el dia:
                </div>
                {getProgramacionesPorMedico(medicoActivo.id).length > 0 ? (
                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    {getProgramacionesPorMedico(medicoActivo.id).map((slot) => (
                      <div key={slot.slot_id} style={{ background: '#e6f5ff', borderRadius: '4px', padding: '0.45rem', fontSize: '0.78rem' }}>
                        <strong>{slot.turno}</strong> | {slot.hora_inicio}-{slot.hora_fin} | Q{slot.quirofano_id}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#68819a', fontSize: '0.8rem' }}>Sin asignaciones para esta fecha.</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          {resultado && (
            <div className={`admin-result ${resultado.success ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
              {resultado.message}
            </div>
          )}

          {TURNOS.map((turno) => {
            const sugerencia = getSugerenciaJineteo(turno.key)

            return (
              <div key={turno.key} style={{
                background: '#ffffff',
                border: '1px solid #e6f5ff',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{turno.nombre}</h3>
                    <div style={{ color: '#68819a', fontSize: '0.85rem' }}>{turno.horario}</div>
                  </div>

                  {sugerencia && (
                    <div style={{
                      background: '#ffa502',
                      color: '#000',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: '700'
                    }}>
                      Jineteo sugiere: {sugerencia.nombre}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.8rem' }}>
                  {turno.bloques.map((bloque) => {
                    const slotsBloque = getSlotsPorBloque(turno.key, bloque)
                    const bloqueFin = slotsBloque[0]?.hora_fin || '--:--'

                    return (
                      <div key={bloque} style={{
                        background: '#f4fbff',
                        border: '2px solid #0a78b5',
                        borderRadius: '8px',
                        padding: '0.8rem'
                      }}>
                        <div style={{ fontWeight: '700', marginBottom: '0.45rem' }}>{bloque} - {bloqueFin}</div>
                        <div style={{ color: '#68819a', fontSize: '0.75rem', marginBottom: '0.6rem' }}>
                          3h cirugia + 1h limpieza
                        </div>

                        <div style={{ display: 'grid', gap: '0.45rem' }}>
                          {slotsBloque.map((slot) => (
                            <div key={slot.slot_id} style={{
                              background: '#e6f5ff',
                              border: `1px solid ${slot.ocupado ? '#ff4757' : '#14b8a6'}`,
                              borderRadius: '6px',
                              padding: '0.5rem'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                                <div>
                                  <strong>Q{slot.quirofano_id}</strong>
                                  <div style={{ fontSize: '0.75rem', color: '#607890' }}>
                                    {slot.ocupado ? slot.medico_nombre : 'Disponible'}
                                  </div>
                                </div>

                                {slot.ocupado ? (
                                  <span style={{ fontSize: '0.72rem', color: '#ff4757', fontWeight: '700' }}>OCUPADO</span>
                                ) : (
                                  <button
                                    onClick={() => handleAsignarSlot(slot)}
                                    disabled={!medicoActivo}
                                    style={{
                                      padding: '0.35rem 0.5rem',
                                      background: medicoActivo ? '#14b8a6' : '#68819a',
                                      color: '#000',
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontWeight: '700',
                                      cursor: medicoActivo ? 'pointer' : 'not-allowed',
                                      fontSize: '0.72rem'
                                    }}
                                  >
                                    Asignar
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
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
