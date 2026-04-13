package compiler

import (
	"fmt"
	"time"
)

// ExecutionResult representa el resultado de ejecutar un comando
type ExecutionResult struct {
	Success   bool        `json:"success"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
	Duration  string      `json:"duration"`
}

// LogEntry representa una entrada en el log de ejecución
type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"` // INFO, SUCCESS, ERROR, WARNING
	Message   string    `json:"message"`
	Query     string    `json:"query"`
	Tokens    []Token   `json:"tokens,omitempty"`
}

// Executor ejecuta comandos SQL analizados
type Executor struct {
	analyzer *SemanticAnalyzer
	logs     []LogEntry
}

// NewExecutor crea un nuevo executor
func NewExecutor() *Executor {
	return &Executor{
		analyzer: NewSemanticAnalyzer(),
		logs:     make([]LogEntry, 0),
	}
}

// Execute ejecuta una consulta SQL completa
func (e *Executor) Execute(query string) (*ExecutionResult, []Token) {
	startTime := time.Now()

	// Fase 1: Análisis Léxico
	lexer := NewLexer(query)
	tokens := lexer.Tokenize()

	// Verificar tokens de error
	for _, token := range tokens {
		if token.Type == ERROR {
			result := &ExecutionResult{
				Success:   false,
				Message:   fmt.Sprintf("Error léxico: caracter no reconocido '%s' en línea %d, columna %d", token.Value, token.Line, token.Column),
				Timestamp: time.Now(),
				Duration:  time.Since(startTime).String(),
			}
			e.logError(query, result.Message, tokens)
			return result, tokens
		}
	}

	e.logInfo(query, "Análisis léxico completado", tokens)

	// Fase 2: Análisis Sintáctico
	parser := NewParser(tokens)
	ast, err := parser.Parse()
	if err != nil {
		result := &ExecutionResult{
			Success:   false,
			Message:   err.Error(),
			Timestamp: time.Now(),
			Duration:  time.Since(startTime).String(),
		}
		e.logError(query, result.Message, tokens)
		return result, tokens
	}

	e.logInfo(query, fmt.Sprintf("Análisis sintáctico completado: %s", ast.Type), tokens)

	// Fase 3: Análisis Semántico
	err = e.analyzer.Analyze(ast)
	if err != nil {
		result := &ExecutionResult{
			Success:   false,
			Message:   err.Error(),
			Timestamp: time.Now(),
			Duration:  time.Since(startTime).String(),
		}
		e.logError(query, result.Message, tokens)
		return result, tokens
	}

	e.logInfo(query, "Análisis semántico completado", tokens)

	// Fase 4: Ejecución
	result := e.executeAST(ast)
	result.Duration = time.Since(startTime).String()

	if result.Success {
		e.logSuccess(query, result.Message, tokens)
	} else {
		e.logError(query, result.Message, tokens)
	}

	return result, tokens
}

// Tokenize solo realiza el análisis léxico (para UI)
func (e *Executor) Tokenize(query string) []Token {
	lexer := NewLexer(query)
	return lexer.Tokenize()
}

func (e *Executor) executeAST(ast *ASTNode) *ExecutionResult {
	switch ast.Type {
	case CREATE_DATABASE:
		return e.executeCreateDatabase(ast)
	case CREATE_TABLE:
		return e.executeCreateTable(ast)
	case DROP_DATABASE:
		return e.executeDropDatabase(ast)
	case DROP_TABLE:
		return e.executeDropTable(ast)
	case USE_DATABASE:
		return e.executeUseDatabase(ast)
	case SHOW_DATABASES:
		return e.executeShowDatabases()
	case SHOW_TABLES:
		return e.executeShowTables()
	case INSERT:
		return e.executeInsert(ast)
	case SELECT:
		return e.executeSelect(ast)
	case UPDATE:
		return e.executeUpdate(ast)
	case DELETE:
		return e.executeDelete(ast)
	default:
		return &ExecutionResult{
			Success:   false,
			Message:   fmt.Sprintf("Operación no implementada: %s", ast.Type),
			Timestamp: time.Now(),
		}
	}
}

func (e *Executor) executeCreateDatabase(ast *ASTNode) *ExecutionResult {
	port := 5432 + len(e.analyzer.GetDatabases())
	engine := "PostgreSQL" // Por defecto

	e.analyzer.RegisterDatabase(ast.Name, port, engine)

	return &ExecutionResult{
		Success:   true,
		Message:   fmt.Sprintf("Base de datos '%s' creada exitosamente en puerto %d", ast.Name, port),
		Data:      map[string]interface{}{"name": ast.Name, "port": port, "engine": engine},
		Timestamp: time.Now(),
	}
}

