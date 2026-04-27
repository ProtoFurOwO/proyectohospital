package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"

	"hospital-system/compiler"
	"hospital-system/loganalyzer"
)

//go:embed static/*
var staticFiles embed.FS

type SQLService struct {
	executor *compiler.Executor
}

type SQLRequest struct {
	Query string `json:"query"`
}

type SQLResponse struct {
	Success bool             `json:"success"`
	Message string           `json:"message"`
	Tokens  []compiler.Token `json:"tokens"`
	Data    interface{}      `json:"data,omitempty"`
}

// LogRequest es el body esperado en POST /logs
type LogRequest struct {
	Raw string `json:"raw"`
}

var logStore *loganalyzer.LogStore

func main() {
	sqlSvc := &SQLService{
		executor: compiler.NewExecutor(),
	}

	logStore = loganalyzer.NewLogStore()

	// Iniciar conexiones a DBs (Universal SQL Engine)
	compiler.InitDatabases()
	compiler.SeedSystemDatabases(sqlSvc.executor.GetAnalyzer())

	mux := http.NewServeMux()
	cors := corsMiddleware

	// ── Endpoints SQL existentes (sin cambios) ──
	mux.HandleFunc("/sql/execute", cors(sqlSvc.handleSQLExecute))
	mux.HandleFunc("/sql/tokenize", cors(sqlSvc.handleSQLTokenize))
	mux.HandleFunc("/sql/logs", cors(sqlSvc.handleSQLLogs))

	// ── Nuevos endpoints: Visor de Logs (Analizador Léxico/Sintáctico) ──
	mux.HandleFunc("/logs", cors(handleLogs))

	// ── Health ──
	mux.HandleFunc("/health", cors(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "compiler+loganalyzer",
		})
	}))

	// ── Archivos estáticos (UI SQL legacy) ──
	staticSub, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatalf("error cargando archivos estaticos: %v", err)
	}
	fileServer := http.FileServer(http.FS(staticSub))

	mux.HandleFunc("/", cors(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/", "/index.html", "/style.css", "/app.js":
			fileServer.ServeHTTP(w, r)
		default:
			http.NotFound(w, r)
		}
	}))

	log.Println("📊 Servicio de Compiladores + Log Analyzer iniciado en puerto 8006")
	log.Println("🌐 UI SQL disponible en http://localhost:8006")
	log.Println("🔧 API SQL en /sql/execute | Logs en POST/GET /logs")
	log.Fatal(http.ListenAndServe(":8006", mux))
}

// ═══════════════════════════════════════════════════════════════
//  HANDLER: /logs  (POST para recibir, GET para listar, DELETE para limpiar)
// ═══════════════════════════════════════════════════════════════

func handleLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodPost:
		handleLogPost(w, r)
	case http.MethodGet:
		handleLogGet(w, r)
	case http.MethodDelete:
		handleLogDelete(w, r)
	default:
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
	}
}

func handleLogPost(w http.ResponseWriter, r *http.Request) {
	var req LogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Raw == "" {
		http.Error(w, `{"error":"Se requiere el campo 'raw' con la cadena de log"}`, http.StatusBadRequest)
		return
	}

	entry := logStore.Process(req.Raw)

	log.Printf("📝 Log #%d [%s]: %s", entry.ID, entry.Estado, entry.Raw)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"entry":   entry,
	})
}

func handleLogGet(w http.ResponseWriter, r *http.Request) {
	entries := logStore.GetAll()

	// Contar válidos e inválidos para estadísticas
	valid := 0
	invalid := 0
	for _, e := range entries {
		if e.Estado == "Válido" {
			valid++
		} else {
			invalid++
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"total":   len(entries),
		"valid":   valid,
		"invalid": invalid,
		"entries": entries,
	})
}

func handleLogDelete(w http.ResponseWriter, r *http.Request) {
	logStore.Clear()
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Logs limpiados",
	})
}

// ═══════════════════════════════════════════════════════════════
//  CORS Middleware
// ═══════════════════════════════════════════════════════════════

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// ═══════════════════════════════════════════════════════════════
//  Handlers SQL existentes (sin cambios)
// ═══════════════════════════════════════════════════════════════

func (s *SQLService) handleSQLExecute(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Metodo no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req SQLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}

	result, tokens := s.executor.Execute(req.Query)

	response := SQLResponse{
		Success: result.Success,
		Message: result.Message,
		Tokens:  tokens,
		Data:    result.Data,
	}

	json.NewEncoder(w).Encode(response)
}

func (s *SQLService) handleSQLTokenize(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Metodo no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req SQLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON invalido", http.StatusBadRequest)
		return
	}

	tokens := s.executor.Tokenize(req.Query)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"tokens": tokens,
		"query":  req.Query,
	})
}

func (s *SQLService) handleSQLLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		logs := s.executor.GetLogs()
		json.NewEncoder(w).Encode(logs)
	case http.MethodDelete:
		s.executor.ClearLogs()
		json.NewEncoder(w).Encode(map[string]string{"message": "Logs limpiados"})
	default:
		http.Error(w, "Metodo no permitido", http.StatusMethodNotAllowed)
	}
}
