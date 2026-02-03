FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git
WORKDIR /app
COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o whatsapp-bridge .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates
WORKDIR /app
RUN mkdir /data
COPY --from=builder /app/whatsapp-bridge .

EXPOSE 8080
VOLUME /data

CMD ["./whatsapp-bridge"]
