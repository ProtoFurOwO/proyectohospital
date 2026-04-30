import { useState, useEffect } from 'react'
import TokenTable from '../components/TokenTable'
import LogConsole from '../components/LogConsole'

const API_URL = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE : 'http://localhost:8006'

function SqlTerminal() {
  const [query, setQuery] = useState('CREATE DATABASE hospital;')
  const [tokens, setTokens] = useState([])
  const [logs, setLogs] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  // Tokenizar en tiempo real mientras escribe
  useEffect(() => {
    const tokenize = async () => {
      if (!query.trim()) {
        setTokens([])
        return
      }

      try {
        const response = await fetch(`${API_URL}/sql/tokenize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        })

        if (response.ok) {
          const data = await response.json()
          setTokens(data.tokens || [])
        }
      } catch (error) {
        // Silencioso - el backend puede no estar corriendo
      }
    }

    const debounce = setTimeout(tokenize, 300)
    return () => clearTimeout(debounce)
  }, [query])

  // Cargar logs iniciales
  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      const response = await fetch(`${API_URL}/sql/logs`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data || [])
      }
    } catch (error) {
      // Silencioso
    }
  }

  const executeQuery = async () => {
    if (!query.trim()) return

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch(`${API_URL}/sql/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })

      const data = await response.json()
      setResult(data)
      setTokens(data.tokens || [])

      // Actualizar logs
      await fetchLogs()
    } catch (error) {
      setResult({
        success: false,
        message: 'Error de conexion. Asegurate de que el backend este corriendo.'
      })
    } finally {
      setLoading(false)
    }
  }

  const clearLogs = async () => {
    try {
      await fetch(`${API_URL}/sql/logs`, { method: 'DELETE' })
      setLogs([])
    } catch (error) {
      // Silencioso
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      executeQuery()
    }
  }

  const exampleQueries = [
    'CREATE DATABASE hospital;',
    'CREATE DATABASE clinica;',
    'USE hospital;',
    'CREATE TABLE pacientes (id INT PRIMARY KEY, nombre VARCHAR NOT NULL);',
    'SHOW DATABASES;',
    'SHOW TABLES;'
  ]

  return (
    <div>
      <div style={{ marginBottom: '1rem', color: '#888', fontSize: '0.85rem' }}>
        Motor SQL separado - Analizador Lexico, Sintactico y Semantico
      </div>

      <div className="terminal-container">
        {/* Panel izquierdo - Input y Tokens */}
        <div className="terminal-panel">
          <div className="terminal-header">
            Editor SQL
          </div>

          <textarea
            className="sql-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu consulta SQL aqui..."
            spellCheck={false}
          />

          <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
            <button
              className="btn btn-success"
              onClick={executeQuery}
              disabled={loading || !query.trim()}
            >
              {loading ? 'Ejecutando...' : 'Ejecutar (Ctrl+Enter)'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setQuery('')}
            >
              Limpiar
            </button>
          </div>

          {/* Resultado */}
          {result && (
            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              background: result.success ? 'rgba(20,184,166,0.12)' : 'rgba(255,71,87,0.1)',
              border: `1px solid ${result.success ? '#14b8a6' : '#ff4757'}`
            }}>
              <div style={{
                fontWeight: '600',
                color: result.success ? '#14b8a6' : '#ff4757',
                marginBottom: '0.5rem'
              }}>
                {result.success ? 'EXITO' : 'ERROR'}
              </div>
              <div style={{ color: '#36546f' }}>{result.message}</div>
              {result.data && (
                <pre style={{
                  marginTop: '0.6rem',
                  background: 'rgba(10,120,181,0.06)',
                  borderRadius: '6px',
                  padding: '0.6rem',
                  color: '#1f435f',
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap'
                }}>
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Ejemplos */}
          <div style={{ marginTop: 'auto' }}>
            <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              Ejemplos rapidos:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {exampleQueries.map((eq, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(eq)}
                  style={{
                    background: '#e6f5ff',
                    border: '1px solid #0a78b5',
                    color: '#36546f',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    cursor: 'pointer'
                  }}
                >
                  {eq.length > 30 ? eq.substring(0, 30) + '...' : eq}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel derecho - Tokens y Logs */}
        <div className="terminal-panel">
          <div className="terminal-header">
            Tabla de Tokens (Analisis Lexico)
          </div>

          <div style={{ flex: 1, overflow: 'auto', marginBottom: '1rem' }}>
            <TokenTable tokens={tokens} />
          </div>

          <div className="terminal-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>Consola de Logs</span>
            <button
              onClick={clearLogs}
              style={{
                background: 'transparent',
                border: '1px solid #68819a',
                color: '#68819a',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.7rem',
                cursor: 'pointer'
              }}
            >
              Limpiar
            </button>
          </div>

          <LogConsole logs={logs} />
        </div>
      </div>
    </div>
  )
}

export default SqlTerminal
