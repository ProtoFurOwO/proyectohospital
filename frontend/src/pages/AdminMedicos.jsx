import { useState, useEffect } from 'react'

const ESPECIALIDADES = [
  "Cirugia General", "Traumatologia", "Cardiologia",
  "Oftalmologia", "Neurologia", "Oncologia", "Pediatria", "Ginecologia"
]

export default function AdminMedicos() {
  const [medicos, setMedicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    nombre: '',
    especialidad: ESPECIALIDADES[0]
  })
  const [mensaje, setMensaje] = useState(null)

  const fetchMedicos = async () => {
    try {
      const res = await fetch('http://localhost:8005/personal/medicos')
      if (res.ok) {
        const data = await res.json()
        setMedicos(Array.isArray(data) ? data : [])
      } else {
        const data = await res.json().catch(() => null)
        setMensaje({ type: 'error', text: data?.detail || 'No se pudieron cargar los medicos' })
        setMedicos([])
      }
    } catch (err) {
      console.error("Error cargando medicos:", err)
      setMensaje({ type: 'error', text: 'Error de conexión al cargar' })
      setMedicos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMedicos()
  }, [])

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        nombre: formData.nombre,
        especialidad: formData.especialidad
      }
      const res = await fetch('http://localhost:8005/personal/medicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMensaje({ type: 'error', text: data?.detail || 'No se pudo registrar el medico' })
        return
      }
      if (data?.success) {
        setMensaje({ type: 'success', text: `Medico registrado con ID: ${data.id}` })
        setFormData({ nombre: '', especialidad: ESPECIALIDADES[0] })
        fetchMedicos() // Recargar lista
      } else {
        setMensaje({ type: 'error', text: data?.detail || 'No se pudo registrar el medico' })
      }
    } catch (err) {
      setMensaje({ type: 'error', text: 'Error de conexión al guardar' })
    }
    setTimeout(() => setMensaje(null), 3000)
  }

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este médico?")) return
    try {
      const res = await fetch(`http://localhost:8005/personal/medicos/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchMedicos()
      }
    } catch (err) {
      alert("Error al eliminar")
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">👨‍⚕️ Administración de Personal Médico</h2>
        <p className="card-description">Registra y gestiona los médicos de la clínica</p>
      </div>
      
      <div className="card-content" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* Formulario de Registro */}
        <div className="form-section">
          <h3 style={{ marginBottom: '1rem', color: 'var(--text)' }}>Nuevo Registro</h3>
          
          {mensaje && (
            <div className={`badge badge-${mensaje.type === 'success' ? 'info' : 'error'}`} style={{ marginBottom: '1rem', width: '100%', padding: '0.8rem' }}>
              {mensaje.text}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Nombre Completo</label>
              <input 
                type="text" 
                name="nombre" 
                className="input" 
                required 
                value={formData.nombre} 
                onChange={handleInputChange} 
                placeholder="Ej. Juan Perez"
              />
            </div>

            <div className="form-group">
              <label>Especialidad</label>
              <select name="especialidad" className="select" value={formData.especialidad} onChange={handleInputChange}>
                {ESPECIALIDADES.map(esp => <option key={esp} value={esp}>{esp}</option>)}
              </select>
            </div>

            <button type="submit" className="button button-primary">
              Registrar Médico
            </button>
          </form>
        </div>

        {/* Tabla de Médicos */}
        <div className="table-section" style={{ overflow: 'auto', maxHeight: '500px' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>ID</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Nombre</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Especialidad</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Turno</th>
                <th style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Cargando desde Redis...</td></tr>
              ) : medicos.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>No hay médicos registrados. ¡Agrega uno!</td></tr>
              ) : (
                medicos.map(medico => (
                  <tr key={medico.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem' }}>{medico.id}</td>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{medico.nombre}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span className="badge badge-info">{medico.especialidad}</span>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <span className="badge badge-warning">{medico.turno || 'pendiente'}</span>
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <button onClick={() => handleDelete(medico.id)} className="button button-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
