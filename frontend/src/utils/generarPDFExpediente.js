/**
 * Generador de Reportes PDF para Expedientes Clínicos
 * Sistema Hospitalario – Formato profesional de historia clínica
 */
import { jsPDF } from 'jspdf'

const COLORS = {
  primary: [10, 120, 181],     // #0a78b5
  dark: [31, 67, 95],          // #1f435f
  text: [51, 51, 51],
  lightGray: [140, 140, 140],
  white: [255, 255, 255],
  success: [20, 184, 166],     // #14b8a6
  danger: [255, 71, 87],       // #ff4757
  warning: [255, 165, 2],      // #ffa502
  tableBorder: [200, 215, 230],
  tableHeader: [230, 245, 255],
  tableStripe: [245, 250, 255],
}

const PAGE = {
  marginLeft: 20,
  marginRight: 20,
  marginTop: 20,
  marginBottom: 25,
  width: 210,  // A4
  height: 297,
}

const contentWidth = PAGE.width - PAGE.marginLeft - PAGE.marginRight

/**
 * Dibuja el encabezado del hospital
 */
function drawHeader(doc, expediente) {
  const y = PAGE.marginTop

  // Barra superior azul
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, PAGE.width, 42, 'F')

  // Cruz médica (ícono simple)
  doc.setFillColor(...COLORS.white)
  doc.rect(PAGE.marginLeft, 12, 18, 18, 'F')
  doc.setFillColor(...COLORS.primary)
  doc.rect(PAGE.marginLeft + 7, 14, 4, 14, 'F')
  doc.rect(PAGE.marginLeft + 2, 19, 14, 4, 'F')

  // Nombre del hospital
  doc.setTextColor(...COLORS.white)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Sistema Hospitalario', PAGE.marginLeft + 22, 22)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Reporte de Expediente Clínico', PAGE.marginLeft + 22, 30)

  // Número de expediente (derecha)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  const expNum = expediente.numero_expediente_clinico || 'N/A'
  const expWidth = doc.getTextWidth(expNum)
  doc.text(expNum, PAGE.width - PAGE.marginRight - expWidth, 22)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const fecha = new Date().toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
  const fechaWidth = doc.getTextWidth(fecha)
  doc.text(fecha, PAGE.width - PAGE.marginRight - fechaWidth, 30)

  return 52 // Y position after header
}

/**
 * Dibuja una sección con título
 */
function drawSectionTitle(doc, title, y) {
  if (y > PAGE.height - 40) {
    doc.addPage()
    y = PAGE.marginTop
  }

  doc.setFillColor(...COLORS.primary)
  doc.rect(PAGE.marginLeft, y, 3, 8, 'F')

  doc.setTextColor(...COLORS.dark)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(title, PAGE.marginLeft + 7, y + 6.5)

  // Línea debajo
  doc.setDrawColor(...COLORS.tableBorder)
  doc.setLineWidth(0.3)
  doc.line(PAGE.marginLeft, y + 10, PAGE.width - PAGE.marginRight, y + 10)

  return y + 15
}

/**
 * Dibuja una fila de datos key:value en formato tabla
 */
function drawDataRow(doc, label, value, y, options = {}) {
  if (y > PAGE.height - PAGE.marginBottom - 10) {
    doc.addPage()
    y = PAGE.marginTop
  }

  const { labelWidth = 55, highlight = false } = options

  // Background alternado
  if (options.stripe) {
    doc.setFillColor(...COLORS.tableStripe)
    doc.rect(PAGE.marginLeft, y - 4, contentWidth, 7, 'F')
  }

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)
  doc.text(label + ':', PAGE.marginLeft + 3, y)

  doc.setFont('helvetica', 'normal')
  if (highlight) {
    doc.setTextColor(...(highlight === 'success' ? COLORS.success :
                         highlight === 'danger' ? COLORS.danger :
                         COLORS.warning))
  } else {
    doc.setTextColor(...COLORS.text)
  }

  const valueText = String(value || 'N/A')
  const maxWidth = contentWidth - labelWidth - 6
  const lines = doc.splitTextToSize(valueText, maxWidth)
  doc.text(lines, PAGE.marginLeft + labelWidth, y)

  return y + (lines.length * 5) + 2
}

