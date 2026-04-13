package compiler

import (
	"fmt"
	"sync"
)

// SemanticError representa un error semántico
type SemanticError struct {
	Message string `json:"message"`
	Code    string `json:"code"`
}

func (e *SemanticError) Error() string {
	return fmt.Sprintf("Error semántico [%s]: %s", e.Code, e.Message)
}

// DatabaseInfo almacena información sobre una base de datos
type DatabaseInfo struct {
	Name   string                 `json:"name"`
	Port   int                    `json:"port"`
	Engine string                 `json:"engine"`
	Tables map[string][]ColumnDef `json:"tables"`
}

// SemanticAnalyzer es el analizador semántico
type SemanticAnalyzer struct {
	databases map[string]*DatabaseInfo
	currentDB string
	usedPorts map[int]string
	mu        sync.RWMutex
}

// NewSemanticAnalyzer crea un nuevo analizador semántico
func NewSemanticAnalyzer() *SemanticAnalyzer {
	return &SemanticAnalyzer{
		databases: make(map[string]*DatabaseInfo),
		usedPorts: make(map[int]string),
	}
}

// Analyze realiza el análisis semántico del AST
func (s *SemanticAnalyzer) Analyze(node *ASTNode) error {
	if node == nil {
		return &SemanticError{
			Message: "Nodo AST nulo",
			Code:    "NULL_AST",
		}
	}

	switch node.Type {
	case CREATE_DATABASE:
		return s.analyzeCreateDatabase(node)
	case CREATE_TABLE:
		return s.analyzeCreateTable(node)
	case DROP_DATABASE:
		return s.analyzeDropDatabase(node)
	case DROP_TABLE:
		return s.analyzeDropTable(node)
	case USE_DATABASE:
		return s.analyzeUseDatabase(node)
	case INSERT:
		return s.analyzeInsert(node)
	case SELECT:
		return s.analyzeSelect(node)
	case UPDATE:
		return s.analyzeUpdate(node)
	case DELETE:
		return s.analyzeDelete(node)
	case SHOW_DATABASES, SHOW_TABLES:
		return nil // Siempre válido
	default:
		return &SemanticError{
			Message: fmt.Sprintf("Tipo de nodo no soportado: %s", node.Type),
			Code:    "UNSUPPORTED_NODE",
		}
	}
}

func (s *SemanticAnalyzer) analyzeCreateDatabase(node *ASTNode) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Verificar si ya existe
	if _, exists := s.databases[node.Name]; exists {
		return &SemanticError{
			Message: fmt.Sprintf("La base de datos '%s' ya existe", node.Name),
			Code:    "DB_EXISTS",
		}
	}

	// Asignar puerto disponible
	port := s.findAvailablePort()
	if port == 0 {
		return &SemanticError{
			Message: "No hay puertos disponibles para crear la base de datos",
			Code:    "NO_PORTS",
		}
	}

	return nil
}

func (s *SemanticAnalyzer) analyzeCreateTable(node *ASTNode) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Verificar que hay una DB seleccionada
	if s.currentDB == "" {
		return &SemanticError{
			Message: "No hay base de datos seleccionada. Use 'USE nombre_db;' primero",
			Code:    "NO_DB_SELECTED",
		}
	}

	db := s.databases[s.currentDB]
	if db == nil {
		return &SemanticError{
			Message: fmt.Sprintf("Base de datos '%s' no encontrada", s.currentDB),
			Code:    "DB_NOT_FOUND",
		}
	}

	// Verificar si la tabla ya existe
	if _, exists := db.Tables[node.Name]; exists {
		return &SemanticError{
			Message: fmt.Sprintf("La tabla '%s' ya existe en '%s'", node.Name, s.currentDB),
			Code:    "TABLE_EXISTS",
		}
	}

	// Verificar que hay al menos una columna
	if len(node.Columns) == 0 {
		return &SemanticError{
			Message: "Una tabla debe tener al menos una columna",
			Code:    "NO_COLUMNS",
		}
	}

	// Verificar columnas duplicadas
	colNames := make(map[string]bool)
	for _, col := range node.Columns {
		if colNames[col.Name] {
			return &SemanticError{
				Message: fmt.Sprintf("Columna duplicada: '%s'", col.Name),
				Code:    "DUPLICATE_COLUMN",
			}
		}
		colNames[col.Name] = true
	}

	return nil
}

