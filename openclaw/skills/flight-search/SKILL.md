---
name: flight-search
description: Pesquisa de voos em múltiplos sites em paralelo (seats.aero, TAP, Smiles, Iberia). Suporta tarifas cash e milhas, ida e volta ou só ida, 1 ou mais passageiros, datas fixas ou range. Resultados ordenados por melhor preço equivalente em BRL. Use quando o usuário pedir busca de voos, passagens, milhas, pesquisa aérea, comparação de preços de voo ou quiser verificar disponibilidade em programas de fidelidade. Também use quando o usuário pedir para atualizar o valor das milhas de algum programa.
---

# Flight Search

## Passos obrigatórios antes de buscar

1. **Ler `references/config.json`** — verificar taxa de valorização atual de cada programa
2. **Confirmar parâmetros com o usuário se ausentes:**
   - Origem (código IATA ou cidade)
   - Destino (código IATA ou cidade)
   - Data(s) de ida (fixa ou range: ex. 10 a 20 de junho)
   - Data(s) de volta (se ida e volta — fixa ou range)
   - Nº de passageiros (adultos)
   - Tipo: só ida ou ida e volta

## Execução da busca (paralelo)

Spawnar **4 sub-agentes simultâneos**, um por site. Cada sub-agente deve:
1. Ler o guia do seu site em `references/<site>.md`
2. Usar Playwright MCP para navegar e extrair os dados
3. Para range de datas: buscar **apenas o melhor preço por dia** (não todos os voos do dia)
4. Retornar resultado no formato JSON padronizado (ver abaixo)

**Sites e seus guides:**
- `references/seats-aero.md` — https://seats.aero/ (awards/milhas)
- `references/tap.md` — https://booking.flytap.com/booking (cash + Miles&Go)
- `references/smiles.md` — https://www.smiles.com.br/home (milhas Smiles)
- `references/iberia.md` — https://www.iberia.com/br/ (cash + Avios)

## Formato JSON de resultado por sub-agente

```json
[
  {
    "site": "Smiles",
    "programa": "Smiles",
    "programa_key": "smiles",
    "tipo": "miles",
    "classe": "Econômica",
    "origem": "GRU",
    "destino": "LIS",
    "data_ida": "2026-06-12",
    "data_volta": "2026-06-26",
    "passageiros": 2,
    "milhas": 45000,
    "taxas_brl": 800,
    "escalas": 1,
    "link": "https://www.smiles.com.br/...",
    "observacao": ""
  },
  {
    "site": "TAP",
    "programa": "Cash",
    "programa_key": null,
    "tipo": "cash",
    "classe": "Econômica",
    "origem": "GRU",
    "destino": "LIS",
    "data_ida": "2026-06-15",
    "data_volta": "2026-06-29",
    "passageiros": 2,
    "preco_brl": 3200,
    "escalas": 0,
    "link": "https://booking.flytap.com/...",
    "observacao": ""
  }
]
```

**Campos:**
- `tipo`: `"cash"` ou `"miles"`
- `milhas`: valor por passageiro (para tipo miles)
- `taxas_brl`: taxas obrigatórias em BRL (para tipo miles)
- `preco_brl`: preço total para todos passageiros (para tipo cash)
- `escalas`: número de escalas/conexões
- `link`: URL direta para a busca no site
- `observacao`: avisos importantes (ex: "requer login", "conexão em MAD")

## Agregação e exibição

Após todos os sub-agentes retornarem, usar `scripts/aggregate.py` para:
1. Converter milhas → BRL equivalente usando `config.json`
2. Ordenar todos os resultados do melhor ao pior preço equivalente em BRL
3. Exibir tabela markdown

**Formato da tabela final:**

| # | Site | Programa | Classe | Rota | Data Ida | Data Volta | Passag. | Preço | Taxa usada | Escalas | Link |
|---|------|----------|--------|------|----------|------------|---------|-------|------------|---------|------|
| 1 | Smiles | Smiles | Econômica | GRU→LIS | 12/jun | 26/jun | 2 | 45.000 mi + R$800 ≈ R$4.400 | R$40/mil | 1 | 🔗 |

> **Coluna "Taxa usada":** sempre mostrar a taxa do milheiro usada no cálculo (ex: `R$40/mil`)

## Atualização de valor de milhas

Quando o usuário pedir para mudar o valor das milhas (ex: "muda o Smiles para 35"):
1. Ler `references/config.json`
2. Atualizar o campo correspondente em `programs`
3. Atualizar `last_updated` com a data atual
4. Salvar o arquivo
5. Confirmar a mudança para o usuário

## Notas importantes

- Não gerar ou enviar capturas de tela/imagens — basta texto/tabelas
- Se o site exigir login, CAPTCHA ou houver bloqueio, pedir ajuda ao usuário (ele consegue interagir na interface gráfica e inserir credenciais/se necessário)
- Se um site não retornar resultado, marcar como "Sem disponibilidade" e continuar
- Taxas em EUR: converter para BRL usando taxa aproximada (buscar se necessário)
- Seats.aero: não vende bilhetes — incluir nota "emissão via [programa]"
- Para datas range com muitos dias: avisar o usuário que a busca pode demorar