/**
 * Dibuja tabla de dos columnas con pares key-value
 */
function drawDataGrid(doc, pairs, startY) {
  let y = startY
  const colWidth = contentWidth / 2

  for (let i = 0; i < pairs.length; i += 2) {
    if (y > PAGE.height - PAGE.marginBottom - 10) {
      doc.addPage()
      y = PAGE.marginTop
    }

    // Stripe
    if (Math.floor(i / 2) % 2 === 0) {
      doc.setFillColor(...COLORS.tableStripe)
      doc.rect(PAGE.marginLeft, y - 4, contentWidth, 7, 'F')
    }

    // Left column
    const left = pairs[i]
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.dark)
    doc.text(left.label + ':', PAGE.marginLeft + 3, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.text)
    doc.text(String(left.value || 'N/A'), PAGE.marginLeft + 38, y)

    // Right column
    if (pairs[i + 1]) {
      const right = pairs[i + 1]
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...COLORS.dark)
      doc.text(right.label + ':', PAGE.marginLeft + colWidth + 3, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.text)
      doc.text(String(right.value || 'N/A'), PAGE.marginLeft + colWidth + 38, y)
    }

    y += 7
  }

  return y + 2
}

/**
 * Dibuja la tabla de estudios preoperatorios
 */
function drawStudiesTable(doc, estudios, startY) {
  let y = startY

  if (y > PAGE.height - 60) {
    doc.addPage()
    y = PAGE.marginTop
  }

  // Encabezado de la tabla
  const colWidths = [45, 30, 45, 50]
  const headers = ['Tipo de Estudio', 'Estado', 'Resultado', 'Observaciones']

  doc.setFillColor(...COLORS.tableHeader)
  doc.rect(PAGE.marginLeft, y - 4, contentWidth, 8, 'F')
  doc.setDrawColor(...COLORS.tableBorder)
  doc.rect(PAGE.marginLeft, y - 4, contentWidth, 8, 'S')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.dark)

  let xPos = PAGE.marginLeft + 2
  headers.forEach((header, i) => {
    doc.text(header, xPos, y)
    xPos += colWidths[i]
  })

  y += 7

  // Filas de estudios
  const prettyTipo = (tipo) => {
    if (tipo === 'imagen') return 'Imagenología'
    if (tipo === 'cardiograma') return 'Cardiograma'
    if (tipo === 'laboratorio') return 'Laboratorio'
    return tipo
  }

  const getEstadoLabel = (estudio) => {
    if (estudio?.estado) return estudio.estado
    if (estudio?.valido) return 'validado'
    return 'pendiente'
  }

  const requiredTypes = ['laboratorio', 'cardiograma', 'imagen']

  requiredTypes.forEach((tipo, idx) => {
    if (y > PAGE.height - PAGE.marginBottom - 10) {
      doc.addPage()
      y = PAGE.marginTop
    }

    const estudio = estudios
      ? [...estudios].reverse().find(e => String(e.tipo || '').toLowerCase() === tipo)
      : null

    const estado = getEstadoLabel(estudio)

    // Stripe
    if (idx % 2 === 0) {
      doc.setFillColor(...COLORS.tableStripe)
      doc.rect(PAGE.marginLeft, y - 4, contentWidth, 7, 'F')
    }

    doc.setDrawColor(...COLORS.tableBorder)
    doc.rect(PAGE.marginLeft, y - 4, contentWidth, 7, 'S')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')

    xPos = PAGE.marginLeft + 2

    // Tipo
    doc.setTextColor(...COLORS.text)
    doc.text(prettyTipo(tipo), xPos, y)
    xPos += colWidths[0]

    // Estado (con color)
    const estadoColor = estado === 'validado' ? COLORS.success :
                        estado === 'rechazado' ? COLORS.danger :
                        estado === 'realizado' ? [46, 213, 115] :
                        COLORS.warning
    doc.setTextColor(...estadoColor)
    doc.setFont('helvetica', 'bold')
    doc.text(estado.toUpperCase(), xPos, y)
    xPos += colWidths[1]

    // Resultado
    doc.setTextColor(...COLORS.text)
    doc.setFont('helvetica', 'normal')
    const resultado = estudio?.resultado || 'Pendiente'
    doc.text(resultado.substring(0, 30), xPos, y)
    xPos += colWidths[2]

    // Observaciones
    const obs = estudio?.observaciones || '-'
    doc.text(obs.substring(0, 35), xPos, y)

    y += 7
  })

  return y + 3
}

