import { useEffect, useMemo, useState } from 'react'

const API_CITAS = 'http://localhost:8001'
const API_EXPEDIENTES = 'http://localhost:8002'
const API_PERSONAL = 'http://localhost:8005'

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()

const medicoCompatibleConDivision = (medico, division) => {
  const divisionNorm = normalizeText(division)
  const especialidadNorm = normalizeText(medico?.especialidad)

  if (!divisionNorm) return true

  if (divisionNorm.includes('traumatologia')) return especialidadNorm.includes('traumatologia')
  if (divisionNorm.includes('neurologia')) return especialidadNorm.includes('neurologia')
  if (divisionNorm.includes('pediatria')) return especialidadNorm.includes('pediatria')
  if (divisionNorm.includes('cardiologia')) return especialidadNorm.includes('cardiologia')
  if (divisionNorm.includes('oftalmologia')) return especialidadNorm.includes('oftalmologia')
  if (divisionNorm.includes('oncologia')) return especialidadNorm.includes('oncologia')

  return true
}

const todayISO = () => new Date().toISOString().slice(0, 10)

const buildInitialForm = () => ({
  expediente_id: '',
  numero_expediente_clinico: '',
  paciente_id: '',
  paciente_nombre: '',
  medico_id: '',
  anestesiologo_id: '',
  fecha_cita: todayISO(),
  hora_cita: '08:00',
  turno: 'manana',
  tipo_cirugia: '',
  division_quirurgica: 'Cirugia General',
  complejidad_evento: 'Menor',
  urgencia_intervencion: 'Electiva',
  es_urgencia: false,
  requiere_expediente: true
})

const formatTurno = (turno) => {
  if (turno === 'manana') return 'Manana'
  if (turno === 'tarde') return 'Tarde'
  if (turno === 'noche') return 'Noche'
  return turno
}

const extractDate = (value) => {
  if (!value) return ''
  return String(value).split('T')[0]
}

