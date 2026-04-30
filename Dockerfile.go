FROM golang:1.21-alpine AS builder

WORKDIR /app

# Instalar dependencias necesarias para CGO si fuera el caso
RUN apk add --no-cache gcc musl-dev

# Copiamos los archivos de configuracion desde la carpeta backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copiamos el resto del codigo de backend
COPY backend/ .

# El argumento SERVICE permite elegir que comando compilar
ARG SERVICE_PATH=cmd/quirofanos
RUN go build -o /app/service ./${SERVICE_PATH}

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/service .

# Exponemos un puerto generico
EXPOSE 8080

CMD ["./service"]
