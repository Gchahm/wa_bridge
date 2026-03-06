---
name: flight-search
description: Pesquisa de voos em múltiplos sites em paralelo via MCP servers (seats.aero, TAP, Smiles, Iberia). Suporta tarifas cash e milhas, ida e volta ou só ida, 1 ou mais passageiros, datas fixas ou range. Resultados ordenados por melhor preço equivalente em BRL. Use quando o usuário pedir busca de voos, passagens, milhas, pesquisa aérea, comparação de preços de voo ou quiser verificar disponibilidade em programas de fidelidade. Também use quando o usuário pedir para atualizar o valor das milhas de algum programa.
---

# Flight Search

## Arquitetura

Toda busca é feita via **MCP servers**. Cada site tem seu próprio MCP (wrapper de API ou Playwright — não importa o internals). O agente **nunca navega diretamente** nos sites; apenas chama os MCPs disponíveis.

### MCPs disponíveis

| Site | MCP disponível? |
|------|----------------|
| seats.aero | ✅ |
| TAP | 🔜 em breve |
| Smiles | 🔜 em breve |
| Iberia | 🔜 em breve |

> Quando um MCP ainda não existe para um site, simplesmente ignore esse site na busca e informe o usuário quais foram consultados.

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

Spawnar **um sub-agente por MCP disponível**, todos em paralelo. Cada sub-agente deve:
1. Chamar o MCP do seu site com os parâmetros da busca
2. Para range de datas: buscar **apenas o melhor preço por dia**
3. Retornar resultado no formato JSON padronizado (ver abaixo)

**MCPs e seus guides:**
- `references/seats-aero.md` — seats.aero MCP (awards/milhas)

> Quando novos MCPs forem adicionados, incluir seus guides aqui.

## Formato JSON de resultado por sub-agente

```json
[
  {
    "site": "seats.aero",
    "programa": "seats.aero",
    "programa_key": "seats_aero",
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
    "link": "https://seats.aero/...",
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
- `observacao`: avisos importantes (ex: "requer login", "emissão via programa X")

## Agregação e exibição

Após todos os sub-agentes retornarem, usar `scripts/aggregate.py` para:
1. Converter milhas → BRL equivalente usando `config.json`
2. Ordenar todos os resultados do melhor ao pior preço equivalente em BRL
3. Exibir tabela markdown

**Formato da tabela final:**

| # | Site | Programa | Classe | Rota | Data Ida | Data Volta | Passag. | Preço | Taxa usada | Escalas | Link |
|---|------|----------|--------|------|----------|------------|---------|-------|------------|---------|------|
| 1 | seats.aero | — | Econômica | GRU→LIS | 12/jun | 26/jun | 2 | 45.000 mi + R$800 ≈ R$4.400 | R$40/mil | 1 | 🔗 |

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
- Se o MCP retornar erro ou não encontrar resultados, marcar como "Sem disponibilidade" e continuar
- Taxas em EUR: converter para BRL usando taxa aproximada (buscar se necessário)
- seats.aero não vende bilhetes diretamente — incluir nota "emissão via [programa]"
- Para datas range com muitos dias: avisar o usuário que a busca pode demorar
