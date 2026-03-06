# TAP Air Portugal — Guia de Pesquisa

**Site:** https://booking.flytap.com/booking
**Tipo:** Cash (tarifas regulares) + Miles&Go (milhas TAP)
**Programa de milhas:** TAP Miles&Go

## Fluxo de Pesquisa com Playwright

### 1. Navegar
```
https://booking.flytap.com/booking
```

### 2. Selecionar tipo de viagem
- Escolher: "Ida e volta" ou "Só ida"
- Selecionar aba de busca: **"Preços"** (cash) ou **"Miles&Go"** (milhas)

### 3. Preencher campos
- **Origem:** código IATA ou nome da cidade (ex: GRU / São Paulo)
- **Destino:** código IATA ou nome (ex: LIS / Lisboa)
- **Data de ida:** conforme solicitado
- **Data de volta:** se ida e volta (pode ser range)
- **Passageiros:** adultos / crianças / bebês

### 4. Capturar resultados

Para **busca cash**, capturar por data:
- Tarifa mais barata do dia
- Classe tarifária (ex: Economy Light, Economy Classic, Business)
- Companhia operadora (TAP ou codeshare)
- Nº de escalas
- Link da busca

Para **busca Miles&Go**, capturar:
- Milhas necessárias por passageiro
- Taxas obrigatórias em cash (BRL ou EUR)
- Classe (Economy / Business)
- Nº de escalas
- Link da busca

### 5. Para range de datas
Verificar o calendário de preços se disponível (muitos sites de cia aérea mostram calendário mensal). Caso contrário, iterar data a data.

## Cálculo do custo equivalente em BRL (Miles&Go)

```
custo_equivalente_brl = (milhas / 1000) * taxa_por_1000 + taxas_em_brl
```

Usar a taxa do programa `tap_miles_go` em `config.json`.

## Notas
- Taxas em EUR devem ser convertidas para BRL usando taxa de câmbio aproximada (buscar taxa atual se necessário)
- O link de resultado deve ser a URL após a busca, com os parâmetros da pesquisa
