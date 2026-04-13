package compiler

import (
	"fmt"
)

// NodeType representa el tipo de nodo del AST
type NodeType string

const (
	CREATE_DATABASE NodeType = "CREATE_DATABASE"
	CREATE_TABLE    NodeType = "CREATE_TABLE"
	INSERT          NodeType = "INSERT"
	SELECT          NodeType = "SELECT"
	UPDATE          NodeType = "UPDATE"
	DELETE          NodeType = "DELETE"
	DROP_DATABASE   NodeType = "DROP_DATABASE"
	DROP_TABLE      NodeType = "DROP_TABLE"
	USE_DATABASE    NodeType = "USE_DATABASE"
	SHOW_DATABASES  NodeType = "SHOW_DATABASES"
	SHOW_TABLES     NodeType = "SHOW_TABLES"
)

// ASTNode representa un nodo del árbol sintáctico
type ASTNode struct {
	Type       NodeType          `json:"type"`
	Name       string            `json:"name,omitempty"`
	Columns    []ColumnDef       `json:"columns,omitempty"`
	Values     []string          `json:"values,omitempty"`
	Conditions string            `json:"conditions,omitempty"`
	Fields     map[string]string `json:"fields,omitempty"`
}

// ColumnDef define una columna de tabla
type ColumnDef struct {
	Name       string `json:"name"`
	DataType   string `json:"data_type"`
	IsPrimary  bool   `json:"is_primary"`
	IsNullable bool   `json:"is_nullable"`
}

// ParseError representa un error de parseo
type ParseError struct {
	Message  string `json:"message"`
	Line     int    `json:"line"`
	Column   int    `json:"column"`
	Expected string `json:"expected"`
	Got      string `json:"got"`
}

func (e *ParseError) Error() string {
	return fmt.Sprintf("Error sintáctico en línea %d, columna %d: %s. Se esperaba '%s' pero se encontró '%s'",
		e.Line, e.Column, e.Message, e.Expected, e.Got)
}

// Parser es el analizador sintáctico
type Parser struct {
	tokens []Token
	pos    int
	errors []ParseError
}

// NewParser crea un nuevo parser
func NewParser(tokens []Token) *Parser {
	return &Parser{
		tokens: tokens,
		pos:    0,
		errors: make([]ParseError, 0),
	}
}

// Parse analiza los tokens y retorna el AST
func (p *Parser) Parse() (*ASTNode, error) {
	if len(p.tokens) == 0 {
		return nil, &ParseError{Message: "Entrada vacía", Line: 1, Column: 1}
	}

	return p.parseStatement()
}

// GetErrors retorna los errores de parseo
func (p *Parser) GetErrors() []ParseError {
	return p.errors
}

func (p *Parser) current() Token {
	if p.pos >= len(p.tokens) {
		return Token{Type: EOF, Value: "", Line: 0, Column: 0}
	}
	return p.tokens[p.pos]
}

func (p *Parser) peek() Token {
	if p.pos+1 >= len(p.tokens) {
		return Token{Type: EOF, Value: "", Line: 0, Column: 0}
	}
	return p.tokens[p.pos+1]
}

func (p *Parser) advance() Token {
	token := p.current()
	p.pos++
	return token
}

func (p *Parser) expect(tokenType TokenType, value string) (Token, error) {
	token := p.current()

	if token.Type != tokenType || (value != "" && token.Value != value) {
		expected := value
		if expected == "" {
			expected = string(tokenType)
		}
		return token, &ParseError{
			Message:  "Token inesperado",
			Line:     token.Line,
			Column:   token.Column,
			Expected: expected,
			Got:      token.Value,
		}
	}

	return p.advance(), nil
}

func (p *Parser) parseStatement() (*ASTNode, error) {
	token := p.current()

	switch token.Value {
	case "CREATE":
		return p.parseCreate()
	case "DROP":
		return p.parseDrop()
	case "USE":
		return p.parseUse()
	case "SHOW":
		return p.parseShow()
	case "INSERT":
		return p.parseInsert()
	case "SELECT":
		return p.parseSelect()
	case "UPDATE":
		return p.parseUpdate()
	case "DELETE":
		return p.parseDelete()
	default:
		return nil, &ParseError{
			Message:  "Comando no reconocido",
			Line:     token.Line,
			Column:   token.Column,
			Expected: "CREATE, DROP, USE, SHOW, INSERT, SELECT, UPDATE, DELETE",
			Got:      token.Value,
		}
	}
}

