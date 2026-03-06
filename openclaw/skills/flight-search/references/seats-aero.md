# seats.aero — MCP Guide

**Site:** https://seats.aero/
**Tipo:** Award availability (espaço em milhas/pontos), não vende bilhetes diretamente.

## Chamando o MCP

MCP configurado em `~/.claude.json` como `seats-aero`. Wrapper em:
`~/.openclaw/skills/flight-search/scripts/seats-aero-wrapper.sh`

### Tool: `search_flights_seats_aero`

```json
{
  "origin": "VCP",
  "destination": "LIS",
  "departure_date": "2026-03-23",
  "passengers": 2,
  "cabin": "economy",
  "date_range_days": 0
}
```

**Parâmetros:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `origin` | string (IATA) | sim | Ex: VCP, GRU |
| `destination` | string (IATA) | sim | Ex: LIS, DUB |
| `departure_date` | string (YYYY-MM-DD) | sim | Data de partida |
| `passengers` | integer (1-9) | — | Default: 1 |
| `cabin` | economy/business/first/any | — | Default: economy |
| `date_range_days` | integer (0-30) | — | Busca +/-N dias ao redor da data. Default: 0 |

### Exemplo de resposta

```json
{
  "success": true,
  "flights": [
    {
      "site": "seats.aero",
      "programa": "smiles",
      "programa_key": "seats_aero",
      "tipo": "miles",
      "classe": "Economy",
      "origem": "VCP",
      "destino": "LIS",
      "data_ida": "2026-03-23",
      "passageiros": 2,
      "milhas": 277000,
      "taxas_usd": 10.10,
      "escalas": 2,
      "conexoes": ["SSA", "MAD"],
      "duracao_min": 1490,
      "companhia": "G3, UX, UX",
      "aeronaves": ["Boeing 737-800", "Boeing 787-9", "Boeing 737-800"],
      "voos": "G31987, UX84, UX1155",
      "horario_ida": "2026-03-23T11:25:00Z",
      "horario_chegada": "2026-03-24T15:15:00Z",
      "assentos_disponiveis": 2,
      "link": "https://seats.aero/search?origins=VCP&destinations=LIS&date=2026-03-23",
      "observacao": "Emissão via smiles. Dados atualizados em 2026-03-06T10:50:23Z."
    }
  ]
}
```

### Campos da resposta

| Campo | Descrição |
|-------|-----------|
| `programa` | Programa de milhas que oferece a emissão (smiles, united, aeroplan, etc.) |
| `milhas` | Custo em milhas por passageiro |
| `taxas_usd` | Taxas em USD (quando disponível) |
| `escalas` | Número de paradas (0 = direto) |
| `conexoes` | Aeroportos de conexão (ex: `["GIG", "CDG"]`) |
| `duracao_min` | Duração total da viagem em minutos |
| `companhia` | Companhias aéreas operando os trechos |
| `aeronaves` | Modelos de aeronave por trecho |
| `voos` | Números dos voos (ex: `"G31957, AF485, AF1194"`) |
| `horario_ida` | Horário de partida (ISO 8601 UTC) |
| `horario_chegada` | Horário de chegada (ISO 8601 UTC) |
| `assentos_disponiveis` | Assentos restantes na cabine |

## Cálculo do custo equivalente em BRL

```
custo_equivalente_brl = (milhas / 1000) * taxa_por_1000 + taxas_brl
```

Usar taxa `seats_aero` em `config.json` (padrão: R$40/1000 mi).

## Notas
- seats.aero **não** vende passagens — indicar sempre "emissão via [programa]"
- Se `success: false`, registrar como "Sem disponibilidade" e continuar
- Para range de datas, usar `date_range_days` em vez de iterar manualmente
- Dados são cacheados — a coluna `observacao` indica quando foram atualizados
- `duracao_min` está em minutos — converter para horas:minutos na tabela (ex: 1490 min = 24h50)