/**
 * Dibuja el pie de página
 */
function drawFooter(doc) {
  const totalPages = doc.internal.getNumberOfPages()

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    // Línea
    doc.setDrawColor(...COLORS.tableBorder)
    doc.setLineWidth(0.3)
    doc.line(PAGE.marginLeft, PAGE.height - 18, PAGE.width - PAGE.marginRight, PAGE.height - 18)

    // Texto izquierda
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.lightGray)
    doc.text('Sistema Hospitalario – Documento generado electrónicamente', PAGE.marginLeft, PAGE.height - 13)
    doc.text('Este documento es de uso interno y confidencial.', PAGE.marginLeft, PAGE.height - 9)

    // Página derecha
    const pageText = `Página ${i} de ${totalPages}`
    const pageWidth = doc.getTextWidth(pageText)
    doc.text(pageText, PAGE.width - PAGE.marginRight - pageWidth, PAGE.height - 13)
  }
}

const formatDate = (value) => {
  if (!value) return 'N/A'
  const d = String(value).split('T')[0]
  if (!d || d === 'None') return 'N/A'
  try {
    const [year, month, day] = d.split('-')
    return `${day}/${month}/${year}`
  } catch {
    return d
  }
}

const formatTurno = (turno) => {
  if (turno === 'manana') return 'Mañana'
  if (turno === 'tarde') return 'Tarde'
  if (turno === 'noche') return 'Noche'
  return turno || 'N/A'
}

/**
 * Genera y descarga el PDF del expediente clínico
 */
