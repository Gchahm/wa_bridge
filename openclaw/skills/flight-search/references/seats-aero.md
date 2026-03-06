# seats.aero — MCP Guide

**Site:** https://seats.aero/
**Tipo:** Award availability (espaço em milhas/pontos), não vende bilhetes diretamente.

## Chamando o MCP

Este site é consultado via **MCP server**. Não navegar no site diretamente.

> **TODO:** documentar aqui o comando de invocação do MCP, ferramentas disponíveis e parâmetros aceitos quando o servidor estiver configurado.
> Exemplo esperado:
> - Tool name: `search_seats_aero` (ou similar)
> - Parâmetros: `origin`, `destination`, `date` (ou `date_from`/`date_to`), `cabin`, `passengers`

## O que seats.aero oferece

- Disponibilidade de espaço em cabine (award space) em tempo real
- Agrega dados de múltiplos programas de fidelidade
- Mostra custo em milhas + taxas, por programa e classe

## Mapeamento de campos (MCP → JSON padrão)

Para cada resultado retornado pelo MCP, mapear para o formato padrão do skill:

| Campo padrão | Campo MCP (ajustar conforme resposta real) |
|---|---|
| `programa` | nome do programa de fidelidade (ex: "United MileagePlus") |
| `tipo` | sempre `"miles"` |
| `classe` | Economy / Business / First |
| `milhas` | milhas por passageiro |
| `taxas_brl` | taxas em cash convertidas para BRL |
| `escalas` | nº de conexões |
| `link` | URL da busca no seats.aero |
| `observacao` | "emissão via [programa]" |

## Cálculo do custo equivalente em BRL

```
custo_equivalente_brl = (milhas / 1000) * taxa_por_1000 + taxas_em_brl
```

Usar a taxa `seats_aero` em `config.json`.

## Notas
- seats.aero **não** vende passagens — o link é para referência
- Indicar sempre qual programa emite o bilhete (ex: "via United MileagePlus")
- Se o MCP retornar erro ou vazio, registrar como "Sem disponibilidade"