func (e *Executor) executeCreateTable(ast *ASTNode) *ExecutionResult {
	e.analyzer.RegisterTable(ast.Name, ast.Columns)

	return &ExecutionResult{
		Success:   true,
		Message:   fmt.Sprintf("Tabla '%s' creada exitosamente con %d columnas", ast.Name, len(ast.Columns)),
		Timestamp: time.Now(),
	}
}

func (e *Executor) executeDropDatabase(ast *ASTNode) *ExecutionResult {
	// En producción, aquí se eliminaría la BD real
	return &ExecutionResult{
		Success:   true,
		Message:   fmt.Sprintf("Base de datos '%s' eliminada", ast.Name),
		Timestamp: time.Now(),
	}
}

func (e *Executor) executeDropTable(ast *ASTNode) *ExecutionResult {
	return &ExecutionResult{
		Success:   true,
		Message:   fmt.Sprintf("Tabla '%s' eliminada", ast.Name),
		Timestamp: time.Now(),
	}
}

func (e *Executor) executeUseDatabase(ast *ASTNode) *ExecutionResult {
	e.analyzer.SetCurrentDB(ast.Name)

	return &ExecutionResult{
		Success:   true,
		Message:   fmt.Sprintf("Base de datos cambiada a '%s'", ast.Name),
		Timestamp: time.Now(),
	}
}

func (e *Executor) executeShowDatabases() *ExecutionResult {
	databases := e.analyzer.GetDatabases()
	names := make([]string, 0, len(databases))
	for name := range databases {
		names = append(names, name)
	}

	return &ExecutionResult{
		Success:   true,
		Message:   fmt.Sprintf("Se encontraron %d bases de datos", len(names)),
		Data:      names,
		Timestamp: time.Now(),
	}
}

func (e *Executor) executeShowTables() *ExecutionResult {
	currentDB := e.analyzer.GetCurrentDB()
	databases := e.analyzer.GetDatabases()

	if db, exists := databases[currentDB]; exists {
		tables := make([]string, 0, len(db.Tables))
		for name := range db.Tables {
			tables = append(tables, name)
		}
		return &ExecutionResult{
			Success:   true,
			Message:   fmt.Sprintf("Se encontraron %d tablas en '%s'", len(tables), currentDB),
			Data:      tables,
			Timestamp: time.Now(),
		}
	}

	return &ExecutionResult{
		Success:   false,
		Message:   "No hay base de datos seleccionada",
		Timestamp: time.Now(),
	}
}

func (e *Executor) executeInsert(ast *ASTNode) *ExecutionResult {
	return &ExecutionResult{
		Success:   true,
		Message:   fmt.Sprintf("Registro insertado en '%s'", ast.Name),
		Timestamp: time.Now(),
	}
}

func (e *Executor) executeSelect(ast *ASTNode) *ExecutionResult {
	return &ExecutionResult{
		Success:   true,
		Message:   fmt.Sprintf("Consulta ejecutada en '%s'", ast.Name),
		Data:      []string{}, // Aquí irían los resultados reales
		Timestamp: time.Now(),
	}
}

func (e *Executor) executeUpdate(ast *ASTNode) *ExecutionResult {
	return &ExecutionResult{
		Success:   true,
		Message:   fmt.Sprintf("Registros actualizados en '%s'", ast.Name),
		Timestamp: time.Now(),
	}
}

func (e *Executor) executeDelete(ast *ASTNode) *ExecutionResult {
	return &ExecutionResult{
		Success:   true,
		Message:   fmt.Sprintf("Registros eliminados de '%s'", ast.Name),
		Timestamp: time.Now(),
	}
}

// Logging helpers
func (e *Executor) logInfo(query, message string, tokens []Token) {
	e.logs = append(e.logs, LogEntry{
		Timestamp: time.Now(),
		Level:     "INFO",
		Message:   message,
		Query:     query,
		Tokens:    tokens,
	})
}

func (e *Executor) logSuccess(query, message string, tokens []Token) {
	e.logs = append(e.logs, LogEntry{
		Timestamp: time.Now(),
		Level:     "SUCCESS",
		Message:   message,
		Query:     query,
		Tokens:    tokens,
	})
}

func (e *Executor) logError(query, message string, tokens []Token) {
	e.logs = append(e.logs, LogEntry{
		Timestamp: time.Now(),
		Level:     "ERROR",
		Message:   message,
		Query:     query,
		Tokens:    tokens,
	})
}

// GetLogs retorna los logs de ejecución
func (e *Executor) GetLogs() []LogEntry {
	return e.logs
}

// ClearLogs limpia los logs
func (e *Executor) ClearLogs() {
	e.logs = make([]LogEntry, 0)
}

// GetAnalyzer retorna el analizador semántico
func (e *Executor) GetAnalyzer() *SemanticAnalyzer {
	return e.analyzer
}
