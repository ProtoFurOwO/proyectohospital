import { useEffect, useMemo, useState } from 'react'

const API_EXPEDIENTES = 'http://localhost:8002'
const API_CITAS = 'http://localhost:8001'
const API_PERSONAL = 'http://localhost:8005'

const ESTUDIOS_REQUERIDOS = ['laboratorio', 'cardiograma', 'imagen']
const ESTADOS_ESTUDIO_FALLBACK = ['pendiente', 'solicitado', 'realizado', 'validado', 'rechazado']

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

const buildNextExpedienteNumber = (items) => {
  const maxNumber = items.reduce((max, item) => {
    const match = String(item.numero_expediente_clinico || '').toUpperCase().match(/^EXP-(\d+)$/)
    if (!match) return max
    const current = Number(match[1])
    return Number.isFinite(current) ? Math.max(max, current) : max
  }, 1000)

  return `EXP-${maxNumber + 1}`
}

const buildInitialForm = (numeroExpediente) => ({
  cita_id: '',
  paciente_id: '',
  numero_expediente_clinico: numeroExpediente,
  nombre: '',
  sexo: 'Femenino',
  fecha_nacimiento: '',
  edad_anos: '',
  fecha_ingreso_hospital: todayISO(),
  fecha_solicitud_intervencion: todayISO(),
  fecha_cirugia: '',
  procedencia: 'Urgencias',
  destino_paciente: 'Hospitalizacion',
  diagnostico_preoperatorio: '',
  tipo_cirugia_complejidad: 'Menor',
  tipo_cirugia_urgencia: 'Electiva',
  division_quirurgica: 'Cirugia General',
  medico_id: '',
  anestesiologo_id: '',
  observaciones: '',
  alergias_texto: ''
})

const extractDate = (value) => {
  if (!value) return ''
  return String(value).split('T')[0]
}

const prettyTipo = (tipo) => {
  if (tipo === 'imagen') return 'Imagenologia (Rx/TAC/USG)'
  if (tipo === 'cardiograma') return 'Cardiograma'
  if (tipo === 'laboratorio') return 'Laboratorio'
  return tipo.charAt(0).toUpperCase() + tipo.slice(1)
}

const normalizeStudyState = (study) => {
  if (!study) return 'pendiente'
  if (study.estado) return String(study.estado).toLowerCase()
  return study.valido ? 'validado' : 'pendiente'
}

const getEstadoColor = (estado) => {
  if (estado === 'validado') return '#14b8a6'
  if (estado === 'realizado') return '#2ed573'
  if (estado === 'solicitado') return '#1e90ff'
  if (estado === 'rechazado') return '#ff4757'
  return '#ffa502'
}

const findAnestesiologoByNombre = (items, nombre) => {
  if (!nombre) return null
  const target = String(nombre).trim().toLowerCase()
  return items.find((item) => String(item.nombre || '').trim().toLowerCase() === target) || null
}

const getStudyByTipo = (expediente, tipo) => {
  if (!expediente?.estudios) return null
  return [...expediente.estudios]
    .reverse()
    .find((item) => String(item.tipo || '').toLowerCase() === tipo) || null
}

const safeJsonResponse = async (response) => {
  try {
    return await response.json()
  } catch (_error) {
    return null
  }
}

const buildStudyForms = (expediente) => {
  const forms = {}

  ESTUDIOS_REQUERIDOS.forEach((tipo) => {
    const estudio = getStudyByTipo(expediente, tipo)
    forms[tipo] = {
      estado: normalizeStudyState(estudio),
      resultado: estudio?.resultado && estudio.resultado !== 'Pendiente' ? estudio.resultado : '',
      fecha: estudio?.fecha || todayISO(),
      observaciones: estudio?.observaciones || ''
    }
  })

  return forms
}

