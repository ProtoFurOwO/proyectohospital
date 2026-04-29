function LogConsole({ logs }) {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="log-console">
        <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
          Los logs de ejecucion apareceran aqui
        </div>
      </div>
    )
  }

  return (
    <div className="log-console">
      {logs.slice().reverse().map((log, index) => (
        <div key={index} className="log-entry">
          <span className="log-time">{formatTime(log.timestamp)}</span>
          <span className={`log-level ${log.level}`}>[{log.level}]</span>
          <span className="log-message">{log.message}</span>
          {log.query && (
            <span className="log-query">{log.query}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export default LogConsole
