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
| `origin` | string (IATA) | ✅ | Ex: VCP, GRU |
| `destination` | string (IATA) | ✅ | Ex: LIS, DUB |
| `departure_date` | string (YYYY-MM-DD) | ✅ | Data de partida |
| `passengers` | integer (1–9) | — | Default: 1 |
| `cabin` | economy/business/first/any | — | Default: economy |
| `date_range_days` | integer (0–30) | — | Busca ±N dias ao redor da data. Default: 0 |

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
      "escalas": 0,
      "companhia": "AF, G3, IB, KL, TP, UX",
      "link": "https://seats.aero/search?origins=VCP&destinations=LIS&date=2026-03-23",
      "observacao": "7 seats available. Via smiles. Updated 2026-03-06T10:50:23Z."
    }
  ]
}
```

## Mapeamento para o JSON padrão do skill

| Campo padrão | Campo MCP |
|---|---|
| `programa` | `programa` (nome do programa) |
| `milhas` | `milhas` (por passageiro) |
| `taxas_brl` | não retornado — usar 0 ou perguntar ao usuário |
| `escalas` | `escalas` |
| `companhia` | `companhia` (operadoras disponíveis) |
| `link` | `link` |
| `observacao` | `observacao` + "emissão via [programa]" |

## Cálculo do custo equivalente em BRL

```
custo_equivalente_brl = (milhas / 1000) * taxa_por_1000 + taxas_brl
```

Usar taxa `seats_aero` em `config.json` (padrão: R$40/1000 mi).

## Notas
- seats.aero **não** vende passagens — link é para referência/verificação
- Indicar sempre qual programa emite o bilhete (campo `programa`)
- Se `success: false`, registrar como "Sem disponibilidade" e continuar
- Para range de datas, usar `date_range_days` em vez de iterar manualmente
