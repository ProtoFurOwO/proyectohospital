import { useState, useEffect, useMemo } from 'react'

const API_PERSONAL = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE : 'http://localhost:8005'

function Horarios() {
  const [slots, setSlots] = useState([])
  const [medicos, setMedicos] = useState([])
  const [turnoActual, setTurnoActual] = useState('manana')
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)

  const getEstadoPortalLabel = (estado) => {
    if (estado === 'asignado_directo') return 'Horario asignado'
    if (estado === 'asignado_admin') return 'Asignado por admin'
    if (estado === 'ajustado_jineteo') return 'Horario ajustado'
    if (estado === 'reprogramado_jineteo') return 'Horario reasignado'
    if (estado === 'reasignado_jineteo') return 'Horario reasignado'
    if (estado === 'rechazado') return 'Sin disponibilidad'
    if (!estado) return 'Sin estado'

    return String(estado)
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  const TURNOS = {
    manana: { nombre: 'Mañana', horario: '08:00 - 16:00', color: '#ffa502' },
    tarde: { nombre: 'Tarde', horario: '16:00 - 00:00', color: '#0a78b5' },
    noche: { nombre: 'Noche', horario: '00:00 - 08:00', color: '#0b8f9b' }
  }

  const BLOQUES_POR_TURNO = {
    manana: ['08:00', '12:00'],
    tarde: ['16:00', '20:00'],
    noche: ['00:00', '04:00']
  }

  const bloquesVisibles = BLOQUES_POR_TURNO[turnoActual] || []

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [turnoActual, fechaSeleccionada])

  const fetchData = async () => {
    try {
      const [slotsRes, medicosRes] = await Promise.all([
        fetch(`${API_PERSONAL}/personal/portal/slots?turno=${turnoActual}&fecha=${fechaSeleccionada}`),
        fetch(`${API_PERSONAL}/personal/medicos?turno=${turnoActual}`)
      ])

      if (slotsRes.ok) {
        const data = await slotsRes.json()
        setSlots(data.slots || [])
      }

      if (medicosRes.ok) {
        const medicosData = await medicosRes.json()
        setMedicos(medicosData)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const slotsOcupados = useMemo(
    () => slots.filter((slot) => slot.ocupado),
    [slots]
  )

  const quirofanosTurno = useMemo(
    () => new Set(slots.map((slot) => slot.quirofano_id)).size,
    [slots]
  )

  const medicosActivos = useMemo(() => {
    const ids = new Set(slotsOcupados.map((slot) => slot.medico_id).filter(Boolean))
    const activos = medicos.filter((item) => ids.has(item.id))
    return activos.length > 0 ? activos : medicos.slice(0, 12)
  }, [medicos, slotsOcupados])

  const getMedicoOperaciones = (medicoId) => (
    slotsOcupados.filter((slot) => slot.medico_id === medicoId).length
  )

  const getSlotsPorBloque = (bloque) => (
    slots.filter((slot) => slot.bloque === bloque)
      .sort((a, b) => a.quirofano_id - b.quirofano_id)
  )

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Cargando horarios...</div>
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
          Gestión de Horarios y Turnos
        </h2>

        <div style={{ marginBottom: '1rem', maxWidth: '280px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: '0.35rem' }}>
            Fecha a visualizar
          </label>
          <input
            type="date"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem',
              background: '#e6f5ff',
              border: '1px solid #0a78b5',
              borderRadius: '6px',
              color: '#1f435f'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          {Object.entries(TURNOS).map(([key, turno]) => (
            <button
              key={key}
              onClick={() => setTurnoActual(key)}
              style={{
                padding: '1rem 2rem',
                background: turnoActual === key ? turno.color : '#ffffff',
                border: `2px solid ${turno.color}`,
                borderRadius: '8px',
                color: turnoActual === key ? '#fff' : '#1f435f',
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

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #e6f5ff' }}>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Médicos en turno</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#14b8a6' }}>{medicosActivos.length}</div>
        </div>

        <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #e6f5ff' }}>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Bloques ocupados</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0a78b5' }}>{slotsOcupados.length}</div>
        </div>

        <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #e6f5ff' }}>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Slots libres</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ffa502' }}>{slots.length - slotsOcupados.length}</div>
        </div>

        <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #e6f5ff' }}>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Quirofanos del turno</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0b8f9b' }}>{quirofanosTurno}</div>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', color: '#0a78b5' }}>
          Médicos del turno
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '1rem'
        }}>
          {medicosActivos.slice(0, 12).map((medico) => {
            const operaciones = getMedicoOperaciones(medico.id)
            const disponible = medico.disponible && medico.operaciones_hoy < 2

            return (
              <div key={medico.id} style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: '8px',
                border: `2px solid ${disponible ? '#14b8a6' : '#666'}`,
                opacity: disponible ? 1 : 0.6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '600' }}>{medico.nombre}</span>
                  {disponible && <span style={{ color: '#14b8a6', fontSize: '0.8rem' }}>✓</span>}
                </div>
                <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{medico.especialidad}</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{
                    background: medico.operaciones_hoy === 0 ? '#14b8a6' : medico.operaciones_hoy === 1 ? '#ffa502' : '#ff4757',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: '#000',
                    fontWeight: '600'
                  }}>
                    {medico.operaciones_hoy}/2 ops
                  </div>
                  <div style={{ color: '#666', fontSize: '0.75rem' }}>{operaciones} programadas</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', color: '#0a78b5' }}>
          Bloques de cirugias (4 horas cada uno, 5 quirofanos por bloque)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {bloquesVisibles.map((bloque) => {
            const slotsBloque = getSlotsPorBloque(bloque)
            const horaFin = slotsBloque[0]?.hora_fin || '--:--'
            const ocupados = slotsBloque.filter((slot) => slot.ocupado)

            return (
              <div key={bloque} style={{
                background: '#ffffff',
                border: '1px solid #e6f5ff',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>{bloque} - {horaFin}</span>
                    <span style={{ color: '#888', marginLeft: '1rem', fontSize: '0.85rem' }}>(3h cirugía + 1h limpieza)</span>
                  </div>
                  <span style={{
                    background: ocupados.length > 0 ? '#0a78b5' : '#e6f5ff',
                    color: ocupados.length > 0 ? '#fff' : '#1f435f',
                    padding: '0.25rem 1rem',
                    borderRadius: '20px',
                    fontSize: '0.85rem'
                  }}>
                    {ocupados.length} ocupados
                  </span>
                </div>

                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {slotsBloque.map((slot) => (
                    <div key={slot.slot_id} style={{
                      background: '#e6f5ff',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: slot.ocupado ? '1px solid #0a78b5' : '1px dashed #68819a'
                    }}>
                      <div>
                        <div style={{ fontWeight: '600' }}>
                          {slot.ocupado ? slot.medico_nombre : 'Disponible'}
                        </div>
                        <div style={{ color: '#888', fontSize: '0.85rem' }}>
                          {slot.ocupado ? `${slot.especialidad || 'General'} - ${getEstadoPortalLabel(slot.estado)}` : 'Sin asignacion'}
                        </div>
                        <div style={{ color: '#9aa', fontSize: '0.75rem' }}>
                          Fuente: {slot.source === 'admin' ? 'Asignacion admin' : 'Portal doctor'}
                        </div>
                      </div>
                      <div style={{
                        background: slot.ocupado ? '#0a78b5' : '#68819a',
                        color: '#fff',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        Q#{slot.quirofano_id}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Horarios
