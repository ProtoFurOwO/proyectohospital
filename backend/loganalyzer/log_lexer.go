package loganalyzer

import (
	"strings"
	"unicode"
)

// LogTokenType representa la categoría gramatical de un token de log.
type LogTokenType string

const (
	TokenNivel   LogTokenType = "NIVEL"
	TokenModulo  LogTokenType = "MODULO"
	TokenAccion  LogTokenType = "ACCION"
	TokenEntidad LogTokenType = "ENTIDAD"
	TokenValor   LogTokenType = "VALOR"
	TokenUnknown LogTokenType = "UNKNOWN"
)

// LogToken es un token producido por el analizador léxico.
type LogToken struct {
	Type   LogTokenType `json:"type"`
	Value  string       `json:"value"`
	Column int          `json:"column"`
}

// Vocabulario válido para cada categoría.
var nivelesValidos = map[string]bool{
	"INFO":  true,
	"WARN":  true,
	"ERROR": true,
}

var modulosValidos = map[string]bool{
	"CITAS":       true,
	"EXPEDIENTES": true,
	"QUIROFANOS":  true,
	"PERSONAL":    true,
	"SQL":         true,
}

var accionesValidas = map[string]bool{
	"CREATE": true,
	"UPDATE": true,
	"ASSIGN": true,
	"DELETE": true,
	"QUERY":  true,
}

var entidadesValidas = map[string]bool{
	"PACIENTE":   true,
	"TURNO":      true,
	"EXPEDIENTE": true,
	"QUIROFANO":  true,
	"MEDICO":     true,
	"INSUMO":     true,
	"CONSULTA":   true,
	"SQL":        true,
	"LOG":        true,
}

// LogLexer es el analizador léxico para cadenas de log.
type LogLexer struct {
	input  string
	pos    int
	column int
	tokens []LogToken
}

// NewLogLexer crea un nuevo lexer de logs.
func NewLogLexer(input string) *LogLexer {
	return &LogLexer{
		input:  input,
		pos:    0,
		column: 1,
		tokens: make([]LogToken, 0),
	}
}

// Tokenize analiza la cadena de entrada y retorna los tokens.
func (l *LogLexer) Tokenize() []LogToken {
	for l.pos < len(l.input) {
		l.skipWhitespace()
		if l.pos >= len(l.input) {
			break
		}

		ch := l.input[l.pos]

		// Token con brackets: [ALGO]
		if ch == '[' {
			l.readBracketToken()
			continue
		}

		// Palabra simple (acción, entidad, o valor)
		if unicode.IsLetter(rune(ch)) || unicode.IsDigit(rune(ch)) || ch == '_' {
			l.readWordToken()
			continue
		}

		// Carácter desconocido → lo captura como UNKNOWN
		col := l.column
		l.advance()
		l.tokens = append(l.tokens, LogToken{
			Type:   TokenUnknown,
			Value:  string(ch),
			Column: col,
		})
	}

	return l.tokens
}

// readBracketToken lee un token delimitado por [ ].
func (l *LogLexer) readBracketToken() {
	col := l.column
	l.advance() // saltar '['
	start := l.pos

	for l.pos < len(l.input) && l.input[l.pos] != ']' {
		l.advance()
	}

	value := strings.ToUpper(strings.TrimSpace(l.input[start:l.pos]))

	if l.pos < len(l.input) {
		l.advance() // saltar ']'
	}

	tokenType := classifyBracketValue(value)
	l.tokens = append(l.tokens, LogToken{
		Type:   tokenType,
		Value:  value,
		Column: col,
	})
}

// readWordToken lee una palabra (letras, dígitos, guión bajo, puntos, guiones).
func (l *LogLexer) readWordToken() {
	col := l.column
	start := l.pos

	for l.pos < len(l.input) && !unicode.IsSpace(rune(l.input[l.pos])) {
		l.advance()
	}

	value := l.input[start:l.pos]
	upper := strings.ToUpper(value)

	tokenType := classifyWord(upper, len(l.tokens))

	l.tokens = append(l.tokens, LogToken{
		Type:   tokenType,
		Value:  value,
		Column: col,
	})
}

// classifyBracketValue clasifica el contenido de un [...].
func classifyBracketValue(value string) LogTokenType {
	if nivelesValidos[value] {
		return TokenNivel
	}
	if modulosValidos[value] {
		return TokenModulo
	}
	return TokenUnknown
}

// classifyWord clasifica una palabra libre según el vocabulario y la posición.
func classifyWord(upper string, currentTokenCount int) LogTokenType {
	if accionesValidas[upper] {
		return TokenAccion
	}
	if entidadesValidas[upper] {
		return TokenEntidad
	}
	// Cualquier otra cosa es VALOR
	return TokenValor
}

func (l *LogLexer) skipWhitespace() {
	for l.pos < len(l.input) && unicode.IsSpace(rune(l.input[l.pos])) {
		l.advance()
	}
}

func (l *LogLexer) advance() {
	if l.pos < len(l.input) {
		l.column++
		l.pos++
	}
}
