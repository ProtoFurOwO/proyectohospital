package compiler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	PGDB    *sql.DB
	MongoDB *mongo.Database
)

type CatalogEntry struct {
	Engine string
	Tables []string
}

var systemCatalog = map[string]CatalogEntry{
	"citas": {
		Engine: "MySQL",
		Tables: []string{"citas", "citas_legacy"},
	},
	"expedientes": {
		Engine: "PostgreSQL",
		Tables: []string{"expedientes", "historias_clinicas"},
	},
	"quirofanos": {
		Engine: "MariaDB",
		Tables: []string{"quirofanos", "ocupacion_salas"},
	},
	"insumos": {
		Engine: "MongoDB",
		Tables: []string{"insumos", "consumos"},
	},
	"personal": {
		Engine: "Redis",
		Tables: []string{"personal", "medicos"},
	},
}

var tableAliases = map[string]map[string]string{
	"citas": {
		"citas":        "citas_legacy",
		"citas_legacy": "citas_legacy",
	},
	"expedientes": {
		"expedientes":        "historias_clinicas",
		"historias_clinicas": "historias_clinicas",
	},
	"quirofanos": {
		"quirofanos":      "quirofanos",
		"ocupacion_salas": "ocupacion_salas",
	},
	"insumos": {
		"insumos":  "consumos",
		"consumos": "consumos",
	},
	"personal": {
		"personal": "medicos",
		"medicos":  "medicos",
	},
}

// SeedSystemDatabases registra las bases externas conocidas en el analizador semantico.
func SeedSystemDatabases(analyzer *SemanticAnalyzer) {
	if analyzer == nil {
		return
	}

	for name, entry := range systemCatalog {
		analyzer.RegisterExternalDatabase(name, entry.Engine, entry.Tables)
	}
}

// InitDatabases initializes connection pools for both DBs
func InitDatabases() {
	// PostgreSQL
	pgURL := os.Getenv("POSTGRES_URL")
	if pgURL == "" {
		pgURL = "postgresql://hospital:hospital123@localhost:5432/expedientes?sslmode=disable"
	}
	db, err := sql.Open("postgres", pgURL)
	if err != nil {
		log.Printf("⚠️ Error conectando a PostgreSQL: %v", err)
	} else {
		PGDB = db
		log.Println("✅ Conectado a PostgreSQL (expedientes)")
	}

	// MongoDB
	mongoURL := os.Getenv("MONGO_URL")
	if mongoURL == "" {
		mongoURL = "mongodb://hospital:hospital123@localhost:27017"
	}
	mongoDBName := os.Getenv("MONGO_DB")
	if mongoDBName == "" {
		mongoDBName = "insumos"
	}
	clientOptions := options.Client().ApplyURI(mongoURL)
	client, err := mongo.Connect(context.TODO(), clientOptions)
	if err != nil {
		log.Printf("⚠️ Error conectando a MongoDB: %v", err)
	} else {
		MongoDB = client.Database(mongoDBName)
		log.Printf("✅ Conectado a MongoDB (%s)", mongoDBName)
	}
}

// ExecuteGenericQuery routes the query to the correct DB based on the current database.
func ExecuteGenericQuery(currentDB, tableName string) ([]map[string]interface{}, error) {
	dbKey := strings.ToLower(strings.TrimSpace(currentDB))
	tableKey := strings.ToLower(strings.TrimSpace(tableName))

	aliases, ok := tableAliases[dbKey]
	if !ok {
		return nil, fmt.Errorf("Base de datos '%s' no soportada", currentDB)
	}
	resolvedTable, ok := aliases[tableKey]
	if !ok {
		return nil, fmt.Errorf("La tabla '%s' no existe en '%s'", tableName, currentDB)
	}

	switch dbKey {
	case "citas":
		return fetchServiceData(serviceBaseURL("CITAS_API_URL", "http://localhost:8001"), "/citas")
	case "quirofanos":
		return fetchServiceData(serviceBaseURL("QUIROFANOS_API_URL", "http://localhost:8003"), "/quirofanos")
	case "personal":
		return fetchServiceData(serviceBaseURL("PERSONAL_API_URL", "http://localhost:8005"), "/personal/medicos")
	case "expedientes":
		return queryPostgresTable(resolvedTable)
	case "insumos":
		return queryMongoCollection(resolvedTable)
	default:
		return nil, fmt.Errorf("Base de datos '%s' no soportada", currentDB)
	}
}

func serviceBaseURL(envKey, fallback string) string {
	value := strings.TrimSpace(os.Getenv(envKey))
	if value == "" {
		return fallback
	}
	return value
}

func fetchServiceData(baseURL, path string) ([]map[string]interface{}, error) {
	url := strings.TrimRight(baseURL, "/")
	if url == "" {
		return nil, fmt.Errorf("URL de servicio no configurada")
	}
	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Get(url + path)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Respuesta %d del servicio", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var list []map[string]interface{}
	if err := json.Unmarshal(body, &list); err == nil {
		return list, nil
	}

	var wrapper map[string]interface{}
	if err := json.Unmarshal(body, &wrapper); err != nil {
		return nil, fmt.Errorf("Respuesta no valida del servicio")
	}
	if data, ok := wrapper["data"].([]interface{}); ok {
		return coerceList(data), nil
	}

	return nil, fmt.Errorf("Respuesta no valida del servicio")
}

func queryMongoCollection(collectionName string) ([]map[string]interface{}, error) {
	if MongoDB == nil {
		return nil, fmt.Errorf("MongoDB no está conectado")
	}

	collection := MongoDB.Collection(collectionName)
	cursor, err := collection.Find(context.TODO(), bson.M{})
	if err != nil {
		return nil, err
	}
	var results []bson.M
	if err = cursor.All(context.TODO(), &results); err != nil {
		return nil, err
	}

	finalResults := make([]map[string]interface{}, len(results))
	for i, r := range results {
		finalResults[i] = r
	}
	return finalResults, nil
}

func queryPostgresTable(tableName string) ([]map[string]interface{}, error) {
	if PGDB == nil {
		return nil, fmt.Errorf("PostgreSQL no está conectado")
	}

	query := fmt.Sprintf("SELECT * FROM %s LIMIT 50", tableName)
	rows, err := PGDB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns, _ := rows.Columns()
	var allRows []map[string]interface{}

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range columns {
			valuePtrs[i] = &values[i]
		}

		rows.Scan(valuePtrs...)

		rowMap := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			b, ok := val.([]byte)
			if ok {
				rowMap[col] = string(b)
			} else {
				rowMap[col] = val
			}
		}
		allRows = append(allRows, rowMap)
	}
	return allRows, nil
}

func coerceList(items []interface{}) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		if row, ok := item.(map[string]interface{}); ok {
			result = append(result, row)
		}
	}
	return result
}
