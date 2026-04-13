package compiler

import (
	"strings"
	"unicode"
)

// TokenType representa el tipo de token
type TokenType string

const (
	KEYWORD TokenType = "clave"   // Palabras reservadas: CREATE, DATABASE, TABLE, etc.
	IDENT   TokenType = "normal"  // Identificadores: nombres de tablas, columnas, etc.
	SYMBOL  TokenType = "simbolo" // Símbolos: ; , ( ) = etc.
	NUMBER  TokenType = "numero"  // Números: 123, 45.67
	STRING  TokenType = "cadena"  // Cadenas: 'texto', "texto"
	ERROR   TokenType = "error"   // Token de error
	EOF     TokenType = "eof"     // Fin de entrada
)

// Token representa un token del analizador léxico
type Token struct {
	Type   TokenType `json:"type"`
	Value  string    `json:"value"`
	Line   int       `json:"line"`
	Column int       `json:"column"`
}

// Palabras reservadas SQL
var keywords = map[string]bool{
	"CREATE":    true,
	"DATABASE":  true,
	"TABLE":     true,
	"INSERT":    true,
	"INTO":      true,
	"VALUES":    true,
	"SELECT":    true,
	"FROM":      true,
	"WHERE":     true,
	"UPDATE":    true,
	"SET":       true,
	"DELETE":    true,
	"DROP":      true,
	"ALTER":     true,
	"ADD":       true,
	"PRIMARY":   true,
	"KEY":       true,
	"FOREIGN":   true,
	"INT":       true,
	"VARCHAR":   true,
	"TEXT":      true,
	"BOOLEAN":   true,
	"DATE":      true,
	"NULL":      true,
	"NOT":       true,
	"AND":       true,
	"OR":        true,
	"USE":       true,
	"SHOW":      true,
	"DATABASES": true,
	"TABLES":    true,
}

// Lexer es el analizador léxico
type Lexer struct {
	input  string
	pos    int
	line   int
	column int
	tokens []Token
}

// NewLexer crea un nuevo lexer
func NewLexer(input string) *Lexer {
	return &Lexer{
		input:  input,
		pos:    0,
		line:   1,
		column: 1,
		tokens: make([]Token, 0),
	}
}

// Tokenize analiza la entrada y retorna los tokens
func (l *Lexer) Tokenize() []Token {
	for l.pos < len(l.input) {
		l.skipWhitespace()
		if l.pos >= len(l.input) {
			break
		}

		ch := l.current()

		// Identificadores y palabras clave
		if unicode.IsLetter(rune(ch)) || ch == '_' {
			l.readIdentifier()
			continue
		}

		// Números
		if unicode.IsDigit(rune(ch)) {
			l.readNumber()
			continue
		}

		// Cadenas
		if ch == '\'' || ch == '"' {
			l.readString(ch)
			continue
		}

		// Símbolos
		if l.isSymbol(ch) {
			l.addToken(SYMBOL, string(ch))
			l.advance()
			continue
		}

		// Caracter no reconocido
		l.addToken(ERROR, string(ch))
		l.advance()
	}

	l.addToken(EOF, "")
	return l.tokens
}

func (l *Lexer) current() byte {
	if l.pos >= len(l.input) {
		return 0
	}
	return l.input[l.pos]
}

func (l *Lexer) advance() {
	if l.pos < len(l.input) {
		if l.input[l.pos] == '\n' {
			l.line++
			l.column = 1
		} else {
			l.column++
		}
		l.pos++
	}
}

func (l *Lexer) skipWhitespace() {
	for l.pos < len(l.input) && unicode.IsSpace(rune(l.input[l.pos])) {
		l.advance()
	}
}

func (l *Lexer) readIdentifier() {
	startCol := l.column
	startLine := l.line
	start := l.pos

	for l.pos < len(l.input) && (unicode.IsLetter(rune(l.input[l.pos])) || unicode.IsDigit(rune(l.input[l.pos])) || l.input[l.pos] == '_') {
		l.advance()
	}

	value := l.input[start:l.pos]
	upperValue := strings.ToUpper(value)

	tokenType := IDENT
	if keywords[upperValue] {
		tokenType = KEYWORD
		value = upperValue // Normalizar palabras clave a mayúsculas
	}

	l.tokens = append(l.tokens, Token{
		Type:   tokenType,
		Value:  value,
		Line:   startLine,
		Column: startCol,
	})
}

func (l *Lexer) readNumber() {
	startCol := l.column
	startLine := l.line
	start := l.pos

	for l.pos < len(l.input) && (unicode.IsDigit(rune(l.input[l.pos])) || l.input[l.pos] == '.') {
		l.advance()
	}

	l.tokens = append(l.tokens, Token{
		Type:   NUMBER,
		Value:  l.input[start:l.pos],
		Line:   startLine,
		Column: startCol,
	})
}

func (l *Lexer) readString(quote byte) {
	startCol := l.column
	startLine := l.line
	l.advance() // Saltar comilla inicial
	start := l.pos

	for l.pos < len(l.input) && l.input[l.pos] != quote {
		l.advance()
	}

	value := l.input[start:l.pos]

	if l.pos < len(l.input) {
		l.advance() // Saltar comilla final
	}

	l.tokens = append(l.tokens, Token{
		Type:   STRING,
		Value:  value,
		Line:   startLine,
		Column: startCol,
	})
}

func (l *Lexer) isSymbol(ch byte) bool {
	symbols := ";,()=*<>+-/."
	return strings.ContainsRune(symbols, rune(ch))
}

func (l *Lexer) addToken(tokenType TokenType, value string) {
	l.tokens = append(l.tokens, Token{
		Type:   tokenType,
		Value:  value,
		Line:   l.line,
		Column: l.column,
	})
}
