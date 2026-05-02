import { useEffect, useMemo, useState } from 'react'

import { API } from '../config'
const API_CITAS = API.citas
const API_EXPEDIENTES = API.expedientes

const todayISO = () => new Date().toISOString().slice(0, 10)

const buildInitialForm = () => ({
  expediente_id: '',
  numero_expediente_clinico: '',
  paciente_id: '',
  paciente_nombre: '',
  fecha_cita: todayISO(),
  hora_cita: '08:00',
  tipo_cirugia: 'Valoracion inicial'
})

const formatTurno = (turno) => {
  if (turno === 'manana') return 'Manana'
  if (turno === 'tarde') return 'Tarde'
  if (turno === 'noche') return 'Noche'
  return turno || 'Sin turno'
}

const extractDate = (value) => {
  if (!value) return ''
  return String(value).split('T')[0]
}

function CitasAdmin() {
  const [citas, setCitas] = useState([])
  const [catalogos, setCatalogos] = useState(null)
  const [expedientes, setExpedientes] = useState([])
  const [form, setForm] = useState(() => buildInitialForm())
  const [resultado, setResultado] = useState(null)
  const [filtroFecha, setFiltroFecha] = useState(todayISO())
  const [filtroTurno, setFiltroTurno] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargarCatalogos = async () => {
    const requests = await Promise.allSettled([
      fetch(`${API_CITAS}/citas/catalogos`),
      fetch(`${API_EXPEDIENTES}/expedientes`)
    ])

    try {
      if (requests[0].status === 'fulfilled' && requests[0].value.ok) {
        setCatalogos(await requests[0].value.json())
      }

      if (requests[1].status === 'fulfilled' && requests[1].value.ok) {
        setExpedientes(await requests[1].value.json())
      }
    } catch (error) {
      setResultado({ success: false, message: 'No se pudieron cargar los catalogos.' })
    }
  }

  const cargarCitas = async () => {
    try {
      const params = new URLSearchParams()
      if (filtroFecha) params.set('fecha', filtroFecha)
      if (filtroTurno !== 'todos') params.set('turno', filtroTurno)

      const response = await fetch(`${API_CITAS}/citas?${params.toString()}`)
      if (response.ok) {
        setCitas(await response.json())
      }
    } catch (error) {
      setResultado({ success: false, message: 'No se pudo cargar la agenda de citas.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarCatalogos()
  }, [])

  useEffect(() => {
    cargarCitas()
    const interval = setInterval(cargarCitas, 8000)
    return () => clearInterval(interval)
  }, [filtroFecha, filtroTurno])

  const onFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const onExpedienteSelect = (value) => {
    if (!value) {
      setForm((prev) => ({
        ...buildInitialForm(),
        fecha_cita: prev.fecha_cita,
        hora_cita: prev.hora_cita,
        paciente_nombre: prev.paciente_nombre
      }))
      return
    }

    const expediente = expedientes.find((item) => String(item.id) === String(value))
    if (!expediente) return

    setForm((prev) => ({
      ...prev,
      expediente_id: String(expediente.id),
      numero_expediente_clinico: expediente.numero_expediente_clinico || '',
      paciente_id: String(expediente.paciente_id || ''),
      paciente_nombre: expediente.nombre || prev.paciente_nombre,
      tipo_cirugia: expediente.diagnostico_preoperatorio || prev.tipo_cirugia
    }))
  }

  const buildFechaCitaISO = () => `${form.fecha_cita}T${form.hora_cita}:00`

  const programarCita = async () => {
    if (!form.paciente_nombre.trim() || !form.fecha_cita || !form.hora_cita) {
      setResultado({ success: false, message: 'Completa nombre del paciente, fecha y hora.' })
      return
    }

    setGuardando(true)
    setResultado(null)

    const payload = {
      paciente_id: form.paciente_id ? Number(form.paciente_id) : null,
      paciente_nombre: form.paciente_nombre.trim(),
      numero_expediente_clinico: form.numero_expediente_clinico || null,
      medico_id: null,
      medico_nombre: null,
      fecha_cita: buildFechaCitaISO(),
      tipo_cirugia: form.tipo_cirugia.trim() || 'Valoracion inicial',
      turno: null,
      division_quirurgica: null,
      complejidad_evento: null,
      urgencia_intervencion: null,
      responsable_anestesia: null,
      es_urgencia: false,
      requiere_expediente: !!form.expediente_id
    }

    try {
      const response = await fetch(`${API_CITAS}/citas/programar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        setResultado({ success: false, message: data.detail || 'No se pudo programar la cita.' })
        return
      }

      const warning = data.warning ? ` Aviso: ${data.warning}` : ''
      setResultado({
        success: true,
        message: `Cita creada. ID ${data.data.id}. Paciente ID: ${data.data.paciente_id}.${warning}`
      })
      setForm((prev) => ({
        ...buildInitialForm(),
        fecha_cita: prev.fecha_cita,
        hora_cita: prev.hora_cita
      }))
      await cargarCitas()
    } catch (error) {
      setResultado({ success: false, message: 'Error de conexion con servicio de citas.' })
    } finally {
      setGuardando(false)
    }
  }

  const cancelarCita = async (citaId) => {
    try {
      const response = await fetch(`${API_CITAS}/citas/${citaId}/cancelar`, { method: 'POST' })
      if (response.ok) {
        await cargarCitas()
      }
    } catch (error) {
      setResultado({ success: false, message: 'No se pudo cancelar la cita.' })
    }
  }

  const turnos = catalogos?.turnos || ['manana', 'tarde', 'noche']

  const citasOrdenadas = useMemo(
    () => [...citas].sort((a, b) => new Date(a.fecha_cita) - new Date(b.fecha_cita)),
    [citas]
  )

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando citas...</div>
  }

  return (
    <div>
      <h2 style={{ marginBottom: '0.75rem', fontSize: '1.5rem' }}>Citas Admin</h2>
      <p style={{ color: '#888', marginBottom: '1.25rem' }}>
        Paso 1: captura rapida de cita. Sin expediente previo, el sistema asigna automaticamente el ID de paciente.
      </p>

      <div className="admin-layout-grid">
        <section className="admin-card">
          <h3 className="admin-card-title">Programar cita</h3>

          <div className="admin-form-grid">
            <div>
              <label className="admin-label">Expediente existente (opcional)</label>
              <select
                className="sql-input admin-field"
                value={form.expediente_id}
                onChange={(e) => onExpedienteSelect(e.target.value)}
              >
                <option value="">Sin expediente previo</option>
                {expedientes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.numero_expediente_clinico} - {item.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-grid-2">
              <input
                type="text"
                placeholder="Nombre del paciente"
                value={form.paciente_nombre}
                onChange={(e) => onFieldChange('paciente_nombre', e.target.value)}
                className="sql-input admin-field"
              />

              <input
                type="text"
                value={form.paciente_id || 'Se asignara automaticamente'}
                readOnly
                className="sql-input admin-field"
              />
            </div>

            <div className="admin-grid-2">
              <input
                type="date"
                value={form.fecha_cita}
                onChange={(e) => onFieldChange('fecha_cita', e.target.value)}
                className="sql-input admin-field"
              />
              <input
                type="time"
                value={form.hora_cita}
                onChange={(e) => onFieldChange('hora_cita', e.target.value)}
                className="sql-input admin-field"
              />
            </div>

            <input
              type="text"
              placeholder="Tipo de cirugia inicial (opcional)"
              value={form.tipo_cirugia}
              onChange={(e) => onFieldChange('tipo_cirugia', e.target.value)}
              className="sql-input admin-field"
            />

            <button className="btn btn-success admin-main-button" onClick={programarCita} disabled={guardando}>
              {guardando ? 'Programando...' : 'Programar cita'}
            </button>

            {resultado && (
              <div className={`admin-result ${resultado.success ? 'success' : 'error'}`}>{resultado.message}</div>
            )}
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-toolbar">
            <h3 className="admin-card-title" style={{ marginBottom: 0 }}>
              Agenda de citas
            </h3>

            <div className="admin-toolbar-right">
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="sql-input admin-field"
                style={{ width: '170px' }}
              />
              <div className="admin-field-group" style={{ minWidth: '150px' }}>
                <label className="admin-label" style={{ marginBottom: '0.2rem' }}>Turno</label>
                <select
                  value={filtroTurno}
                  onChange={(e) => setFiltroTurno(e.target.value)}
                  className="sql-input admin-field"
                  style={{ width: '150px' }}
                >
                  <option value="todos">Todos</option>
                  {turnos.map((item) => (
                    <option key={item} value={item}>
                      {formatTurno(item)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="admin-list-scroll">
            {citasOrdenadas.map((cita) => (
              <div key={cita.id} style={{ background: '#e6f5ff', borderRadius: '8px', padding: '0.75rem' }}>
                <div className="admin-toolbar">
                  <div style={{ fontWeight: 700 }}>
                    Cita #{cita.id} - {new Date(cita.fecha_cita).toLocaleString('es-MX')}
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                    <span
                      style={{
                        background: cita.estado === 'programada' ? '#14b8a6' : '#ff4757',
                        color: '#000',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: 700
                      }}
                    >
                      {cita.estado}
                    </span>
                    {cita.estado === 'programada' && (
                      <button className="btn btn-danger" onClick={() => cancelarCita(cita.id)}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ color: '#1f435f', fontSize: '0.88rem' }}>
                  Paciente: {cita.paciente_nombre} (ID {cita.paciente_id})
                </div>
                <div style={{ color: '#1f435f', fontSize: '0.88rem' }}>
                  Cirujano: {cita.medico_nombre || 'Por asignar en Expedientes'} {cita.medico_id ? `(ID ${cita.medico_id})` : ''}
                </div>
                <div style={{ color: '#5e7791', fontSize: '0.84rem' }}>
                  Expediente: {cita.numero_expediente_clinico || 'Sin expediente'} | Turno: {formatTurno(cita.turno)}
                </div>
                <div style={{ color: '#5e7791', fontSize: '0.84rem' }}>
                  Tipo de cirugia: {cita.tipo_cirugia || 'Valoracion inicial'} | Quirofano: {cita.quirofano_id ? `Q${cita.quirofano_id}` : 'Pendiente'}
                </div>
                <div style={{ color: '#6d87a2', fontSize: '0.8rem' }}>
                  Fecha base: {extractDate(cita.fecha_cita)} | Flujo: {cita.origen_programacion || 'legacy'}
                </div>
                <div style={{ color: '#6d87a2', fontSize: '0.8rem' }}>
                  Requiere expediente: {cita.requiere_expediente ? 'Si' : 'No'}
                </div>
              </div>
            ))}

            {citasOrdenadas.length === 0 && (
              <div style={{ color: '#777', textAlign: 'center', padding: '1rem' }}>
                Sin citas para ese filtro.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default CitasAdmin
