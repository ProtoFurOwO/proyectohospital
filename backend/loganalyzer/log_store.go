package loganalyzer

import (
	"strings"
	"sync"
	"time"
)

// LogEntry es un registro almacenado en memoria.
type LogEntry struct {
	ID        int        `json:"id"`
	Raw       string     `json:"raw"`
	Tokens    []LogToken `json:"tokens"`
	Estado    string     `json:"estado"`
	Categoria string     `json:"categoria"`
	Message   string     `json:"message"`
	Timestamp string     `json:"timestamp"`
}

// LogStore almacena logs analizados en memoria con acceso concurrente seguro.
type LogStore struct {
	mu      sync.RWMutex
	entries []LogEntry
	nextID  int
}

// NewLogStore crea un almacén vacío.
func NewLogStore() *LogStore {
	return &LogStore{
		entries: make([]LogEntry, 0),
		nextID:  1,
	}
}

// Process recibe una cadena cruda, la tokeniza, la parsea y la almacena.
func (s *LogStore) Process(raw string) LogEntry {
	// Fase 1: Análisis Léxico
	lexer := NewLogLexer(raw)
	tokens := lexer.Tokenize()

	// Fase 2: Análisis Sintáctico
	parser := NewLogParser(tokens)
	result := parser.Parse()

	// Fase 3: Almacenar
	s.mu.Lock()
	defer s.mu.Unlock()

	categoria := clasificarLog(raw)

	entry := LogEntry{
		ID:        s.nextID,
		Raw:       raw,
		Tokens:    tokens,
		Estado:    result.Estado,
		Categoria: categoria,
		Message:   result.Message,
		Timestamp: time.Now().Format(time.RFC3339),
	}

	s.nextID++
	s.entries = append(s.entries, entry)

	return entry
}

func clasificarLog(raw string) string {
	upper := strings.ToUpper(raw)

	dangerIndicators := []string{
		" OR 1=1",
		" OR '1'='1",
		" UNION ",
		"DROP DATABASE",
		"DROP TABLE",
		"TRUNCATE",
		"ALTER TABLE",
		";--",
		"-- ",
		"/*",
		"*/",
		"XP_",
		"SLEEP(",
		"BENCHMARK(",
	}

	for _, indicator := range dangerIndicators {
		if strings.Contains(upper, indicator) {
			return "PELIGRO"
		}
	}

	return "GENERICA"
}

// GetAll retorna todos los logs almacenados (más recientes primero).
func (s *LogStore) GetAll() []LogEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Devolver copia en orden inverso (más reciente primero)
	result := make([]LogEntry, len(s.entries))
	for i, entry := range s.entries {
		result[len(s.entries)-1-i] = entry
	}

	return result
}

// Clear limpia todos los logs.
func (s *LogStore) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = make([]LogEntry, 0)
	s.nextID = 1
}

// Count retorna el total de logs almacenados.
func (s *LogStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.entries)
}
