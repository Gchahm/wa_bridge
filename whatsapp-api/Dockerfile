FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o wa-bridge .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates bash curl nodejs npm
WORKDIR /app
COPY --from=builder /app/wa-bridge .
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
CMD ["./wa-bridge"]