// CREATE DATABASE nombre; | CREATE TABLE nombre (...);
func (p *Parser) parseCreate() (*ASTNode, error) {
	p.advance() // CREATE

	token := p.current()
	switch token.Value {
	case "DATABASE":
		return p.parseCreateDatabase()
	case "TABLE":
		return p.parseCreateTable()
	default:
		return nil, &ParseError{
			Message:  "Se esperaba DATABASE o TABLE después de CREATE",
			Line:     token.Line,
			Column:   token.Column,
			Expected: "DATABASE o TABLE",
			Got:      token.Value,
		}
	}
}

func (p *Parser) parseCreateDatabase() (*ASTNode, error) {
	p.advance() // DATABASE

	nameToken, err := p.expect(IDENT, "")
	if err != nil {
		return nil, err
	}

	_, err = p.expect(SYMBOL, ";")
	if err != nil {
		return nil, err
	}

	return &ASTNode{
		Type: CREATE_DATABASE,
		Name: nameToken.Value,
	}, nil
}

func (p *Parser) parseCreateTable() (*ASTNode, error) {
	p.advance() // TABLE

	nameToken, err := p.expect(IDENT, "")
	if err != nil {
		return nil, err
	}

	_, err = p.expect(SYMBOL, "(")
	if err != nil {
		return nil, err
	}

	columns, err := p.parseColumnDefinitions()
	if err != nil {
		return nil, err
	}

	_, err = p.expect(SYMBOL, ")")
	if err != nil {
		return nil, err
	}

	_, err = p.expect(SYMBOL, ";")
	if err != nil {
		return nil, err
	}

	return &ASTNode{
		Type:    CREATE_TABLE,
		Name:    nameToken.Value,
		Columns: columns,
	}, nil
}

func (p *Parser) parseColumnDefinitions() ([]ColumnDef, error) {
	columns := make([]ColumnDef, 0)

	for {
		col, err := p.parseColumnDef()
		if err != nil {
			return nil, err
		}
		columns = append(columns, col)

		if p.current().Value != "," {
			break
		}
		p.advance() // ,
	}

	return columns, nil
}

func (p *Parser) parseColumnDef() (ColumnDef, error) {
	nameToken, err := p.expect(IDENT, "")
	if err != nil {
		return ColumnDef{}, err
	}

	typeToken, err := p.expect(KEYWORD, "")
	if err != nil {
		// Intentar con identificador si no es keyword
		typeToken = p.current()
		if typeToken.Type != IDENT {
			return ColumnDef{}, &ParseError{
				Message:  "Se esperaba tipo de dato",
				Line:     typeToken.Line,
				Column:   typeToken.Column,
				Expected: "INT, VARCHAR, TEXT, etc.",
				Got:      typeToken.Value,
			}
		}
		p.advance()
	}

	col := ColumnDef{
		Name:       nameToken.Value,
		DataType:   typeToken.Value,
		IsNullable: true,
	}

	// Verificar modificadores opcionales
	for p.current().Type == KEYWORD {
		switch p.current().Value {
		case "PRIMARY":
			p.advance()
			if p.current().Value == "KEY" {
				p.advance()
			}
			col.IsPrimary = true
		case "NOT":
			p.advance()
			if p.current().Value == "NULL" {
				p.advance()
				col.IsNullable = false
			}
		default:
			break
		}
	}

	return col, nil
}

// DROP DATABASE nombre; | DROP TABLE nombre;
func (p *Parser) parseDrop() (*ASTNode, error) {
	p.advance() // DROP

	token := p.current()
	var nodeType NodeType

	switch token.Value {
	case "DATABASE":
		nodeType = DROP_DATABASE
	case "TABLE":
		nodeType = DROP_TABLE
	default:
		return nil, &ParseError{
			Message:  "Se esperaba DATABASE o TABLE después de DROP",
			Line:     token.Line,
			Column:   token.Column,
			Expected: "DATABASE o TABLE",
			Got:      token.Value,
		}
	}
	p.advance()

	nameToken, err := p.expect(IDENT, "")
	if err != nil {
		return nil, err
	}

	_, err = p.expect(SYMBOL, ";")
	if err != nil {
		return nil, err
	}

	return &ASTNode{
		Type: nodeType,
		Name: nameToken.Value,
	}, nil
}

