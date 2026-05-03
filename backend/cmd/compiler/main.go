package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"hospital-system/compiler"
	"hospital-system/loganalyzer"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte("super-secret-key-hospital")
var adminUser = "admin"
var adminPass = "hospital2026"

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

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

	// ── Auth Endpoint ──
	mux.HandleFunc("/api/login", cors(handleLogin))

	// ── Endpoints SQL existentes (protegidos con JWT) ──
	mux.HandleFunc("/sql/execute", cors(jwtMiddleware(sqlSvc.handleSQLExecute)))
	mux.HandleFunc("/sql/tokenize", cors(jwtMiddleware(sqlSvc.handleSQLTokenize)))
	mux.HandleFunc("/sql/logs", cors(jwtMiddleware(sqlSvc.handleSQLLogs)))

	// ── Nuevos endpoints: Visor de Logs (protegidos con JWT) ──
	mux.HandleFunc("/logs", cors(jwtMiddleware(handleLogs)))

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

	bindAddr := os.Getenv("BIND_ADDR")
	if bindAddr == "" {
		bindAddr = ":8006"
	}
	log.Printf("📊 Servicio de Compiladores + Log Analyzer iniciado en %s", bindAddr)
	log.Println("🔧 API SQL en /sql/execute | Logs en POST/GET /logs")
	log.Fatal(http.ListenAndServe(bindAddr, mux))
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
//  JWT Authentication
// ═══════════════════════════════════════════════════════════════

func handleLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"JSON invalido"}`, http.StatusBadRequest)
		return
	}

	if req.Username == adminUser && req.Password == adminPass {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": req.Username,
			"exp": time.Now().Add(time.Hour * 24).Unix(),
		})

		tokenString, err := token.SignedString(jwtSecret)
		if err != nil {
			http.Error(w, `{"error":"Error al generar token"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{
			"token": tokenString,
		})
		return
	}

	http.Error(w, `{"error":"Credenciales invalidas"}`, http.StatusUnauthorized)
}

func jwtMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"Falta Authorization header"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, `{"error":"Formato de token invalido"}`, http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("metodo de firma inesperado: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, `{"error":"Token invalido o expirado"}`, http.StatusUnauthorized)
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

	query := strings.TrimSpace(req.Query)
	if query != "" {
		compact := strings.Join(strings.Fields(query), " ")
		raw := fmt.Sprintf("[INFO] [SQL] QUERY CONSULTA %s", compact)
		logStore.Process(raw)
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
