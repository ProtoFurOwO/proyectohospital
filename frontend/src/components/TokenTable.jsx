function TokenTable({ tokens }) {
  if (!tokens || tokens.length === 0) {
    return (
      <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
        Escribe una consulta SQL para ver los tokens
      </div>
    )
  }

  // Filtrar EOF
  const visibleTokens = tokens.filter(t => t.type !== 'eof')

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="token-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Token</th>
            <th>Tipo</th>
            <th>Linea</th>
            <th>Columna</th>
          </tr>
        </thead>
        <tbody>
          {visibleTokens.map((token, index) => (
            <tr key={index}>
              <td style={{ color: '#666' }}>{index + 1}</td>
              <td style={{ fontFamily: 'Consolas', fontWeight: '600' }}>
                {token.value || '(vacio)'}
              </td>
              <td>
                <span className={`token-type ${token.type}`}>
                  {token.type}
                </span>
              </td>
              <td style={{ color: '#888' }}>{token.line}</td>
              <td style={{ color: '#888' }}>{token.column}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TokenTable
