package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"hospital-system/compiler"
	"hospital-system/internal/models"
)

// QuirofanoService maneja el estado de los quirófanos
type QuirofanoService struct {
	quirofanos map[int]*models.Quirofano
	mu         sync.RWMutex
}

// SQLService maneja el motor SQL
type SQLService struct {
	executor *compiler.Executor
}

var (
	quirofanoSvc *QuirofanoService
	sqlSvc       *SQLService
)

func init() {
	// Inicializar 30 quirófanos
	quirofanoSvc = &QuirofanoService{
		quirofanos: make(map[int]*models.Quirofano),
	}
	for i := 1; i <= 30; i++ {
		quirofanoSvc.quirofanos[i] = &models.Quirofano{
			ID:     i,
			Numero: i,
			Estado: models.Disponible,
		}
	}

	// Inicializar Motor SQL
	sqlSvc = &SQLService{
		executor: compiler.NewExecutor(),
	}
}

func main() {
	// CORS middleware
	corsMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}

			next(w, r)
		}
	}

	// Rutas de Quirófanos
	http.HandleFunc("/quirofanos", corsMiddleware(handleQuirofanos))
	http.HandleFunc("/quirofanos/", corsMiddleware(handleQuirofanoAction))

	// Rutas del Motor SQL
	http.HandleFunc("/sql/execute", corsMiddleware(handleSQLExecute))
	http.HandleFunc("/sql/tokenize", corsMiddleware(handleSQLTokenize))
	http.HandleFunc("/sql/logs", corsMiddleware(handleSQLLogs))

	// Health check
	http.HandleFunc("/health", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "quirofanos"})
	}))

	log.Println("🏥 Servicio de Quirófanos iniciado en puerto 8003")
	log.Println("📊 Motor SQL disponible en /sql/execute")
	log.Fatal(http.ListenAndServe(":8003", nil))
}

// ================= HANDLERS DE QUIRÓFANOS =================

func handleQuirofanos(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	quirofanoSvc.mu.RLock()
	defer quirofanoSvc.mu.RUnlock()

	quirofanos := make([]*models.Quirofano, 0, len(quirofanoSvc.quirofanos))
	for _, q := range quirofanoSvc.quirofanos {
		quirofanos = append(quirofanos, q)
	}

	json.NewEncoder(w).Encode(quirofanos)
}

func handleQuirofanoAction(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Parsear /quirofanos/{id}/{action}
	path := r.URL.Path[len("/quirofanos/"):]
	parts := splitPath(path)

	if len(parts) < 1 {
		http.Error(w, "ID de quirófano requerido", http.StatusBadRequest)
		return
	}

	id, err := strconv.Atoi(parts[0])
	if err != nil {
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	if len(parts) == 1 {
		// GET /quirofanos/{id}
		handleGetQuirofano(w, r, id)
		return
	}

	action := parts[1]

	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	switch action {
	case "iniciar":
		handleIniciarCirugia(w, r, id)
	case "terminar":
		handleTerminarCirugia(w, r, id)
	case "limpiar":
		handleLimpiezaLista(w, r, id)
	case "urgencia":
		handleUrgencia(w, r, id)
	default:
		http.Error(w, "Acción no reconocida", http.StatusBadRequest)
	}
}

func handleGetQuirofano(w http.ResponseWriter, r *http.Request, id int) {
	quirofanoSvc.mu.RLock()
	defer quirofanoSvc.mu.RUnlock()

	q, exists := quirofanoSvc.quirofanos[id]
	if !exists {
		http.Error(w, "Quirófano no encontrado", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(q)
}

type IniciarRequest struct {
	MedicoID     int    `json:"medico_id"`
	MedicoNombre string `json:"medico_nombre"`
	Especialidad string `json:"especialidad"`
	EsUrgencia   bool   `json:"es_urgencia"`
}

func handleIniciarCirugia(w http.ResponseWriter, r *http.Request, id int) {
	quirofanoSvc.mu.Lock()
	defer quirofanoSvc.mu.Unlock()

	q, exists := quirofanoSvc.quirofanos[id]
	if !exists {
		http.Error(w, "Quirófano no encontrado", http.StatusNotFound)
		return
	}

	if q.Estado != models.Disponible {
		http.Error(w, "Quirófano no disponible", http.StatusConflict)
		return
	}

	var req IniciarRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Si no hay body, usar valores por defecto
		req = IniciarRequest{
			MedicoNombre: "Dr. García",
			Especialidad: "General",
		}
	}

	now := time.Now()
	fin := now.Add(3 * time.Hour) // 3 horas de operación

	q.Estado = models.Ocupado
	q.MedicoID = &req.MedicoID
	q.MedicoNombre = req.MedicoNombre
	q.Especialidad = req.Especialidad
	q.InicioOperacion = &now
	q.FinEstimado = &fin
	q.EsUrgencia = req.EsUrgencia

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Cirugía iniciada",
		"data":    q,
	})
}

