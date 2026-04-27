package loganalyzer

import "fmt"

// ParseResult contiene el resultado del análisis sintáctico.
type ParseResult struct {
	Valid   bool   `json:"valid"`
	Estado  string `json:"estado"`
	Message string `json:"message"`
}

// LogParser es el analizador sintáctico que valida el orden de tokens.
//
// Gramática esperada:
//
//	<LOG> → <NIVEL> <MODULO> <ACCION> <ENTIDAD> <VALOR>
type LogParser struct {
	tokens []LogToken
	pos    int
}

// NewLogParser crea un parser con los tokens producidos por el lexer.
func NewLogParser(tokens []LogToken) *LogParser {
	return &LogParser{
		tokens: tokens,
		pos:    0,
	}
}

// Parse valida que los tokens cumplan estrictamente con la gramática.
func (p *LogParser) Parse() ParseResult {
	if len(p.tokens) == 0 {
		return ParseResult{
			Valid:   false,
			Estado:  "Sintaxis Inválida",
			Message: "La cadena está vacía, no se generaron tokens.",
		}
	}

	// Regla 1: El primer token debe ser <NIVEL>
	if err := p.expect(TokenNivel, "NIVEL ([INFO], [WARN] o [ERROR])"); err != nil {
		return *err
	}

	// Regla 2: El segundo token debe ser <MODULO>
	if err := p.expect(TokenModulo, "MODULO ([CITAS], [EXPEDIENTES], [QUIROFANOS] o [PERSONAL])"); err != nil {
		return *err
	}

	// Regla 3: El tercer token debe ser <ACCION>
	if err := p.expect(TokenAccion, "ACCION (CREATE, UPDATE, ASSIGN o DELETE)"); err != nil {
		return *err
	}

	// Regla 4: El cuarto token debe ser <ENTIDAD>
	if err := p.expect(TokenEntidad, "ENTIDAD (PACIENTE, TURNO, EXPEDIENTE o QUIROFANO)"); err != nil {
		return *err
	}

	// Regla 5: Debe existir al menos un <VALOR>
	if p.pos >= len(p.tokens) {
		return ParseResult{
			Valid:   false,
			Estado:  "Sintaxis Inválida",
			Message: "Se esperaba un <VALOR> después de la entidad, pero la cadena terminó.",
		}
	}

	// Todos los tokens restantes se consideran parte del VALOR (válido)
	return ParseResult{
		Valid:   true,
		Estado:  "Válido",
		Message: "La cadena cumple con la gramática: <NIVEL> <MODULO> <ACCION> <ENTIDAD> <VALOR>.",
	}
}

// expect verifica que el token en la posición actual sea del tipo esperado.
func (p *LogParser) expect(expected LogTokenType, description string) *ParseResult {
	if p.pos >= len(p.tokens) {
		result := ParseResult{
			Valid:   false,
			Estado:  "Sintaxis Inválida",
			Message: fmt.Sprintf("Se esperaba <%s> en la posición %d, pero la cadena terminó.", description, p.pos+1),
		}
		return &result
	}

	token := p.tokens[p.pos]
	if token.Type != expected {
		result := ParseResult{
			Valid:  false,
			Estado: "Sintaxis Inválida",
			Message: fmt.Sprintf(
				"Posición %d: se esperaba <%s>, pero se encontró '%s' (tipo %s).",
				p.pos+1, description, token.Value, token.Type,
			),
		}
		return &result
	}

	p.pos++
	return nil
}