export function generarPDFExpediente(expediente) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  let y = drawHeader(doc, expediente)

  // ── DATOS DEL PACIENTE ──
  y = drawSectionTitle(doc, 'Datos del Paciente', y)
  y = drawDataGrid(doc, [
    { label: 'Nombre', value: expediente.nombre },
    { label: 'Paciente ID', value: expediente.paciente_id },
    { label: 'Sexo', value: expediente.sexo },
    { label: 'Edad', value: expediente.edad_anos ? `${expediente.edad_anos} años` : 'N/A' },
    { label: 'Nacimiento', value: formatDate(expediente.fecha_nacimiento) },
    { label: 'Expediente', value: expediente.numero_expediente_clinico },
  ], y)

  y += 2

  // ── INFORMACIÓN HOSPITALARIA ──
  y = drawSectionTitle(doc, 'Información Hospitalaria', y)
  y = drawDataGrid(doc, [
    { label: 'Procedencia', value: expediente.procedencia },
    { label: 'Destino', value: expediente.destino_paciente },
    { label: 'Ingreso', value: formatDate(expediente.fecha_ingreso_hospital) },
    { label: 'Solicitud Int.', value: formatDate(expediente.fecha_solicitud_intervencion) },
  ], y)

  if (expediente.alergias && expediente.alergias.length > 0) {
    y = drawDataRow(doc, 'Alergias', expediente.alergias.join(', '), y, { highlight: 'danger' })
  }

  y += 2

  // ── INFORMACIÓN QUIRÚRGICA ──
  const esAlta = String(expediente.destino_paciente || '').toLowerCase() === 'alta'

  if (!esAlta) {
    y = drawSectionTitle(doc, 'Información Quirúrgica', y)
    y = drawDataGrid(doc, [
      { label: 'División', value: expediente.division_quirurgica },
      { label: 'Complejidad', value: expediente.tipo_cirugia_complejidad },
      { label: 'Urgencia', value: expediente.tipo_cirugia_urgencia },
      { label: 'Turno', value: formatTurno(expediente.turno_asignado) },
      { label: 'Cirujano', value: expediente.responsable_cirugia },
      { label: 'Anestesiólogo', value: expediente.responsable_anestesia },
      { label: 'Hora', value: `${expediente.hora_inicio_cirugia || '--:--'} - ${expediente.hora_fin_cirugia || '--:--'}` },
      { label: 'Quirófano', value: expediente.quirofano_id ? `Q${expediente.quirofano_id}` : 'Pendiente' },
      { label: 'Fecha Cirugía', value: formatDate(expediente.fecha_cirugia) },
      { label: 'Estado', value: expediente.estado_cirugia || 'Pendiente' },
    ], y)

    y += 2
  }

  // ── DIAGNÓSTICO ──
  y = drawSectionTitle(doc, 'Diagnóstico', y)
  y = drawDataRow(doc, 'Dx Preoperatorio', expediente.diagnostico_preoperatorio, y, { labelWidth: 42 })

  if (expediente.diagnostico_postoperatorio) {
    y = drawDataRow(doc, 'Dx Postoperatorio', expediente.diagnostico_postoperatorio, y, { labelWidth: 42 })
  }

  if (expediente.observaciones) {
    y = drawDataRow(doc, 'Observaciones', expediente.observaciones, y, { labelWidth: 42 })
  }

  y += 3

  // ── ESTUDIOS PREOPERATORIOS ──
  if (!esAlta) {
    y = drawSectionTitle(doc, 'Estudios Preoperatorios', y)

    // Semáforo de aptitud
    const estudios = expediente.estudios || []
    const validados = estudios.filter(e =>
      String(e.estado || '').toLowerCase() === 'validado' || e.valido
    ).length
    const rechazados = estudios.filter(e =>
      String(e.estado || '').toLowerCase() === 'rechazado'
    ).length

    let aptitudLabel, aptitudColor
    if (validados >= 3) {
      aptitudLabel = 'APTO PARA CIRUGÍA'
      aptitudColor = COLORS.success
    } else if (rechazados > 0) {
      aptitudLabel = 'NO APTO – ESTUDIO RECHAZADO'
      aptitudColor = COLORS.danger
    } else {
      aptitudLabel = 'EN REVISIÓN – FALTAN ESTUDIOS'
      aptitudColor = COLORS.warning
    }

    doc.setFillColor(...aptitudColor)
    doc.roundedRect(PAGE.marginLeft, y - 4, contentWidth, 9, 2, 2, 'F')
    doc.setTextColor(...COLORS.white)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    const aptWidth = doc.getTextWidth(aptitudLabel)
    doc.text(aptitudLabel, PAGE.marginLeft + (contentWidth - aptWidth) / 2, y + 1)

    y += 12

    y = drawStudiesTable(doc, expediente.estudios, y)
  } else {
    y = drawSectionTitle(doc, 'Resolución', y)
    y = drawDataRow(doc, 'Destino', 'Alta médica – Cirugía no requerida', y, { highlight: 'success', labelWidth: 30 })
  }

  // ── FIRMAS ──
  y += 10
  if (y > PAGE.height - 50) {
    doc.addPage()
    y = PAGE.marginTop + 10
  }

  doc.setDrawColor(...COLORS.tableBorder)
  doc.setLineWidth(0.3)

  // Firma izquierda
  const firmaY = y + 15
  doc.line(PAGE.marginLeft + 5, firmaY, PAGE.marginLeft + 70, firmaY)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.lightGray)
  doc.text('Firma del Médico Responsable', PAGE.marginLeft + 12, firmaY + 5)

  // Firma derecha
  doc.line(PAGE.width - PAGE.marginRight - 70, firmaY, PAGE.width - PAGE.marginRight - 5, firmaY)
  doc.text('Firma del Paciente / Responsable', PAGE.width - PAGE.marginRight - 66, firmaY + 5)

  // ── PIE DE PÁGINA ──
  drawFooter(doc)

  // Descargar
  const filename = `Expediente_${expediente.numero_expediente_clinico || expediente.id}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
