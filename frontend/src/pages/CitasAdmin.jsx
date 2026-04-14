import { useEffect, useMemo, useState } from 'react'

const API_CITAS = 'http://localhost:8001'
const API_EXPEDIENTES = 'http://localhost:8002'

const initialForm = {
  numero_expediente_clinico: '',
  paciente_id: '',
  paciente_nombre: '',
  medico_id: '',
  medico_nombre: '',
  fecha_cita: new Date().toISOString().slice(0, 10),
  hora_cita: '08:00',
  turno: 'manana',
  tipo_cirugia: '',
  division_quirurgica: 'Cirugia General',
  complejidad_evento: 'Menor',
  urgencia_intervencion: 'Electiva',
  responsable_anestesia: '',
  es_urgencia: false
}

function CitasAdmin() {
  const [citas, setCitas] = useState([])
  const [catalogos, setCatalogos] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [expedientePreview, setExpedientePreview] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [filtroFecha, setFiltroFecha] = useState(new Date().toISOString().slice(0, 10))
  const [filtroTurno, setFiltroTurno] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargarCatalogos = async () => {
    try {
      const response = await fetch(`${API_CITAS}/citas/catalogos`)
      if (response.ok) {
        setCatalogos(await response.json())
      }
    } catch (error) {
      // Keep silent and fallback to defaults.
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

  const onChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const buscarExpediente = async () => {
    if (!form.numero_expediente_clinico.trim()) {
      setResultado({ success: false, message: 'Escribe un numero de expediente para buscar.' })
      return
    }

    try {
      const response = await fetch(`${API_EXPEDIENTES}/expedientes/numero/${encodeURIComponent(form.numero_expediente_clinico.trim())}`)
      if (!response.ok) {
        setExpedientePreview(null)
        setResultado({ success: false, message: 'No existe ese numero de expediente.' })
        return
      }

      const data = await response.json()
      setExpedientePreview(data)

      setForm((prev) => ({
        ...prev,
        paciente_id: String(data.paciente_id),
        paciente_nombre: data.nombre || prev.paciente_nombre,
        tipo_cirugia: data.diagnostico_preoperatorio || prev.tipo_cirugia,
        turno: data.turno || prev.turno,
        division_quirurgica: data.division_quirurgica || prev.division_quirurgica,
        complejidad_evento: data.tipo_cirugia_complejidad || prev.complejidad_evento,
        urgencia_intervencion: data.tipo_cirugia_urgencia || prev.urgencia_intervencion,
        responsable_anestesia: data.responsable_anestesia || prev.responsable_anestesia,
        es_urgencia: (data.tipo_cirugia_urgencia || '').toLowerCase() === 'urgencia'
      }))

      setResultado({ success: true, message: `Expediente encontrado: ${data.nombre}` })
    } catch (error) {
      setExpedientePreview(null)
      setResultado({ success: false, message: 'Error de conexion al consultar expedientes.' })
    }
  }

  const buildFechaCitaISO = () => {
    const stamp = `${form.fecha_cita}T${form.hora_cita}:00`
    return new Date(stamp).toISOString()
  }

  const programarCita = async () => {
    if (!form.paciente_id || !form.paciente_nombre || !form.medico_id || !form.medico_nombre || !form.fecha_cita || !form.hora_cita) {
      setResultado({ success: false, message: 'Completa paciente, medico, fecha y hora.' })
      return
    }

    setGuardando(true)
    setResultado(null)

    const payload = {
      paciente_id: Number(form.paciente_id),
      paciente_nombre: form.paciente_nombre.trim(),
      numero_expediente_clinico: form.numero_expediente_clinico.trim() || null,
      medico_id: Number(form.medico_id),
      medico_nombre: form.medico_nombre.trim(),
      fecha_cita: buildFechaCitaISO(),
      tipo_cirugia: form.tipo_cirugia.trim() || 'General',
      turno: form.turno,
      division_quirurgica: form.division_quirurgica,
      complejidad_evento: form.complejidad_evento,
      urgencia_intervencion: form.urgencia_intervencion,
      responsable_anestesia: form.responsable_anestesia.trim() || null,
      es_urgencia: !!form.es_urgencia
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
            message: `${detail.message || 'No se pudo programar la cita.'}${faltantes ? ` Faltantes: ${faltantes}` : ''}`
          })
        } else {
          setResultado({ success: false, message: detail || 'No se pudo programar la cita.' })
        }
        return
      }

      const warning = data.warning ? ` | Aviso: ${data.warning}` : ''
      setResultado({ success: true, message: `Cita creada. ID ${data.data.id}${warning}` })
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
        Programa cirugias vinculando expediente clinico y validacion preoperatoria.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '1rem' }}>
        <section style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px', padding: '1rem' }}>
          <h3 style={{ color: '#3742fa', marginBottom: '0.75rem' }}>Programar cita</h3>

          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Numero expediente"
                value={form.numero_expediente_clinico}
                onChange={(e) => onChange('numero_expediente_clinico', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
              <button className="btn btn-primary" onClick={buscarExpediente}>Buscar</button>
            </div>

            {expedientePreview && (
              <div style={{ background: '#0f3460', borderRadius: '8px', padding: '0.7rem', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: '700' }}>{expedientePreview.nombre}</div>
                <div style={{ color: '#b8c2d8' }}>Paciente ID: {expedientePreview.paciente_id}</div>
                <div style={{ color: '#b8c2d8' }}>Dx: {expedientePreview.diagnostico_preoperatorio || 'Sin diagnostico'}</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input
                type="number"
                placeholder="Paciente ID"
                value={form.paciente_id}
                onChange={(e) => onChange('paciente_id', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
              <input
                type="text"
                placeholder="Nombre paciente"
                value={form.paciente_nombre}
                onChange={(e) => onChange('paciente_nombre', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input
                type="number"
                placeholder="Medico ID"
                value={form.medico_id}
                onChange={(e) => onChange('medico_id', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
              <input
                type="text"
                placeholder="Nombre medico"
                value={form.medico_nombre}
                onChange={(e) => onChange('medico_nombre', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
            </div>

            <input
              type="text"
              placeholder="Tipo cirugia"
              value={form.tipo_cirugia}
              onChange={(e) => onChange('tipo_cirugia', e.target.value)}
              className="sql-input"
              style={{ height: '40px' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <input
                type="date"
                value={form.fecha_cita}
                onChange={(e) => onChange('fecha_cita', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
              <input
                type="time"
                value={form.hora_cita}
                onChange={(e) => onChange('hora_cita', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
              <select value={form.turno} onChange={(e) => onChange('turno', e.target.value)} className="sql-input" style={{ height: '40px' }}>
                {turnos.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <select value={form.division_quirurgica} onChange={(e) => onChange('division_quirurgica', e.target.value)} className="sql-input" style={{ height: '40px' }}>
                {divisionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input
                type="text"
                placeholder="Responsable anestesia"
                value={form.responsable_anestesia}
                onChange={(e) => onChange('responsable_anestesia', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
              <select value={form.complejidad_evento} onChange={(e) => onChange('complejidad_evento', e.target.value)} className="sql-input" style={{ height: '40px' }}>
                {complejidadOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={form.urgencia_intervencion} onChange={(e) => onChange('urgencia_intervencion', e.target.value)} className="sql-input" style={{ height: '40px' }}>
                {urgenciaOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: '#b8c2d8' }}>
                <input
                  type="checkbox"
                  checked={!!form.es_urgencia}
                  onChange={(e) => onChange('es_urgencia', e.target.checked)}
                />
                Urgencia
              </label>
            </div>

            <button className="btn btn-success" onClick={programarCita} disabled={guardando}>
              {guardando ? 'Programando...' : 'Programar cita'}
            </button>
          </div>

          {resultado && (
            <div style={{
              marginTop: '0.8rem',
              borderRadius: '8px',
              padding: '0.7rem',
              border: `1px solid ${resultado.success ? '#00ff88' : '#ff4757'}`,
              background: resultado.success ? 'rgba(0,255,136,0.08)' : 'rgba(255,71,87,0.08)',
              color: '#dfe7ff'
            }}>
              {resultado.message}
            </div>
          )}
        </section>

        <section style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem' }}>
            <h3 style={{ color: '#3742fa' }}>Agenda de citas</h3>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="sql-input"
                style={{ height: '38px', width: '170px' }}
              />
              <select
                value={filtroTurno}
                onChange={(e) => setFiltroTurno(e.target.value)}
                className="sql-input"
                style={{ height: '38px', width: '140px' }}
              >
                <option value="todos">Todos</option>
                {turnos.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>

          <div style={{ maxHeight: '72vh', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
            {citasOrdenadas.map((cita) => (
              <div key={cita.id} style={{ background: '#0f3460', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <div style={{ fontWeight: '700' }}>
                    Cita #{cita.id} - {new Date(cita.fecha_cita).toLocaleString('es-MX')}
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                    <span style={{
                      background: cita.estado === 'programada' ? '#00ff88' : '#ff4757',
                      color: '#000',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      fontSize: '0.72rem',
                      fontWeight: '700'
                    }}>
                      {cita.estado}
                    </span>
                    {cita.estado === 'programada' && (
                      <button className="btn btn-danger" onClick={() => cancelarCita(cita.id)}>Cancelar</button>
                    )}
                  </div>
                </div>

                <div style={{ color: '#dce6ff', fontSize: '0.88rem' }}>
                  Paciente: {cita.paciente_nombre} (ID {cita.paciente_id})
                </div>
                <div style={{ color: '#dce6ff', fontSize: '0.88rem' }}>
                  Medico: {cita.medico_nombre} (ID {cita.medico_id})
                </div>
                <div style={{ color: '#b8c2d8', fontSize: '0.84rem' }}>
                  Expediente: {cita.numero_expediente_clinico || 'No vinculado'} | Turno: {cita.turno}
                </div>
                <div style={{ color: '#b8c2d8', fontSize: '0.84rem' }}>
                  Division: {cita.division_quirurgica || 'N/A'} | Complejidad: {cita.complejidad_evento || 'N/A'} | Urgencia: {cita.urgencia_intervencion || 'N/A'}
                </div>
                <div style={{ color: '#8ea3d1', fontSize: '0.8rem' }}>
                  Fuente: {cita.origen_programacion || 'legacy'}
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
