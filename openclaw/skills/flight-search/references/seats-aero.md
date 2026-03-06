# seats.aero — Guia de Pesquisa

**Site:** https://seats.aero/
**Tipo:** Award availability (espaço em milhas/pontos), não vende bilhetes diretamente.

## O que seats.aero oferece

- Disponibilidade de espaço em cabine (award space) em tempo real
- Agrega dados de múltiplos programas de fidelidade
- Mostra custo em milhas + taxas, por programa e classe

## Fluxo de Pesquisa com Playwright

### 1. Navegar
```
https://seats.aero/search
```

### 2. Preencher campos
- **Origin:** código IATA de origem (ex: GRU)
- **Destination:** código IATA de destino (ex: LIS)
- **Date:** data da partida (se range, iterar data a data)
- **Cabin class:** Economy / Business / First
- **Passengers:** número de passageiros

### 3. Executar busca e capturar resultados

Para cada resultado retornado, capturar:
- Programa de milhas (ex: United MileagePlus, Air Canada Aeroplan, etc.)
- Classe (Economy / Business / First)
- Milhas necessárias por passageiro
- Taxas em cash (USD/BRL)
- Nº de escalas
- Companhia aérea operadora
- Link direto para o resultado (URL da busca com filtros aplicados)

### 4. Para range de datas
Iterar sobre cada data do range e consolidar resultados únicos.

## Cálculo do custo equivalente em BRL

```
custo_equivalente_brl = (milhas / 1000) * taxa_por_1000 + taxas_em_brl
```

Usar a taxa do programa `seats_aero` em `config.json` (ou a específica do programa se disponível).

## Notas
- seats.aero **não** vende passagens — o link é para a busca no próprio site para referência
- Ao listar, indicar qual programa emite o bilhete (ex: "via United MileagePlus")
- Se não houver disponibilidade, registrar como "Sem disponibilidade" para aquela data