// USE nombre;
func (p *Parser) parseUse() (*ASTNode, error) {
	p.advance() // USE

	nameToken, err := p.expect(IDENT, "")
	if err != nil {
		return nil, err
	}

	_, err = p.expect(SYMBOL, ";")
	if err != nil {
		return nil, err
	}

	return &ASTNode{
		Type: USE_DATABASE,
		Name: nameToken.Value,
	}, nil
}

// SHOW DATABASES; | SHOW TABLES;
func (p *Parser) parseShow() (*ASTNode, error) {
	p.advance() // SHOW

	token := p.current()
	var nodeType NodeType

	switch token.Value {
	case "DATABASES":
		nodeType = SHOW_DATABASES
	case "TABLES":
		nodeType = SHOW_TABLES
	default:
		return nil, &ParseError{
			Message:  "Se esperaba DATABASES o TABLES después de SHOW",
			Line:     token.Line,
			Column:   token.Column,
			Expected: "DATABASES o TABLES",
			Got:      token.Value,
		}
	}
	p.advance()

	_, err := p.expect(SYMBOL, ";")
	if err != nil {
		return nil, err
	}

	return &ASTNode{
		Type: nodeType,
	}, nil
}

// INSERT INTO tabla VALUES (...);
func (p *Parser) parseInsert() (*ASTNode, error) {
	p.advance() // INSERT

	_, err := p.expect(KEYWORD, "INTO")
	if err != nil {
		return nil, err
	}

	nameToken, err := p.expect(IDENT, "")
	if err != nil {
		return nil, err
	}

	_, err = p.expect(KEYWORD, "VALUES")
	if err != nil {
		return nil, err
	}

	_, err = p.expect(SYMBOL, "(")
	if err != nil {
		return nil, err
	}

	values := make([]string, 0)
	for p.current().Value != ")" && p.current().Type != EOF {
		token := p.advance()
		if token.Type == SYMBOL && token.Value == "," {
			continue
		}
		values = append(values, token.Value)
	}

	_, err = p.expect(SYMBOL, ")")
	if err != nil {
		return nil, err
	}

	_, err = p.expect(SYMBOL, ";")
	if err != nil {
		return nil, err
	}

	return &ASTNode{
		Type:   INSERT,
		Name:   nameToken.Value,
		Values: values,
	}, nil
}

// SELECT * FROM tabla;
func (p *Parser) parseSelect() (*ASTNode, error) {
	p.advance() // SELECT

	// Leer campos (simplificado: solo *)
	if p.current().Value == "*" {
		p.advance()
	}

	_, err := p.expect(KEYWORD, "FROM")
	if err != nil {
		return nil, err
	}

	nameToken, err := p.expect(IDENT, "")
	if err != nil {
		return nil, err
	}

	_, err = p.expect(SYMBOL, ";")
	if err != nil {
		return nil, err
	}

	return &ASTNode{
		Type: SELECT,
		Name: nameToken.Value,
	}, nil
}

// UPDATE tabla SET campo = valor;
func (p *Parser) parseUpdate() (*ASTNode, error) {
	p.advance() // UPDATE

	nameToken, err := p.expect(IDENT, "")
	if err != nil {
		return nil, err
	}

	_, err = p.expect(KEYWORD, "SET")
	if err != nil {
		return nil, err
	}

	// Simplificado: leer hasta ;
	fields := make(map[string]string)
	for p.current().Value != ";" && p.current().Type != EOF {
		p.advance()
	}

	_, err = p.expect(SYMBOL, ";")
	if err != nil {
		return nil, err
	}

	return &ASTNode{
		Type:   UPDATE,
		Name:   nameToken.Value,
		Fields: fields,
	}, nil
}

// DELETE FROM tabla;
func (p *Parser) parseDelete() (*ASTNode, error) {
	p.advance() // DELETE

	_, err := p.expect(KEYWORD, "FROM")
	if err != nil {
		return nil, err
	}

	nameToken, err := p.expect(IDENT, "")
	if err != nil {
		return nil, err
	}

	_, err = p.expect(SYMBOL, ";")
	if err != nil {
		return nil, err
	}

	return &ASTNode{
		Type: DELETE,
		Name: nameToken.Value,
	}, nil
}