const getSemaforoExpediente = (expediente) => {
  const estados = ESTUDIOS_REQUERIDOS.map((tipo) => normalizeStudyState(getStudyByTipo(expediente, tipo)))
  const validados = estados.filter((estado) => estado === 'validado').length
  const rechazados = estados.filter((estado) => estado === 'rechazado').length

  if (validados === ESTUDIOS_REQUERIDOS.length) {
    return { label: 'Apto para cirugia', color: '#14b8a6' }
  }

  if (rechazados > 0) {
    return { label: 'No apto - estudio rechazado', color: '#ff4757' }
  }

  if (validados > 0) {
    return { label: 'En revision de estudios', color: '#ffa502' }
  }

  return { label: 'No apto - faltan estudios', color: '#ff4757' }
}

export default function ExpedientesAdmin() {
  const [expedientes, setExpedientes] = useState([])
  const [citasPendientes, setCitasPendientes] = useState([])
  const [catalogos, setCatalogos] = useState(null)
  const [medicos, setMedicos] = useState([])
  const [anestesiologos, setAnestesiologos] = useState([])
  const [proximoNumeroExpediente, setProximoNumeroExpediente] = useState('EXP-1001')
  const [form, setForm] = useState(() => buildInitialForm('EXP-1001'))
  const [resultado, setResultado] = useState(null)
  const [filtroTexto, setFiltroTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [validaciones, setValidaciones] = useState({})
  const [expedienteEstudios, setExpedienteEstudios] = useState(null)
  const [estudiosForm, setEstudiosForm] = useState({})
  const [guardandoEstudioTipo, setGuardandoEstudioTipo] = useState('')
  const [resultadoEstudios, setResultadoEstudios] = useState(null)

  const cargarDatos = async () => {
    const requests = await Promise.allSettled([
      fetch(`${API_EXPEDIENTES}/expedientes`),
      fetch(`${API_EXPEDIENTES}/expedientes/catalogos`),
      fetch(`${API_CITAS}/citas?estado=programada`),
      fetch(`${API_PERSONAL}/personal/medicos?disponible=true`),
      fetch(`${API_PERSONAL}/personal/apoyo?rol=anestesiologo`)
    ])

    try {
      if (requests[0].status === 'fulfilled' && requests[0].value.ok) {
        const data = await requests[0].value.json()
        setExpedientes(data)

        const nextNumber = buildNextExpedienteNumber(data)
        setProximoNumeroExpediente(nextNumber)
        setForm((prev) => ({ ...prev, numero_expediente_clinico: nextNumber }))

        if (expedienteEstudios) {
          const actualizado = data.find((item) => item.id === expedienteEstudios.id)
          if (actualizado) {
            setExpedienteEstudios(actualizado)
            setEstudiosForm(buildStudyForms(actualizado))
          }
        }
      }

      if (requests[1].status === 'fulfilled' && requests[1].value.ok) {
        setCatalogos(await requests[1].value.json())
      }

      if (requests[2].status === 'fulfilled' && requests[2].value.ok) {
        setCitasPendientes(await requests[2].value.json())
      }

      if (requests[3].status === 'fulfilled' && requests[3].value.ok) {
        setMedicos(await requests[3].value.json())
      }

      if (requests[4].status === 'fulfilled' && requests[4].value.ok) {
        setAnestesiologos(await requests[4].value.json())
      }
    } catch (error) {
      setResultado({ success: false, message: 'Error cargando datos de servicios.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const citasDisponibles = useMemo(() => {
    const pacientesConExpediente = new Set(expedientes.map((item) => String(item.paciente_id)))

    return citasPendientes
      .filter((cita) => cita.estado === 'programada')
      .filter((cita) => cita.requiere_expediente !== false)
      .filter((cita) => !pacientesConExpediente.has(String(cita.paciente_id)))
      .sort((a, b) => new Date(a.fecha_cita) - new Date(b.fecha_cita))
  }, [citasPendientes, expedientes])

  const expedientesFiltrados = useMemo(() => {
    if (!filtroTexto.trim()) return expedientes
    const q = filtroTexto.toLowerCase()

    return expedientes.filter((item) => {
      const nombre = String(item.nombre || '').toLowerCase()
      const numero = String(item.numero_expediente_clinico || '').toLowerCase()
      return nombre.includes(q) || numero.includes(q) || String(item.paciente_id).includes(q)
    })
  }, [expedientes, filtroTexto])

  const medicosFiltrados = useMemo(() => {
    let candidatos = medicos

    if (form.cita_id) {
      const cita = citasDisponibles.find((item) => String(item.id) === String(form.cita_id))
      if (cita?.turno) {
        candidatos = candidatos.filter((item) => item.turno === cita.turno)
      }
    }

    const filtrados = candidatos.filter((item) => medicoCompatibleConDivision(item, form.division_quirurgica))
    if (filtrados.length > 0) return filtrados

    const cita = citasDisponibles.find((item) => String(item.id) === String(form.cita_id))
    if (cita?.turno) return candidatos
    return medicos
  }, [medicos, form.cita_id, form.division_quirurgica, citasDisponibles])

  const anestesiologosFiltrados = useMemo(() => {
    if (!form.cita_id) return anestesiologos
    const cita = citasDisponibles.find((item) => String(item.id) === String(form.cita_id))
    if (!cita?.turno) return anestesiologos

    return anestesiologos.filter((item) => item.turno === cita.turno)
  }, [anestesiologos, form.cita_id, citasDisponibles])

  const estadosEstudioOptions = catalogos?.estados_estudio || ESTADOS_ESTUDIO_FALLBACK

  const onFieldChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }

      if (field === 'division_quirurgica') {
        const medicoActual = medicos.find((item) => String(item.id) === String(prev.medico_id))
        if (medicoActual && !medicoCompatibleConDivision(medicoActual, value)) {
          next.medico_id = ''
        }
      }

      return next
    })
  }

  const onCitaChange = (value) => {
    if (!value) {
      setForm((prev) => ({
        ...buildInitialForm(proximoNumeroExpediente),
        sexo: prev.sexo
      }))
      return
    }

    const cita = citasDisponibles.find((item) => String(item.id) === String(value))
    if (!cita) return

    const anestesia = findAnestesiologoByNombre(anestesiologos, cita.responsable_anestesia)

    setForm((prev) => ({
      ...prev,
      cita_id: String(cita.id),
      paciente_id: String(cita.paciente_id),
      nombre: cita.paciente_nombre || '',
      fecha_cirugia: extractDate(cita.fecha_cita),
      diagnostico_preoperatorio: cita.tipo_cirugia || '',
      division_quirurgica: cita.division_quirurgica || prev.division_quirurgica,
      tipo_cirugia_complejidad: cita.complejidad_evento || prev.tipo_cirugia_complejidad,
      tipo_cirugia_urgencia: cita.urgencia_intervencion || prev.tipo_cirugia_urgencia,
      medico_id: cita.medico_id ? String(cita.medico_id) : prev.medico_id,
      anestesiologo_id: anestesia ? String(anestesia.id) : prev.anestesiologo_id
    }))
  }

  const buildPayload = () => {
    const alergias = form.alergias_texto
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const medicoSeleccionado = medicos.find((item) => String(item.id) === String(form.medico_id))
    const anestesiologoSeleccionado = anestesiologos.find(
      (item) => String(item.id) === String(form.anestesiologo_id)
    )

    const fechaBaseEstudio = form.fecha_ingreso_hospital || todayISO()

    return {
      paciente_id: Number(form.paciente_id),
      numero_expediente_clinico: form.numero_expediente_clinico,
      nombre: form.nombre.trim(),
      sexo: form.sexo,
      fecha_nacimiento: form.fecha_nacimiento || '2000-01-01',
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
      responsable_cirugia: medicoSeleccionado?.nombre || null,
      especialidad_quirurgica: medicoSeleccionado?.especialidad || form.division_quirurgica,
      responsable_anestesia: anestesiologoSeleccionado?.nombre || null,
      observaciones: form.observaciones.trim() || null,
      alergias,
      cirugia_programada: true,
      estudios: ESTUDIOS_REQUERIDOS.map((tipo, index) => ({
        id: index + 1,
        tipo,
        resultado: 'Pendiente',
        fecha: fechaBaseEstudio,
        valido: false,
        estado: 'pendiente',
        observaciones: null
      }))
    }
  }

  const guardarExpediente = async () => {
    if (!form.cita_id) {
      setResultado({
        success: false,
        message: 'Selecciona una cita programada para continuar con el flujo Cita -> Expediente.'
      })
      return
    }

    if (!form.paciente_id || !form.nombre || !form.medico_id || !form.anestesiologo_id) {
      setResultado({
        success: false,
        message: 'Completa paciente, medico y anestesiologo para crear el expediente.'
      })
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
        setResultado({ success: false, message: data.detail || 'No se pudo crear el expediente.' })
        return
      }

      setResultado({
        success: true,
        message: `Expediente ${data.numero_expediente_clinico} creado. Abre Gestion de estudios para registrar avances.`
      })

      setExpedienteEstudios(data)
      setEstudiosForm(buildStudyForms(data))
      setResultadoEstudios({ success: true, message: 'Panel listo para cargar estudios del nuevo expediente.' })

      await cargarDatos()
      setForm(buildInitialForm(buildNextExpedienteNumber([...expedientes, data])))
    } catch (error) {
      setResultado({ success: false, message: 'Error de conexion con servicio de expedientes.' })
    } finally {
      setGuardando(false)
    }
  }

  const validarExpediente = async (numeroExpediente) => {
    try {
      const response = await fetch(
        `${API_EXPEDIENTES}/expedientes/validar?numero_expediente=${encodeURIComponent(numeroExpediente)}`
      )
      if (!response.ok) return null
      const data = await response.json()
      setValidaciones((prev) => ({ ...prev, [numeroExpediente]: data }))
      return data
    } catch (error) {
      setResultado({ success: false, message: 'No se pudo validar el expediente seleccionado.' })
      return null
    }
  }

  const abrirPanelEstudios = (expediente) => {
    setExpedienteEstudios(expediente)
    setEstudiosForm(buildStudyForms(expediente))
    setResultadoEstudios(null)
  }

  const cerrarPanelEstudios = () => {
    setExpedienteEstudios(null)
    setEstudiosForm({})
    setGuardandoEstudioTipo('')
    setResultadoEstudios(null)
  }

  const onEstudioFieldChange = (tipo, field, value) => {
    setEstudiosForm((prev) => ({
      ...prev,
      [tipo]: {
        ...(prev[tipo] || {}),
        [field]: value
      }
    }))
  }

  const guardarEstudio = async (tipo) => {
    if (!expedienteEstudios) return

    const payload = estudiosForm[tipo]
    if (!payload) return

    setGuardandoEstudioTipo(tipo)
    setResultadoEstudios(null)

    try {
      let response = await fetch(
        `${API_EXPEDIENTES}/expedientes/${expedienteEstudios.id}/estudios/${encodeURIComponent(tipo)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estado: payload.estado,
            resultado: payload.resultado?.trim() || (payload.estado === 'validado' ? 'Normal' : 'Pendiente'),
            fecha: payload.fecha || todayISO(),
            observaciones: payload.observaciones?.trim() || null,
            valido: payload.estado === 'validado'
          })
        }
      )

      let data = await safeJsonResponse(response)

      if (response.status === 404 && data?.detail === 'Not Found') {
        // Compatibilidad con instancia legacy de Expedientes que aun no tiene el endpoint PUT.
        response = await fetch(`${API_EXPEDIENTES}/expedientes/${expedienteEstudios.id}/agregar-estudio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 0,
            tipo,
            resultado: payload.resultado?.trim() || (payload.estado === 'validado' ? 'Normal' : 'Pendiente'),
            fecha: payload.fecha || todayISO(),
            valido: payload.estado === 'validado',
            estado: payload.estado,
            observaciones: payload.observaciones?.trim() || null
          })
        })

        data = await safeJsonResponse(response)
        if (response.ok && data?.data) {
          data = data.data
        }
      }

      if (!response.ok) {
        const detail = data?.detail || 'No se pudo actualizar el estudio.'
        setResultadoEstudios({ success: false, message: String(detail) })
        return
      }

      setExpedientes((prev) => prev.map((item) => (item.id === data.id ? data : item)))
      setExpedienteEstudios(data)
      setEstudiosForm(buildStudyForms(data))
      setResultadoEstudios({ success: true, message: `${prettyTipo(tipo)} actualizado correctamente.` })

      await validarExpediente(data.numero_expediente_clinico)
    } catch (error) {
      setResultadoEstudios({ success: false, message: 'Error de conexion al guardar estudio.' })
    } finally {
      setGuardandoEstudioTipo('')
    }
  }

  const sexoOptions = catalogos?.sexo || ['Femenino', 'Masculino']
  const procedenciaOptions = catalogos?.procedencia || ['Urgencias', 'Consulta Externa', 'Hospitalizacion']
  const destinoOptions = catalogos?.destino_paciente || ['Hospitalizacion', 'Alta', 'UCI', 'Pendiente']
  const complejidadOptions = catalogos?.tipo_cirugia_complejidad || ['Mayor', 'Menor']
  const urgenciaOptions = catalogos?.tipo_cirugia_urgencia || ['Electiva', 'Urgencia']
  const divisionOptions = catalogos?.division_quirurgica || ['Cirugia General']

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando expedientes...</div>
  }

  return (
    <div>
      <h2 style={{ marginBottom: '0.75rem', fontSize: '1.5rem' }}>Expedientes Admin</h2>
      <p style={{ color: '#888', marginBottom: '1.25rem' }}>
        Paso 2: registra expediente y controla estudios antes de la cirugia.
      </p>

      <div className="admin-layout-grid">
        <section className="admin-card">
          <h3 className="admin-card-title">Nuevo expediente</h3>

          <div className="admin-form-grid">
            <div>
              <label className="admin-label">Cita programada</label>
              <select
                className="sql-input admin-field"
                value={form.cita_id}
                onChange={(e) => onCitaChange(e.target.value)}
              >
                <option value="">Selecciona una cita pendiente...</option>
                {citasDisponibles.map((item) => (
                  <option key={item.id} value={item.id}>
                    Cita #{item.id} - {item.paciente_nombre} ({extractDate(item.fecha_cita)})
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
                readOnly={!!form.cita_id}
              />
              <input
                type="text"
                value={form.numero_expediente_clinico}
                className="sql-input admin-field"
                readOnly
              />
            </div>

            <input
              type="text"
              placeholder="Nombre del paciente"
              value={form.nombre}
              onChange={(e) => onFieldChange('nombre', e.target.value)}
              className="sql-input admin-field"
              readOnly={!!form.cita_id}
            />

            <div className="admin-grid-2">
              <div className="admin-field-group">
                <label className="admin-label">Sexo</label>
                <select
                  value={form.sexo}
                  onChange={(e) => onFieldChange('sexo', e.target.value)}
                  className="sql-input admin-field"
                >
                  {sexoOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                placeholder="Edad"
                value={form.edad_anos}
                onChange={(e) => onFieldChange('edad_anos', e.target.value)}
                className="sql-input admin-field"
              />
            </div>

            <div className="admin-grid-2">
              <input
                type="date"
                value={form.fecha_ingreso_hospital}
                onChange={(e) => onFieldChange('fecha_ingreso_hospital', e.target.value)}
                className="sql-input admin-field"
              />
              <input
                type="date"
                value={form.fecha_cirugia}
                onChange={(e) => onFieldChange('fecha_cirugia', e.target.value)}
                className="sql-input admin-field"
              />
            </div>

            <div className="admin-grid-2">
              <div className="admin-field-group">
                <label className="admin-label">Procedencia</label>
                <select
                  value={form.procedencia}
                  onChange={(e) => onFieldChange('procedencia', e.target.value)}
                  className="sql-input admin-field"
                >
                  {procedenciaOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-field-group">
                <label className="admin-label">Destino del paciente</label>
                <select
                  value={form.destino_paciente}
                  onChange={(e) => onFieldChange('destino_paciente', e.target.value)}
                  className="sql-input admin-field"
                >
                  {destinoOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-grid-2">
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
                <label className="admin-label">Cirujano responsable</label>
                <select
                  value={form.medico_id}
                  onChange={(e) => onFieldChange('medico_id', e.target.value)}
                  className="sql-input admin-field"
                >
                  <option value="">Selecciona cirujano...</option>
                  {medicosFiltrados.map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id} - {item.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-grid-2">
              <div className="admin-field-group">
                <label className="admin-label">Complejidad</label>
                <select
                  value={form.tipo_cirugia_complejidad}
                  onChange={(e) => onFieldChange('tipo_cirugia_complejidad', e.target.value)}
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
                  value={form.tipo_cirugia_urgencia}
                  onChange={(e) => onFieldChange('tipo_cirugia_urgencia', e.target.value)}
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

            <div className="admin-field-group">
              <label className="admin-label">Anestesiologo responsable</label>
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

            <textarea
              placeholder="Diagnostico preoperatorio"
              value={form.diagnostico_preoperatorio}
              onChange={(e) => onFieldChange('diagnostico_preoperatorio', e.target.value)}
              className="sql-input admin-field admin-textarea"
            />

            <textarea
              placeholder="Alergias separadas por coma"
              value={form.alergias_texto}
              onChange={(e) => onFieldChange('alergias_texto', e.target.value)}
              className="sql-input admin-field admin-textarea"
            />

            <textarea
              placeholder="Observaciones"
              value={form.observaciones}
              onChange={(e) => onFieldChange('observaciones', e.target.value)}
              className="sql-input admin-field admin-textarea"
            />

            <button className="btn btn-success admin-main-button" onClick={guardarExpediente} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Crear expediente'}
            </button>

            {resultado && (
              <div className={`admin-result ${resultado.success ? 'success' : 'error'}`}>{resultado.message}</div>
            )}

            <small style={{ color: '#6d87a2' }}>
              Citas pendientes sin expediente: {citasDisponibles.length}
            </small>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-toolbar">
            <h3 className="admin-card-title" style={{ marginBottom: 0 }}>
              Expedientes registrados
            </h3>
            <input
              type="text"
              placeholder="Buscar por nombre, ID o expediente"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="sql-input admin-field"
              style={{ maxWidth: '320px' }}
            />
          </div>

          <div className="admin-list-scroll">
            {expedientesFiltrados.map((item) => {
              const validacion = validaciones[item.numero_expediente_clinico]
              const puedeOperar = validacion?.puede_operar
              const semaforo = getSemaforoExpediente(item)

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#e6f5ff',
                    borderRadius: '8px',
                    padding: '0.8rem',
                    borderLeft: `4px solid ${item.tipo_cirugia_urgencia === 'Urgencia' ? '#ff4757' : '#0a78b5'}`
                  }}
                >
                  <div className="admin-toolbar">
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.nombre}</div>
                      <div style={{ color: '#5e7791', fontSize: '0.85rem' }}>
                        #{item.paciente_id} | {item.numero_expediente_clinico} | {item.division_quirurgica}
                      </div>
                      <div style={{ color: '#5e7791', fontSize: '0.85rem' }}>
                        Dx: {item.diagnostico_preoperatorio || 'Sin diagnostico'}
                      </div>
                      <div style={{ color: semaforo.color, fontSize: '0.8rem', fontWeight: 700, marginTop: '0.35rem' }}>
                        {semaforo.label}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-warning" onClick={() => abrirPanelEstudios(item)}>
                        Gestionar estudios
                      </button>
                      <button className="btn btn-primary" onClick={() => validarExpediente(item.numero_expediente_clinico)}>
                        Validar preop
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.55rem' }}>
                    {ESTUDIOS_REQUERIDOS.map((tipo) => {
                      const estado = normalizeStudyState(getStudyByTipo(item, tipo))
                      return (
                        <span
                          key={tipo}
                          style={{
                            background: `${getEstadoColor(estado)}22`,
                            border: `1px solid ${getEstadoColor(estado)}`,
                            color: '#1f435f',
                            borderRadius: '999px',
                            padding: '0.18rem 0.55rem',
                            fontSize: '0.74rem'
                          }}
                        >
                          {prettyTipo(tipo)}: {estado}
                        </span>
                      )
                    })}
                  </div>

                  {validacion && (
                    <div style={{ marginTop: '0.6rem', fontSize: '0.85rem' }}>
                      <div style={{ color: puedeOperar ? '#14b8a6' : '#ff4757', fontWeight: 700 }}>
                        {puedeOperar ? 'Apto para cirugia' : 'Faltan estudios'}
                      </div>
                      {!puedeOperar && validacion.estudios_faltantes.length > 0 && (
                        <div style={{ color: '#ff9aa4' }}>
                          Faltan: {validacion.estudios_faltantes.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {expedientesFiltrados.length === 0 && (
              <div style={{ color: '#777', textAlign: 'center', padding: '1rem' }}>
                No hay expedientes para el filtro actual.
              </div>
            )}
          </div>
        </section>
      </div>

      {expedienteEstudios && (
        <div className="study-modal-backdrop" onClick={cerrarPanelEstudios}>
          <section className="study-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-toolbar">
              <div>
                <h3 className="admin-card-title" style={{ marginBottom: '0.25rem' }}>
                  Gestion de estudios
                </h3>
                <div style={{ color: '#5e7791', fontSize: '0.9rem' }}>
                  {expedienteEstudios.nombre} | {expedienteEstudios.numero_expediente_clinico}
                </div>
              </div>
              <button className="btn btn-danger" onClick={cerrarPanelEstudios}>
                Cerrar
              </button>
            </div>

            <p style={{ color: '#6d87a2', fontSize: '0.86rem', marginBottom: '0.75rem' }}>
              Actualiza cada estudio para controlar avance y aptitud preoperatoria.
            </p>

            <div className="study-list">
              {ESTUDIOS_REQUERIDOS.map((tipo) => {
                const data = estudiosForm[tipo] || {
                  estado: 'pendiente',
                  resultado: '',
                  fecha: todayISO(),
                  observaciones: ''
                }

                return (
                  <article key={tipo} className="study-item">
                    <div className="study-item-head">
                      <strong>{prettyTipo(tipo)}</strong>
                      <span className="study-state-pill" style={{ borderColor: getEstadoColor(data.estado) }}>
                        {data.estado}
                      </span>
                    </div>

                    <div className="admin-grid-3">
                      <div className="admin-field-group">
                        <label className="admin-label">Estado del estudio</label>
                        <select
                          value={data.estado}
                          onChange={(e) => onEstudioFieldChange(tipo, 'estado', e.target.value)}
                          className="sql-input admin-field"
                        >
                          {estadosEstudioOptions.map((estado) => (
                            <option key={estado} value={estado}>
                              {estado}
                            </option>
                          ))}
                        </select>
                      </div>

                      <input
                        type="date"
                        value={data.fecha}
                        onChange={(e) => onEstudioFieldChange(tipo, 'fecha', e.target.value)}
                        className="sql-input admin-field"
                      />

                      <input
                        type="text"
                        placeholder="Resultado"
                        value={data.resultado}
                        onChange={(e) => onEstudioFieldChange(tipo, 'resultado', e.target.value)}
                        className="sql-input admin-field"
                      />
                    </div>

                    <textarea
                      placeholder="Observaciones del estudio"
                      value={data.observaciones}
                      onChange={(e) => onEstudioFieldChange(tipo, 'observaciones', e.target.value)}
                      className="sql-input admin-field admin-textarea"
                      style={{ marginTop: '0.55rem' }}
                    />

                    <button
                      className="btn btn-success"
                      style={{ marginTop: '0.55rem' }}
                      onClick={() => guardarEstudio(tipo)}
                      disabled={guardandoEstudioTipo === tipo}
                    >
                      {guardandoEstudioTipo === tipo ? 'Guardando...' : `Guardar ${prettyTipo(tipo)}`}
                    </button>
                  </article>
                )
              })}
            </div>

            {resultadoEstudios && (
              <div
                className={`admin-result ${resultadoEstudios.success ? 'success' : 'error'}`}
                style={{ marginTop: '0.75rem' }}
              >
                {resultadoEstudios.message}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
