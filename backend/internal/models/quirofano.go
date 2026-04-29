package models

import "time"

// EstadoQuirofano representa los estados posibles de un quirófano
type EstadoQuirofano string

const (
	Disponible EstadoQuirofano = "disponible" // Verde
	Ocupado    EstadoQuirofano = "ocupado"    // Rojo
	Limpieza   EstadoQuirofano = "limpieza"   // Amarillo
)

// Quirofano representa un quirófano del hospital
type Quirofano struct {
	ID              int             `json:"id"`
	Numero          int             `json:"numero"`
	Estado          EstadoQuirofano `json:"estado"`
	MedicoID        *int            `json:"medico_id,omitempty"`
	MedicoNombre    string          `json:"medico_nombre,omitempty"`
	PacienteNombre  string          `json:"paciente_nombre,omitempty"`
	ExpedienteID    *int            `json:"expediente_id,omitempty"`
	Anestesiologo   string          `json:"anestesiologo_nombre,omitempty"`
	TipoCirugia     string          `json:"tipo_cirugia,omitempty"`
	Especialidad    string          `json:"especialidad,omitempty"`
	InicioOperacion *time.Time      `json:"inicio_operacion,omitempty"`
	FinEstimado     *time.Time      `json:"fin_estimado,omitempty"`
	EsUrgencia      bool            `json:"es_urgencia"`
}

// Medico representa un médico especialista
type Medico struct {
	ID             int    `json:"id"`
	Nombre         string `json:"nombre"`
	Especialidad   string `json:"especialidad"`
	Turno          string `json:"turno"` // manana, tarde, noche
	OperacionesHoy int    `json:"operaciones_hoy"`
	Disponible     bool   `json:"disponible"`
}

// Cita representa una cirugía programada
type Cita struct {
	ID          int       `json:"id"`
	PacienteID  int       `json:"paciente_id"`
	MedicoID    int       `json:"medico_id"`
	QuirofanoID *int      `json:"quirofano_id,omitempty"`
	FechaCita   time.Time `json:"fecha_cita"`
	TipoCirugia string    `json:"tipo_cirugia"`
	Estado      string    `json:"estado"` // programada, en_curso, completada, cancelada
	EsUrgencia  bool      `json:"es_urgencia"`
}

// Paciente con expediente
type Paciente struct {
	ID              int    `json:"id"`
	Nombre          string `json:"nombre"`
	ExpedienteID    int    `json:"expediente_id"`
	TienePreproceso bool   `json:"tiene_preproceso"` // estudios necesarios
}

// Insumo del inventario
type Insumo struct {
	ID         string `json:"id" bson:"_id,omitempty"`
	Nombre     string `json:"nombre" bson:"nombre"`
	Categoria  string `json:"categoria" bson:"categoria"` // herramienta, anestesia, sangre
	Cantidad   int    `json:"cantidad" bson:"cantidad"`
	Disponible bool   `json:"disponible" bson:"disponible"`
}
