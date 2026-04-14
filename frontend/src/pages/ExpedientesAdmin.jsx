import { useEffect, useMemo, useState } from 'react'

const API_EXPEDIENTES = 'http://localhost:8002'

const initialForm = {
  paciente_id: '',
  numero_expediente_clinico: '',
  nombre: '',
  sexo: 'Femenino',
  fecha_nacimiento: '',
  edad_anos: '',
  fecha_ingreso_hospital: '',
  fecha_solicitud_intervencion: '',
  fecha_cirugia: '',
  procedencia: 'Urgencias',
  destino_paciente: 'Hospitalizacion',
  diagnostico_preoperatorio: '',
  tipo_cirugia_complejidad: 'Menor',
  tipo_cirugia_urgencia: 'Electiva',
  division_quirurgica: 'Cirugia General',
  responsable_cirugia: '',
  especialidad_quirurgica: '',
  responsable_anestesia: '',
  observaciones: '',
  alergias_texto: ''
}

function ExpedientesAdmin() {
  const [expedientes, setExpedientes] = useState([])
  const [catalogos, setCatalogos] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [resultado, setResultado] = useState(null)
  const [validaciones, setValidaciones] = useState({})
  const [filtroTexto, setFiltroTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargarDatos = async () => {
    try {
      const [expedientesRes, catalogosRes] = await Promise.all([
        fetch(`${API_EXPEDIENTES}/expedientes`),
        fetch(`${API_EXPEDIENTES}/expedientes/catalogos`)
      ])

      if (expedientesRes.ok) {
        setExpedientes(await expedientesRes.json())
      }

      if (catalogosRes.ok) {
        setCatalogos(await catalogosRes.json())
      }
    } catch (error) {
      setResultado({ success: false, message: 'No se pudo conectar con Expedientes.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const expedientesFiltrados = useMemo(() => {
    if (!filtroTexto.trim()) return expedientes

    const q = filtroTexto.toLowerCase()
    return expedientes.filter((exp) => (
      exp.nombre.toLowerCase().includes(q)
      || String(exp.paciente_id).includes(q)
      || (exp.numero_expediente_clinico || '').toLowerCase().includes(q)
      || (exp.diagnostico_preoperatorio || '').toLowerCase().includes(q)
    ))
  }, [expedientes, filtroTexto])

  const onChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const buildPayload = () => {
    const alergias = form.alergias_texto
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    return {
      paciente_id: Number(form.paciente_id),
      numero_expediente_clinico: form.numero_expediente_clinico.trim(),
      nombre: form.nombre.trim(),
      sexo: form.sexo,
      fecha_nacimiento: form.fecha_nacimiento,
      edad_anos: form.edad_anos ? Number(form.edad_anos) : null,
      fecha_ingreso_hospital: form.fecha_ingreso_hospital || null,
      fecha_solicitud_intervencion: form.fecha_solicitud_intervencion || null,
      fecha_cirugia: form.fecha_cirugia || null,
      procedencia: form.procedencia,
      destino_paciente: form.destino_paciente,
      diagnostico_preoperatorio: form.diagnostico_preoperatorio.trim() || null,
      tipo_cirugia_complejidad: form.tipo_cirugia_complejidad,
      tipo_cirugia_urgencia: form.tipo_cirugia_urgencia,
      division_quirurgica: form.division_quirurgica,
      responsable_cirugia: form.responsable_cirugia.trim() || null,
      especialidad_quirurgica: form.especialidad_quirurgica.trim() || null,
      responsable_anestesia: form.responsable_anestesia.trim() || null,
      observaciones: form.observaciones.trim() || null,
      alergias,
      cirugia_programada: true,
      estudios: []
    }
  }

  const guardarExpediente = async () => {
    if (!form.paciente_id || !form.numero_expediente_clinico || !form.nombre || !form.fecha_nacimiento) {
      setResultado({ success: false, message: 'Completa paciente_id, numero de expediente, nombre y fecha de nacimiento.' })
      return
    }

    setGuardando(true)
    setResultado(null)

    try {
      const response = await fetch(`${API_EXPEDIENTES}/expedientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
      })

      const data = await response.json()

      if (!response.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : 'No se pudo guardar el expediente.'
        setResultado({ success: false, message: detail })
        return
      }

      setResultado({ success: true, message: `Expediente ${data.numero_expediente_clinico} registrado.` })
      setForm(initialForm)
      await cargarDatos()
    } catch (error) {
      setResultado({ success: false, message: 'Error de conexion al guardar expediente.' })
    } finally {
      setGuardando(false)
    }
  }

  const validarExpediente = async (numeroExpediente) => {
    try {
      const response = await fetch(`${API_EXPEDIENTES}/expedientes/validar?numero_expediente=${encodeURIComponent(numeroExpediente)}`)
      if (!response.ok) return

      const data = await response.json()
      setValidaciones((prev) => ({
        ...prev,
        [numeroExpediente]: data
      }))
    } catch (error) {
      // Keep silent in per-row validation.
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando expedientes...</div>
  }

  const sexoOptions = catalogos?.sexo || ['Femenino', 'Masculino']
  const procedenciaOptions = catalogos?.procedencia || ['Urgencias', 'Consulta Externa', 'Hospitalizacion']
  const destinoOptions = catalogos?.destino_paciente || ['Hospitalizacion', 'Alta', 'UCI', 'Pendiente']
  const complejidadOptions = catalogos?.tipo_cirugia_complejidad || ['Mayor', 'Menor']
  const urgenciaOptions = catalogos?.tipo_cirugia_urgencia || ['Electiva', 'Urgencia']
  const divisionOptions = catalogos?.division_quirurgica || ['Cirugia General']

  return (
    <div>
      <h2 style={{ marginBottom: '0.75rem', fontSize: '1.5rem' }}>Expedientes Admin</h2>
      <p style={{ color: '#888', marginBottom: '1.25rem' }}>
        Registro de expediente clinico antes de programar cita quirurgica.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1rem' }}>
        <section style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px', padding: '1rem' }}>
          <h3 style={{ color: '#3742fa', marginBottom: '0.75rem' }}>Nuevo expediente</h3>

          <div style={{ display: 'grid', gap: '0.55rem' }}>
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
              placeholder="Numero expediente (ej: EXP-1200)"
              value={form.numero_expediente_clinico}
              onChange={(e) => onChange('numero_expediente_clinico', e.target.value)}
              className="sql-input"
              style={{ height: '40px' }}
            />
            <input
              type="text"
              placeholder="Nombre del paciente"
              value={form.nombre}
              onChange={(e) => onChange('nombre', e.target.value)}
              className="sql-input"
              style={{ height: '40px' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <select value={form.sexo} onChange={(e) => onChange('sexo', e.target.value)} className="sql-input" style={{ height: '40px' }}>
                {sexoOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input
                type="number"
                placeholder="Edad"
                value={form.edad_anos}
                onChange={(e) => onChange('edad_anos', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => onChange('fecha_nacimiento', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
              <input
                type="date"
                value={form.fecha_ingreso_hospital}
                onChange={(e) => onChange('fecha_ingreso_hospital', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input
                type="date"
                value={form.fecha_solicitud_intervencion}
                onChange={(e) => onChange('fecha_solicitud_intervencion', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
              <input
                type="date"
                value={form.fecha_cirugia}
                onChange={(e) => onChange('fecha_cirugia', e.target.value)}
                className="sql-input"
                style={{ height: '40px' }}
              />
            </div>

            <select value={form.procedencia} onChange={(e) => onChange('procedencia', e.target.value)} className="sql-input" style={{ height: '40px' }}>
              {procedenciaOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={form.destino_paciente} onChange={(e) => onChange('destino_paciente', e.target.value)} className="sql-input" style={{ height: '40px' }}>
              {destinoOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <textarea
              placeholder="Diagnostico preoperatorio"
              value={form.diagnostico_preoperatorio}
              onChange={(e) => onChange('diagnostico_preoperatorio', e.target.value)}
              className="sql-input"
              style={{ minHeight: '68px', resize: 'vertical' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <select value={form.tipo_cirugia_complejidad} onChange={(e) => onChange('tipo_cirugia_complejidad', e.target.value)} className="sql-input" style={{ height: '40px' }}>
                {complejidadOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={form.tipo_cirugia_urgencia} onChange={(e) => onChange('tipo_cirugia_urgencia', e.target.value)} className="sql-input" style={{ height: '40px' }}>
                {urgenciaOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <select value={form.division_quirurgica} onChange={(e) => onChange('division_quirurgica', e.target.value)} className="sql-input" style={{ height: '40px' }}>
              {divisionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <input
              type="text"
              placeholder="Cirujano responsable"
              value={form.responsable_cirugia}
              onChange={(e) => onChange('responsable_cirugia', e.target.value)}
              className="sql-input"
              style={{ height: '40px' }}
            />
            <input
              type="text"
              placeholder="Especialidad quirurgica"
              value={form.especialidad_quirurgica}
              onChange={(e) => onChange('especialidad_quirurgica', e.target.value)}
              className="sql-input"
              style={{ height: '40px' }}
            />
            <input
              type="text"
              placeholder="Responsable anestesia"
              value={form.responsable_anestesia}
              onChange={(e) => onChange('responsable_anestesia', e.target.value)}
              className="sql-input"
              style={{ height: '40px' }}
            />
            <input
              type="text"
              placeholder="Alergias separadas por coma"
              value={form.alergias_texto}
              onChange={(e) => onChange('alergias_texto', e.target.value)}
              className="sql-input"
              style={{ height: '40px' }}
            />

            <textarea
              placeholder="Observaciones"
              value={form.observaciones}
              onChange={(e) => onChange('observaciones', e.target.value)}
              className="sql-input"
              style={{ minHeight: '68px', resize: 'vertical' }}
            />

            <button className="btn btn-success" onClick={guardarExpediente} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar expediente'}
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
            <h3 style={{ color: '#3742fa' }}>Listado de expedientes</h3>
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por nombre, ID o expediente"
              className="sql-input"
              style={{ height: '38px', maxWidth: '320px' }}
            />
          </div>

          <div style={{ maxHeight: '70vh', overflowY: 'auto', display: 'grid', gap: '0.6rem' }}>
            {expedientesFiltrados.map((exp) => {
              const validacion = validaciones[exp.numero_expediente_clinico]

              return (
                <div key={exp.id} style={{ background: '#0f3460', borderRadius: '8px', padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <div style={{ fontWeight: '700' }}>{exp.nombre}</div>
                    <button className="btn btn-primary" onClick={() => validarExpediente(exp.numero_expediente_clinico)}>
                      Validar preop
                    </button>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#b8c2d8' }}>
                    #{exp.paciente_id} | {exp.numero_expediente_clinico} | {exp.sexo}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#b8c2d8' }}>
                    {exp.division_quirurgica || 'Sin division'} | {exp.tipo_cirugia_urgencia || 'Sin urgencia'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#9fb3ff' }}>
                    Dx preop: {exp.diagnostico_preoperatorio || 'Sin diagnostico'}
                  </div>

                  {validacion && (
                    <div style={{
                      marginTop: '0.55rem',
                      padding: '0.55rem',
                      borderRadius: '6px',
                      background: validacion.puede_operar ? 'rgba(0,255,136,0.08)' : 'rgba(255,165,2,0.12)',
                      border: `1px solid ${validacion.puede_operar ? '#00ff88' : '#ffa502'}`,
                      fontSize: '0.82rem'
                    }}>
                      <div style={{ fontWeight: '700', color: validacion.puede_operar ? '#00ff88' : '#ffa502' }}>
                        {validacion.puede_operar ? 'Apto para cirugia' : 'Pendiente de estudios'}
                      </div>
                      {!validacion.puede_operar && (
                        <div style={{ color: '#d5def6' }}>
                          Faltantes: {validacion.estudios_faltantes.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {expedientesFiltrados.length === 0 && (
              <div style={{ color: '#777', textAlign: 'center', padding: '1rem' }}>
                No hay expedientes para ese filtro.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default ExpedientesAdmin