function CitasAdmin() {
  const [citas, setCitas] = useState([])
  const [catalogos, setCatalogos] = useState(null)
  const [medicos, setMedicos] = useState([])
  const [anestesiologos, setAnestesiologos] = useState([])
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
      fetch(`${API_PERSONAL}/personal/medicos?disponible=true`),
      fetch(`${API_PERSONAL}/personal/apoyo?rol=anestesiologo`),
      fetch(`${API_EXPEDIENTES}/expedientes`)
    ])

    try {
      if (requests[0].status === 'fulfilled' && requests[0].value.ok) {
        setCatalogos(await requests[0].value.json())
      }

      if (requests[1].status === 'fulfilled' && requests[1].value.ok) {
        setMedicos(await requests[1].value.json())
      }

      if (requests[2].status === 'fulfilled' && requests[2].value.ok) {
        setAnestesiologos(await requests[2].value.json())
      }

      if (requests[3].status === 'fulfilled' && requests[3].value.ok) {
        setExpedientes(await requests[3].value.json())
      }
    } catch (error) {
      setResultado({ success: false, message: 'No se pudieron cargar catalogos de personal.' })
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

  const medicosFiltrados = useMemo(() => {
    const porTurno = medicos.filter((item) => item.turno === form.turno)
    const porDivision = porTurno.filter((item) => medicoCompatibleConDivision(item, form.division_quirurgica))

    return porDivision.length > 0 ? porDivision : porTurno
  }, [medicos, form.turno, form.division_quirurgica])

  const anestesiologosFiltrados = useMemo(
    () => anestesiologos.filter((item) => item.turno === form.turno),
    [anestesiologos, form.turno]
  )

  const medicoSeleccionado = useMemo(
    () => medicos.find((item) => String(item.id) === String(form.medico_id)) || null,
    [medicos, form.medico_id]
  )

  const anestesiologoSeleccionado = useMemo(
    () => anestesiologos.find((item) => String(item.id) === String(form.anestesiologo_id)) || null,
    [anestesiologos, form.anestesiologo_id]
  )

  const citasOrdenadas = useMemo(
    () => [...citas].sort((a, b) => new Date(a.fecha_cita) - new Date(b.fecha_cita)),
    [citas]
  )

  const onFieldChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }

      if (field === 'urgencia_intervencion') {
        next.es_urgencia = value === 'Urgencia'
      }

      if (field === 'turno') {
        const medicoActual = medicos.find((item) => String(item.id) === String(prev.medico_id))
        const anestesiaActual = anestesiologos.find((item) => String(item.id) === String(prev.anestesiologo_id))

        if (medicoActual && medicoActual.turno !== value) {
          next.medico_id = ''
        }

        if (anestesiaActual && anestesiaActual.turno !== value) {
          next.anestesiologo_id = ''
        }
      }

      if (field === 'division_quirurgica') {
        const medicoActual = medicos.find((item) => String(item.id) === String(prev.medico_id))
        if (medicoActual && !medicoCompatibleConDivision(medicoActual, value)) {
          next.medico_id = ''
        }
      }

      return next
    })
  }

  const onExpedienteSelect = (value) => {
    if (!value) {
      setForm((prev) => ({
        ...buildInitialForm(),
        fecha_cita: prev.fecha_cita,
        hora_cita: prev.hora_cita,
        turno: prev.turno
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
      paciente_nombre: expediente.nombre || '',
      tipo_cirugia: expediente.diagnostico_preoperatorio || prev.tipo_cirugia,
      division_quirurgica: expediente.division_quirurgica || prev.division_quirurgica,
      complejidad_evento: expediente.tipo_cirugia_complejidad || prev.complejidad_evento,
      urgencia_intervencion: expediente.tipo_cirugia_urgencia || prev.urgencia_intervencion,
      es_urgencia: expediente.tipo_cirugia_urgencia === 'Urgencia'
    }))
  }

  const buildFechaCitaISO = () => `${form.fecha_cita}T${form.hora_cita}:00`

  const programarCita = async () => {
    if (!form.paciente_id || !form.paciente_nombre || !form.medico_id || !form.anestesiologo_id || !form.fecha_cita || !form.hora_cita) {
      setResultado({ success: false, message: 'Completa paciente, medico, anestesiologo, fecha y hora.' })
      return
    }

    if (!medicoSeleccionado) {
      setResultado({ success: false, message: 'Selecciona un medico valido desde la lista.' })
      return
    }

    if (!anestesiologoSeleccionado) {
      setResultado({ success: false, message: 'Selecciona un anestesiologo valido desde la lista.' })
      return
    }

    setGuardando(true)
    setResultado(null)

    const payload = {
      paciente_id: Number(form.paciente_id),
      paciente_nombre: form.paciente_nombre.trim(),
      numero_expediente_clinico: form.numero_expediente_clinico || null,
      medico_id: Number(form.medico_id),
      medico_nombre: medicoSeleccionado.nombre,
      fecha_cita: buildFechaCitaISO(),
      tipo_cirugia: form.tipo_cirugia.trim() || medicoSeleccionado.especialidad || 'General',
      turno: form.turno,
      division_quirurgica: form.division_quirurgica,
      complejidad_evento: form.complejidad_evento,
      urgencia_intervencion: form.urgencia_intervencion,
      responsable_anestesia: anestesiologoSeleccionado.nombre,
      es_urgencia: form.es_urgencia || form.urgencia_intervencion === 'Urgencia',
      requiere_expediente: !!form.requiere_expediente
    }

    try {
      const response = await fetch(`${API_CITAS}/citas/programar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        const detail = data.detail
        if (detail && typeof detail === 'object') {
          const faltantes = (detail.estudios_faltantes || []).join(', ')
          setResultado({
            success: false,
            message: `${detail.message || 'No se pudo programar la cita.'}${faltantes ? ` Faltan: ${faltantes}` : ''}`
          })
        } else {
          setResultado({ success: false, message: detail || 'No se pudo programar la cita.' })
        }
        return
      }

      const warning = data.warning ? ` Aviso: ${data.warning}` : ''
      setResultado({ success: true, message: `Cita creada. ID ${data.data.id}.${warning}` })
      setForm(buildInitialForm())
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
  const complejidadOptions = catalogos?.complejidad || ['Mayor', 'Menor']
  const urgenciaOptions = catalogos?.urgencia_intervencion || ['Electiva', 'Urgencia']
  const divisionOptions = catalogos?.division_quirurgica || ['Cirugia General']

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando citas...</div>
  }

  return (
    <div>
      <h2 style={{ marginBottom: '0.75rem', fontSize: '1.5rem' }}>Citas Admin</h2>
      <p style={{ color: '#888', marginBottom: '1.25rem' }}>
        Paso 1: programa cita de chequeo/valoracion. Solo si requiere cirugia se abre expediente en Paso 2.
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
                type="number"
                placeholder="Paciente ID"
                value={form.paciente_id}
                onChange={(e) => onFieldChange('paciente_id', e.target.value)}
                className="sql-input admin-field"
              />
              <input
                type="text"
                placeholder="Nombre paciente"
                value={form.paciente_nombre}
                onChange={(e) => onFieldChange('paciente_nombre', e.target.value)}
                className="sql-input admin-field"
              />
            </div>

            <div className="admin-grid-2">
              <div className="admin-field-group">
                <label className="admin-label">Medico cirujano</label>
                <select
                  value={form.medico_id}
                  onChange={(e) => onFieldChange('medico_id', e.target.value)}
                  className="sql-input admin-field"
                >
                  <option value="">Selecciona medico...</option>
                  {medicosFiltrados.map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id} - {item.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field-group">
                <label className="admin-label">Anestesiologo</label>
                <select
                  value={form.anestesiologo_id}
                  onChange={(e) => onFieldChange('anestesiologo_id', e.target.value)}
                  className="sql-input admin-field"
                >
                  <option value="">Selecciona anestesiologo...</option>
                  {anestesiologosFiltrados.map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id} - {item.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <input
              type="text"
              placeholder="Tipo de cirugia"
              value={form.tipo_cirugia}
              onChange={(e) => onFieldChange('tipo_cirugia', e.target.value)}
              className="sql-input admin-field"
            />

            <div className="admin-grid-3">
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
              <div className="admin-field-group">
                <label className="admin-label">Turno</label>
                <select
                  value={form.turno}
                  onChange={(e) => onFieldChange('turno', e.target.value)}
                  className="sql-input admin-field"
                >
                  {turnos.map((item) => (
                    <option key={item} value={item}>
                      {formatTurno(item)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-grid-3">
              <div className="admin-field-group">
                <label className="admin-label">Division quirurgica</label>
                <select
                  value={form.division_quirurgica}
                  onChange={(e) => onFieldChange('division_quirurgica', e.target.value)}
                  className="sql-input admin-field"
                >
                  {divisionOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field-group">
                <label className="admin-label">Complejidad</label>
                <select
                  value={form.complejidad_evento}
                  onChange={(e) => onFieldChange('complejidad_evento', e.target.value)}
                  className="sql-input admin-field"
                >
                  {complejidadOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field-group">
                <label className="admin-label">Prioridad</label>
                <select
                  value={form.urgencia_intervencion}
                  onChange={(e) => onFieldChange('urgencia_intervencion', e.target.value)}
                  className="sql-input admin-field"
                >
                  {urgenciaOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#5e7791', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={!!form.es_urgencia}
                onChange={(e) => onFieldChange('es_urgencia', e.target.checked)}
              />
              Marcar como urgencia
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#5e7791', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={!!form.requiere_expediente}
                onChange={(e) => onFieldChange('requiere_expediente', e.target.checked)}
              />
              Requiere expediente quirurgico
            </label>

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
                  Medico: {cita.medico_nombre} (ID {cita.medico_id})
                </div>
                <div style={{ color: '#5e7791', fontSize: '0.84rem' }}>
                  Expediente: {cita.numero_expediente_clinico || 'Sin expediente'} | Turno: {formatTurno(cita.turno)}
                </div>
                <div style={{ color: '#5e7791', fontSize: '0.84rem' }}>
                  Division: {cita.division_quirurgica || 'N/A'} | Complejidad: {cita.complejidad_evento || 'N/A'} | Urgencia: {cita.urgencia_intervencion || 'N/A'}
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