func (s *SemanticAnalyzer) analyzeDropDatabase(node *ASTNode) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, exists := s.databases[node.Name]; !exists {
		return &SemanticError{
			Message: fmt.Sprintf("La base de datos '%s' no existe", node.Name),
			Code:    "DB_NOT_FOUND",
		}
	}

	return nil
}

func (s *SemanticAnalyzer) analyzeDropTable(node *ASTNode) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.currentDB == "" {
		return &SemanticError{
			Message: "No hay base de datos seleccionada",
			Code:    "NO_DB_SELECTED",
		}
	}

	db := s.databases[s.currentDB]
	if db == nil {
		return &SemanticError{
			Message: fmt.Sprintf("Base de datos '%s' no encontrada", s.currentDB),
			Code:    "DB_NOT_FOUND",
		}
	}

	if _, exists := db.Tables[node.Name]; !exists {
		return &SemanticError{
			Message: fmt.Sprintf("La tabla '%s' no existe", node.Name),
			Code:    "TABLE_NOT_FOUND",
		}
	}

	return nil
}

func (s *SemanticAnalyzer) analyzeUseDatabase(node *ASTNode) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, exists := s.databases[node.Name]; !exists {
		return &SemanticError{
			Message: fmt.Sprintf("La base de datos '%s' no existe", node.Name),
			Code:    "DB_NOT_FOUND",
		}
	}

	return nil
}

func (s *SemanticAnalyzer) analyzeInsert(node *ASTNode) error {
	return s.checkTableExists(node.Name)
}

func (s *SemanticAnalyzer) analyzeSelect(node *ASTNode) error {
	return s.checkTableExists(node.Name)
}

func (s *SemanticAnalyzer) analyzeUpdate(node *ASTNode) error {
	return s.checkTableExists(node.Name)
}

func (s *SemanticAnalyzer) analyzeDelete(node *ASTNode) error {
	return s.checkTableExists(node.Name)
}

func (s *SemanticAnalyzer) checkTableExists(tableName string) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.currentDB == "" {
		return &SemanticError{
			Message: "No hay base de datos seleccionada",
			Code:    "NO_DB_SELECTED",
		}
	}

	db := s.databases[s.currentDB]
	if db == nil {
		return &SemanticError{
			Message: fmt.Sprintf("Base de datos '%s' no encontrada", s.currentDB),
			Code:    "DB_NOT_FOUND",
		}
	}

	if _, exists := db.Tables[tableName]; !exists {
		return &SemanticError{
			Message: fmt.Sprintf("La tabla '%s' no existe en '%s'", tableName, s.currentDB),
			Code:    "TABLE_NOT_FOUND",
		}
	}

	return nil
}

func (s *SemanticAnalyzer) findAvailablePort() int {
	// Puertos reservados para el sistema
	basePorts := []int{5432, 5433, 5434, 5435, 5436, 5437, 5438, 5439, 5440}

	for _, port := range basePorts {
		if _, used := s.usedPorts[port]; !used {
			return port
		}
	}
	return 0
}

// RegisterDatabase registra una nueva base de datos
func (s *SemanticAnalyzer) RegisterDatabase(name string, port int, engine string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.databases[name] = &DatabaseInfo{
		Name:   name,
		Port:   port,
		Engine: engine,
		Tables: make(map[string][]ColumnDef),
	}
	s.usedPorts[port] = name
}

// RegisterTable registra una nueva tabla
func (s *SemanticAnalyzer) RegisterTable(tableName string, columns []ColumnDef) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if db := s.databases[s.currentDB]; db != nil {
		db.Tables[tableName] = columns
	}
}

// SetCurrentDB establece la base de datos actual
func (s *SemanticAnalyzer) SetCurrentDB(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.currentDB = name
}

// GetDatabases retorna las bases de datos registradas
func (s *SemanticAnalyzer) GetDatabases() map[string]*DatabaseInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.databases
}

// GetCurrentDB retorna la base de datos actual
func (s *SemanticAnalyzer) GetCurrentDB() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.currentDB
}
