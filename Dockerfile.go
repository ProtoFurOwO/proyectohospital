FROM golang:1.25.6-alpine AS builder

WORKDIR /app

# Instalar dependencias necesarias para CGO si fuera necesario
RUN apk add --no-cache gcc musl-dev

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./

# Compilamos usando un ARG para determinar qué servicio construir (quirofanos o compiler)
ARG SERVICE_NAME
RUN go build -o /app/main ./cmd/${SERVICE_NAME}/main.go

# Contenedor final ligero
FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/main .

EXPOSE 8000
CMD ["./main"]
