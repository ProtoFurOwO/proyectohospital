// Centralizar URLs de API para produccion vs desarrollo
// En dev: apunta a localhost:80XX
// En prod: .env.production define rutas relativas /api/v1/... que Nginx proxea

export const API = {
  citas:       import.meta.env.VITE_API_CITAS       || 'http://localhost:8001',
  expedientes: import.meta.env.VITE_API_EXPEDIENTES  || 'http://localhost:8002',
  quirofanos:  import.meta.env.VITE_API_QUIROFANOS   || 'http://localhost:8003',
  personal:    import.meta.env.VITE_API_PERSONAL     || 'http://localhost:8005',
  compiler:    import.meta.env.VITE_API_COMPILER     || 'http://localhost:8006',
  login:       import.meta.env.VITE_API_LOGIN        || 'http://localhost:8006/api/login',
}
