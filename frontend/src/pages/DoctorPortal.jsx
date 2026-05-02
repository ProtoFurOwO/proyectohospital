import { useEffect, useMemo, useState } from 'react'

import { API } from '../config'
const API_PERSONAL = API.personal

const TURNOS = [
  { key: 'manana', nombre: 'Manana' },
  { key: 'tarde', nombre: 'Tarde' },
  { key: 'noche', nombre: 'Noche' }
]

const BLOQUES_POR_TURNO = {
  manana: ['08:00', '12:00'],
  tarde: ['16:00', '20:00'],
  noche: ['00:00', '04:00']
}

const getEstadoLabel = (estado) => {
  if (estado === 'asignado_directo') return 'Horario asignado'
  if (estado === 'asignado_admin') return 'Asignado por admin'
  if (estado === 'ajustado_jineteo') return 'Horario ajustado'
  if (estado === 'reprogramado_jineteo') return 'Horario reasignado'
  if (estado === 'reasignado_jineteo') return 'Horario reasignado'
  if (estado === 'rechazado') return 'Sin disponibilidad'
  if (estado === 'error_conexion') return 'Error de conexion'
  if (!estado) return 'Sin estado'

  return String(estado)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function DoctorPortal() {
  const [medicos, setMedicos] = useState([])
  const [medicoId, setMedicoId] = useState('')
  const [resumen, setResumen] = useState(null)
  const [historial, setHistorial] = useState([])
  const [disponibilidad, setDisponibilidad] = useState(null)
  const [slotsTurno, setSlotsTurno] = useState([])
  const [turnoDeseado, setTurnoDeseado] = useState('manana')
  const [fechaDeseada, setFechaDeseada] = useState(() => new Date().toISOString().slice(0, 10))
  const [bloqueDeseado, setBloqueDeseado] = useState('08:00')
  const [quirofanoId, setQuirofanoId] = useState('')
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const medicoSeleccionado = useMemo(
    () => medicos.find((m) => String(m.id) === String(medicoId)) || null,
    [medicos, medicoId]
  )

  const bloquesTurnoActivo = BLOQUES_POR_TURNO[turnoDeseado] || []

  const resumenBloques = useMemo(
    () => bloquesTurnoActivo.map((bloque) => {
      const slotsBloque = slotsTurno.filter((slot) => slot.bloque === bloque)
      const ocupados = slotsBloque.filter((slot) => slot.ocupado).length
      return {
        bloque,
        total: slotsBloque.length,
        ocupados,
        libres: slotsBloque.length - ocupados
      }
    }),
    [bloquesTurnoActivo, slotsTurno]
  )

  const quirofanosBloqueActivo = useMemo(
    () => slotsTurno
      .filter((slot) => slot.bloque === bloqueDeseado)
      .map((slot) => slot.quirofano_id)
      .sort((a, b) => a - b),
    [slotsTurno, bloqueDeseado]
  )

  const cargarCatalogos = async () => {
    try {
      const [medicosRes, disponibilidadRes] = await Promise.all([
        fetch(`${API_PERSONAL}/personal/medicos`),
        fetch(`${API_PERSONAL}/personal/portal/disponibilidad-turnos`)
      ])

      if (medicosRes.ok) {
        const medicosData = await medicosRes.json()
        setMedicos(medicosData)
      }

      if (disponibilidadRes.ok) {
        setDisponibilidad(await disponibilidadRes.json())
      }
    } catch (error) {
      console.error('Error cargando catalogos:', error)
    } finally {
      setLoading(false)
    }
  }

  const cargarResumenMedico = async (id) => {
    if (!id) return

    try {
      const [resumenRes, historialRes] = await Promise.all([
        fetch(`${API_PERSONAL}/personal/portal/medico/${id}/resumen`),
        fetch(`${API_PERSONAL}/personal/portal/solicitudes?medico_id=${id}&limit=10`)
      ])

      if (resumenRes.ok) {
        const resumenData = await resumenRes.json()
        setResumen(resumenData)
      }

      if (historialRes.ok) {
        const historialData = await historialRes.json()
        setHistorial(historialData.solicitudes || [])
      }
    } catch (error) {
      console.error('Error cargando resumen:', error)
    }
  }

  const cargarSlotsTurno = async (fecha, turno) => {
    try {
      const response = await fetch(`${API_PERSONAL}/personal/portal/slots?fecha=${fecha}&turno=${turno}`)
      if (!response.ok) return

      const data = await response.json()
      setSlotsTurno(data.slots || [])
    } catch (error) {
      console.error('Error cargando slots:', error)
    }
  }

  useEffect(() => {
    cargarCatalogos()
  }, [])

  useEffect(() => {
    const bloques = BLOQUES_POR_TURNO[turnoDeseado] || []
    if (!bloques.includes(bloqueDeseado)) {
      setBloqueDeseado(bloques[0] || '')
    }
  }, [turnoDeseado, bloqueDeseado])

  useEffect(() => {
    if (quirofanoId && !quirofanosBloqueActivo.includes(Number(quirofanoId))) {
      setQuirofanoId('')
    }
  }, [quirofanoId, quirofanosBloqueActivo])

  useEffect(() => {
    cargarSlotsTurno(fechaDeseada, turnoDeseado)
  }, [fechaDeseada, turnoDeseado])

  useEffect(() => {
    if (!medicoId) {
      setResumen(null)
      setHistorial([])
      return
    }

    cargarResumenMedico(medicoId)
    const interval = setInterval(() => cargarResumenMedico(medicoId), 7000)
    return () => clearInterval(interval)
  }, [medicoId])

  const solicitarTurno = async () => {
    if (!medicoId) {
      alert('Selecciona un doctor primero')
      return
    }

    setEnviando(true)
    setResultado(null)

    try {
      const response = await fetch(`${API_PERSONAL}/personal/portal/solicitar-turno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medico_id: Number(medicoId),
          turno_deseado: turnoDeseado,
          fecha_deseada: fechaDeseada,
          bloque_deseado: bloqueDeseado,
          quirofano_id: quirofanoId ? Number(quirofanoId) : null,
          origen: 'portal'
        })
      })

      const data = await response.json()
      setResultado(data)

      await Promise.all([
        cargarCatalogos(),
        cargarResumenMedico(medicoId),
        cargarSlotsTurno(fechaDeseada, turnoDeseado)
      ])
    } catch (error) {
      setResultado({
        success: false,
        estado: 'error_conexion',
        message: 'No se pudo conectar con el servicio de personal.'
      })
    } finally {
      setEnviando(false)
    }
  }

  const getEstadoBadgeColor = (estado) => {
    if (estado === 'asignado_directo') return '#14b8a6'
    if (estado === 'asignado_admin') return '#14b8a6'
    if (estado === 'ajustado_jineteo') return '#ffa502'
    if (estado === 'reprogramado_jineteo') return '#ffa502'
    if (estado === 'reasignado_jineteo') return '#ffa502'
    if (estado === 'rechazado') return '#ff4757'
    return '#666'
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando portal de doctores...</div>
  }

  return (
    <div>
      <h2 style={{ marginBottom: '0.75rem', fontSize: '1.5rem' }}>Portal de Doctores</h2>
      <p style={{ color: '#888', marginBottom: '1.25rem' }}>
        Asignacion demo estricta: 30 quirofanos (10 por turno, 5 por bloque), en la fecha exacta solicitada.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1rem' }}>
        <section style={{ background: '#ffffff', border: '1px solid #e6f5ff', borderRadius: '10px', padding: '1rem' }}>
          <h3 style={{ color: '#0a78b5', marginBottom: '0.75rem' }}>Identificacion</h3>

          <select
            value={medicoId}
            onChange={(e) => setMedicoId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              background: '#e6f5ff',
              border: '1px solid #0a78b5',
              borderRadius: '6px',
              color: '#1f435f',
              marginBottom: '0.75rem'
            }}
          >
            <option value="">Selecciona tu perfil de doctor...</option>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.id} - {m.nombre}
              </option>
            ))}
          </select>

          {medicoSeleccionado && (
            <div style={{ background: '#e6f5ff', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ marginBottom: '0.35rem', fontWeight: '600' }}>{medicoSeleccionado.nombre}</div>
              <div style={{ color: '#9aa' }}>Especialidad: {medicoSeleccionado.especialidad}</div>
              <div style={{ color: '#9aa' }}>Operaciones hoy: {medicoSeleccionado.operaciones_hoy}/{medicoSeleccionado.max_operaciones}</div>
              <div style={{ color: medicoSeleccionado.disponible ? '#14b8a6' : '#ff4757', marginTop: '0.35rem' }}>
                {medicoSeleccionado.disponible ? 'Disponible' : 'Sin disponibilidad hoy'}
              </div>
            </div>
          )}
        </section>

        <section style={{ background: '#ffffff', border: '1px solid #e6f5ff', borderRadius: '10px', padding: '1rem' }}>
          <h3 style={{ color: '#0a78b5', marginBottom: '0.75rem' }}>Solicitar turno</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.3rem' }}>Turno deseado</label>
              <select
                value={turnoDeseado}
                onChange={(e) => setTurnoDeseado(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#e6f5ff',
                  border: '1px solid #0a78b5',
                  borderRadius: '6px',
                  color: '#1f435f'
                }}
              >
                {TURNOS.map((turno) => (
                  <option key={turno.key} value={turno.key}>{turno.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.3rem' }}>Fecha deseada</label>
              <input
                type="date"
                value={fechaDeseada}
                onChange={(e) => setFechaDeseada(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#e6f5ff',
                  border: '1px solid #0a78b5',
                  borderRadius: '6px',
                  color: '#1f435f'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.3rem' }}>Bloque</label>
              <select
                value={bloqueDeseado}
                onChange={(e) => setBloqueDeseado(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#e6f5ff',
                  border: '1px solid #0a78b5',
                  borderRadius: '6px',
                  color: '#1f435f'
                }}
              >
                {bloquesTurnoActivo.map((bloque) => (
                  <option key={bloque} value={bloque}>{bloque}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.3rem' }}>Quirofano del bloque (opcional)</label>
              <select
                value={quirofanoId}
                onChange={(e) => setQuirofanoId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#e6f5ff',
                  border: '1px solid #0a78b5',
                  borderRadius: '6px',
                  color: '#1f435f'
                }}
              >
                <option value="">Autoasignar</option>
                {quirofanosBloqueActivo.map((id) => (
                  <option key={id} value={id}>Q{id}</option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-success"
              onClick={solicitarTurno}
              disabled={enviando || !medicoId}
              style={{ height: '39px', fontWeight: '700', width: '100%' }}
            >
              {enviando ? 'Enviando...' : 'Solicitar'}
            </button>
          </div>

          {resultado && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.9rem',
                borderRadius: '8px',
                border: `1px solid ${getEstadoBadgeColor(resultado.estado)}`,
                background: resultado.success ? 'rgba(20,184,166,0.12)' : 'rgba(255,71,87,0.08)'
              }}
            >
              <div style={{ marginBottom: '0.45rem', fontWeight: '700', color: getEstadoBadgeColor(resultado.estado) }}>
                Estado: {getEstadoLabel(resultado.estado)}
              </div>
              <div style={{ color: '#36546f' }}>{resultado.message}</div>
              {resultado.medico_asignado && (
                <div style={{ marginTop: '0.45rem', fontSize: '0.9rem', color: '#6d8cb0' }}>
                  Asignado: {resultado.medico_asignado.nombre} ({resultado.medico_asignado.especialidad})
                </div>
              )}
              {resultado.fecha_solicitada && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#6d87a2' }}>
                  Fecha solicitada: {resultado.fecha_solicitada}
                </div>
              )}
              {resultado.fecha_asignada && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#6d87a2' }}>
                  Fecha asignada: {resultado.fecha_asignada}
                </div>
              )}
              {resultado.turno_final && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#6d87a2' }}>
                  Turno final aplicado: {resultado.turno_final}
                </div>
              )}
              {resultado.bloque_final && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#6d87a2' }}>
                  Bloque: {resultado.bloque_final} ({resultado.hora_inicio}-{resultado.hora_fin})
                </div>
              )}
              {resultado.quirofano_id_final && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#6d87a2' }}>
                  Quirofano asignado: Q{resultado.quirofano_id_final}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem', color: '#6d8cb0' }}>Disponibilidad del turno por bloque</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
              {resumenBloques.map((item) => (
                <div key={item.bloque} style={{ background: '#e6f5ff', borderRadius: '8px', padding: '0.7rem' }}>
                  <div style={{ fontWeight: '700', marginBottom: '0.3rem' }}>{item.bloque}</div>
                  <div style={{ fontSize: '0.85rem', color: '#5e7791' }}>Libres: {item.libres}</div>
                  <div style={{ fontSize: '0.85rem', color: '#607890' }}>Ocupados: {item.ocupados}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '0.8rem', fontSize: '0.82rem', color: '#6d87a2' }}>
              Disponibilidad general: {disponibilidad?.turnos?.[turnoDeseado]?.disponibles ?? 0} medicos en turno.
            </div>
          </div>
        </section>
      </div>

      <section style={{ marginTop: '1rem', background: '#ffffff', border: '1px solid #e6f5ff', borderRadius: '10px', padding: '1rem' }}>
        <h3 style={{ color: '#0a78b5', marginBottom: '0.75rem' }}>Historial del doctor</h3>

        {!medicoId && <div style={{ color: '#777' }}>Selecciona un doctor para ver su historial.</div>}

        {medicoId && historial.length === 0 && (
          <div style={{ color: '#777' }}>Sin solicitudes registradas todavia.</div>
        )}

        {medicoId && historial.length > 0 && (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {historial.map((item) => (
              <div key={item.id} style={{ background: '#e6f5ff', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <strong>Solicitud #{item.id}</strong>
                  <span style={{
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    background: getEstadoBadgeColor(item.estado),
                    color: '#000',
                    fontSize: '0.75rem',
                    fontWeight: '700'
                  }}>
                    {getEstadoLabel(item.estado)}
                  </span>
                </div>
                <div style={{ color: '#5e7791', fontSize: '0.88rem' }}>Turno solicitado: {item.turno_solicitado}</div>
                <div style={{ color: '#5e7791', fontSize: '0.88rem' }}>Turno final: {item.turno_final || item.turno_solicitado}</div>
                <div style={{ color: '#5e7791', fontSize: '0.88rem' }}>Bloque: {item.bloque || 'N/A'}</div>
                <div style={{ color: '#5e7791', fontSize: '0.88rem' }}>Fecha solicitada: {item.fecha_solicitada || 'N/A'}</div>
                <div style={{ color: '#5e7791', fontSize: '0.88rem' }}>Fecha asignada: {item.fecha_asignada || 'Pendiente'}</div>
                <div style={{ color: '#5e7791', fontSize: '0.88rem' }}>Asignado: {item.medico_asignado_nombre || 'Ninguno'}</div>
                <div style={{ color: '#5e7791', fontSize: '0.88rem' }}>Quirofano: {item.quirofano_id ? `Q${item.quirofano_id}` : 'N/A'}</div>
                <div style={{ color: '#68819a', fontSize: '0.8rem', marginTop: '0.2rem' }}>{item.motivo}</div>
              </div>
            ))}
          </div>
        )}

        {medicoId && resumen && (
          <div style={{ marginTop: '0.9rem', color: '#68819a', fontSize: '0.85rem' }}>
            Estado actual: {resumen.puede_operar_hoy ? 'Puede operar hoy' : 'Sin disponibilidad hoy'} |
            {' '}Operaciones: {resumen.operaciones_hoy}/{resumen.max_operaciones} |
            {' '}Dias sin operar: {resumen.dias_sin_operar}
          </div>
        )}
      </section>
    </div>
  )
}

export default DoctorPortal
