import { useEffect, useMemo, useState } from 'react'

const API_PERSONAL = 'http://localhost:8005'

const TURNOS = [
  { key: 'manana', nombre: 'Manana' },
  { key: 'tarde', nombre: 'Tarde' },
  { key: 'noche', nombre: 'Noche' }
]

function DoctorPortal() {
  const [medicos, setMedicos] = useState([])
  const [medicoId, setMedicoId] = useState('')
  const [resumen, setResumen] = useState(null)
  const [historial, setHistorial] = useState([])
  const [disponibilidad, setDisponibilidad] = useState(null)
  const [turnoDeseado, setTurnoDeseado] = useState('manana')
  const [fechaDeseada, setFechaDeseada] = useState(() => new Date().toISOString().slice(0, 10))
  const [quirofanoId, setQuirofanoId] = useState('')
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const medicoSeleccionado = useMemo(
    () => medicos.find((m) => String(m.id) === String(medicoId)) || null,
    [medicos, medicoId]
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

  useEffect(() => {
    cargarCatalogos()
  }, [])

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

  useEffect(() => {
    if (medicoSeleccionado) {
      setTurnoDeseado(medicoSeleccionado.turno)
    }
  }, [medicoSeleccionado])

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
          quirofano_id: quirofanoId ? Number(quirofanoId) : null
        })
      })

      const data = await response.json()
      setResultado(data)

      await Promise.all([
        cargarCatalogos(),
        cargarResumenMedico(medicoId)
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
    if (estado === 'asignado_directo') return '#00ff88'
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
        El doctor solicita su turno. Si no hay cupo ese dia, el sistema lo reprograma para otro dia, pero siempre con el mismo doctor.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1rem' }}>
        <section style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px', padding: '1rem' }}>
          <h3 style={{ color: '#3742fa', marginBottom: '0.75rem' }}>Identificacion</h3>

          <select
            value={medicoId}
            onChange={(e) => setMedicoId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              background: '#0f3460',
              border: '1px solid #3742fa',
              borderRadius: '6px',
              color: '#fff',
              marginBottom: '0.75rem'
            }}
          >
            <option value="">Selecciona tu perfil de doctor...</option>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.id} - {m.nombre} ({m.turno})
              </option>
            ))}
          </select>

          {medicoSeleccionado && (
            <div style={{ background: '#0f3460', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ marginBottom: '0.35rem', fontWeight: '600' }}>{medicoSeleccionado.nombre}</div>
              <div style={{ color: '#9aa' }}>Especialidad: {medicoSeleccionado.especialidad}</div>
              <div style={{ color: '#9aa' }}>Turno actual: {medicoSeleccionado.turno}</div>
              <div style={{ color: '#9aa' }}>Operaciones hoy: {medicoSeleccionado.operaciones_hoy}/{medicoSeleccionado.max_operaciones}</div>
              <div style={{ color: medicoSeleccionado.disponible ? '#00ff88' : '#ff4757', marginTop: '0.35rem' }}>
                {medicoSeleccionado.disponible ? 'Disponible' : 'Sin disponibilidad hoy'}
              </div>
            </div>
          )}
        </section>

        <section style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px', padding: '1rem' }}>
          <h3 style={{ color: '#3742fa', marginBottom: '0.75rem' }}>Solicitar turno</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.3rem' }}>Turno deseado</label>
              <select
                value={turnoDeseado}
                onChange={(e) => setTurnoDeseado(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#0f3460',
                  border: '1px solid #3742fa',
                  borderRadius: '6px',
                  color: '#fff'
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
                  background: '#0f3460',
                  border: '1px solid #3742fa',
                  borderRadius: '6px',
                  color: '#fff'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.3rem' }}>Quirofano (opcional)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={quirofanoId}
                onChange={(e) => setQuirofanoId(e.target.value)}
                placeholder="Ej: 7"
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#0f3460',
                  border: '1px solid #3742fa',
                  borderRadius: '6px',
                  color: '#fff'
                }}
              />
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
                background: resultado.success ? 'rgba(0,255,136,0.08)' : 'rgba(255,71,87,0.08)'
              }}
            >
              <div style={{ marginBottom: '0.45rem', fontWeight: '700', color: getEstadoBadgeColor(resultado.estado) }}>
                Estado: {resultado.estado}
              </div>
              <div style={{ color: '#d7dbe2' }}>{resultado.message}</div>
              {resultado.medico_asignado && (
                <div style={{ marginTop: '0.45rem', fontSize: '0.9rem', color: '#9fb3ff' }}>
                  Asignado: {resultado.medico_asignado.nombre} ({resultado.medico_asignado.especialidad})
                </div>
              )}
              {resultado.fecha_solicitada && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#8ea3d1' }}>
                  Fecha solicitada: {resultado.fecha_solicitada}
                </div>
              )}
              {resultado.fecha_asignada && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#8ea3d1' }}>
                  Fecha asignada: {resultado.fecha_asignada}
                </div>
              )}
              {resultado.turno_final && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#8ea3d1' }}>
                  Turno final aplicado: {resultado.turno_final}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem', color: '#9fb3ff' }}>Disponibilidad por turno</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
              {disponibilidad && Object.entries(disponibilidad.turnos || {}).map(([turno, info]) => (
                <div key={turno} style={{ background: '#0f3460', borderRadius: '8px', padding: '0.7rem' }}>
                  <div style={{ fontWeight: '700', marginBottom: '0.3rem' }}>{turno}</div>
                  <div style={{ fontSize: '0.85rem', color: '#b7c2d8' }}>Disponibles: {info.disponibles}</div>
                  <div style={{ fontSize: '0.85rem', color: '#7f8aa2' }}>Total: {info.total_medicos}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section style={{ marginTop: '1rem', background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px', padding: '1rem' }}>
        <h3 style={{ color: '#3742fa', marginBottom: '0.75rem' }}>Historial del doctor</h3>

        {!medicoId && <div style={{ color: '#777' }}>Selecciona un doctor para ver su historial.</div>}

        {medicoId && historial.length === 0 && (
          <div style={{ color: '#777' }}>Sin solicitudes registradas todavia.</div>
        )}

        {medicoId && historial.length > 0 && (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {historial.map((item) => (
              <div key={item.id} style={{ background: '#0f3460', borderRadius: '8px', padding: '0.75rem' }}>
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
                    {item.estado}
                  </span>
                </div>
                <div style={{ color: '#b8c2d8', fontSize: '0.88rem' }}>Turno solicitado: {item.turno_solicitado}</div>
                <div style={{ color: '#b8c2d8', fontSize: '0.88rem' }}>Turno final: {item.turno_final || item.turno_solicitado}</div>
                <div style={{ color: '#b8c2d8', fontSize: '0.88rem' }}>Fecha solicitada: {item.fecha_solicitada || 'N/A'}</div>
                <div style={{ color: '#b8c2d8', fontSize: '0.88rem' }}>Fecha asignada: {item.fecha_asignada || 'Pendiente'}</div>
                <div style={{ color: '#b8c2d8', fontSize: '0.88rem' }}>Asignado: {item.medico_asignado_nombre || 'Ninguno'}</div>
                <div style={{ color: '#8b96ae', fontSize: '0.8rem', marginTop: '0.2rem' }}>{item.motivo}</div>
              </div>
            ))}
          </div>
        )}

        {medicoId && resumen && (
          <div style={{ marginTop: '0.9rem', color: '#8b96ae', fontSize: '0.85rem' }}>
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