func handleTerminarCirugia(w http.ResponseWriter, r *http.Request, id int) {
	quirofanoSvc.mu.Lock()
	defer quirofanoSvc.mu.Unlock()

	q, exists := quirofanoSvc.quirofanos[id]
	if !exists {
		http.Error(w, "Quirófano no encontrado", http.StatusNotFound)
		return
	}

	if q.Estado != models.Ocupado {
		http.Error(w, "No hay cirugía en curso", http.StatusConflict)
		return
	}

	// Cambiar a limpieza (1 hora)
	now := time.Now()
	fin := now.Add(1 * time.Hour)

	q.Estado = models.Limpieza
	q.MedicoID = nil
	q.MedicoNombre = ""
	q.Especialidad = ""
	q.InicioOperacion = &now
	q.FinEstimado = &fin
	q.EsUrgencia = false

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Cirugía terminada. Iniciando limpieza.",
		"data":    q,
	})
}

func handleLimpiezaLista(w http.ResponseWriter, r *http.Request, id int) {
	quirofanoSvc.mu.Lock()
	defer quirofanoSvc.mu.Unlock()

	q, exists := quirofanoSvc.quirofanos[id]
	if !exists {
		http.Error(w, "Quirófano no encontrado", http.StatusNotFound)
		return
	}

	if q.Estado != models.Limpieza {
		http.Error(w, "El quirófano no está en limpieza", http.StatusConflict)
		return
	}

	q.Estado = models.Disponible
	q.InicioOperacion = nil
	q.FinEstimado = nil

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Limpieza completada. Quirófano disponible.",
		"data":    q,
	})
}

func handleUrgencia(w http.ResponseWriter, r *http.Request, id int) {
	quirofanoSvc.mu.Lock()
	defer quirofanoSvc.mu.Unlock()

	// Buscar primer quirófano disponible o próximo a terminar limpieza
	var targetQ *models.Quirofano

	// Primero buscar disponibles
	for _, q := range quirofanoSvc.quirofanos {
		if q.Estado == models.Disponible {
			targetQ = q
			break
		}
	}

	// Si no hay disponibles, buscar el que esté por terminar limpieza
	if targetQ == nil {
		var earliest *models.Quirofano
		for _, q := range quirofanoSvc.quirofanos {
			if q.Estado == models.Limpieza {
				if earliest == nil || (q.FinEstimado != nil && earliest.FinEstimado != nil && q.FinEstimado.Before(*earliest.FinEstimado)) {
					earliest = q
				}
			}
		}
		targetQ = earliest
	}

	if targetQ == nil {
		http.Error(w, "No hay quirófanos disponibles para urgencia", http.StatusConflict)
		return
	}

	// Marcar como urgencia
	now := time.Now()
	fin := now.Add(3 * time.Hour)

	targetQ.Estado = models.Ocupado
	targetQ.MedicoNombre = "Equipo de Urgencias"
	targetQ.Especialidad = "Urgencias"
	targetQ.InicioOperacion = &now
	targetQ.FinEstimado = &fin
	targetQ.EsUrgencia = true

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "¡URGENCIA! Quirófano asignado.",
		"data":     targetQ,
		"urgencia": true,
	})
}

// ================= HANDLERS DE MOTOR SQL =================

type SQLRequest struct {
	Query string `json:"query"`
}

type SQLResponse struct {
	Success bool             `json:"success"`
	Message string           `json:"message"`
	Tokens  []compiler.Token `json:"tokens"`
	Data    interface{}      `json:"data,omitempty"`
}

func handleSQLExecute(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req SQLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	result, tokens := sqlSvc.executor.Execute(req.Query)

	response := SQLResponse{
		Success: result.Success,
		Message: result.Message,
		Tokens:  tokens,
		Data:    result.Data,
	}

	json.NewEncoder(w).Encode(response)
}

func handleSQLTokenize(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req SQLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	tokens := sqlSvc.executor.Tokenize(req.Query)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"tokens": tokens,
		"query":  req.Query,
	})
}

func handleSQLLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodDelete {
		sqlSvc.executor.ClearLogs()
		json.NewEncoder(w).Encode(map[string]string{"message": "Logs limpiados"})
		return
	}

	logs := sqlSvc.executor.GetLogs()
	json.NewEncoder(w).Encode(logs)
}

// Helper function
func splitPath(path string) []string {
	parts := make([]string, 0)
	current := ""
	for _, ch := range path {
		if ch == '/' {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}
