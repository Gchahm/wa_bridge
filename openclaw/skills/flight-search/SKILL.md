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
| seats.aero | sim |
| TAP | em breve |
| Smiles | em breve |
| Iberia | em breve |

> Quando um MCP ainda não existe para um site, simplesmente ignore esse site na busca e informe o usuário quais foram consultados.

## Passos obrigatórios antes de buscar

1. **Ler `references/config.json`** — verificar taxa de valorização atual de cada programa
2. **Confirmar parâmetros com o usuário se ausentes:**
   - Origem (código IATA ou cidade)
   - Destino (código IATA ou cidade)
   - Data(s) de ida (fixa ou range: ex. 10 a 20 de junho)
   - Data(s) de volta (se ida e volta — fixa ou range)
   - N de passageiros (adultos)
   - Tipo: só ida ou ida e volta

## Execução da busca (paralelo)

Spawnar **um sub-agente por MCP disponível**, todos em paralelo. Cada sub-agente deve:
1. Ler o guide do seu MCP em `references/<site>.md`
2. Chamar o MCP do seu site com os parâmetros da busca
3. Retornar o JSON completo recebido do MCP (não filtrar nem formatar)

**MCPs e seus guides:**
- `references/seats-aero.md` — seats.aero MCP (awards/milhas)

> Quando novos MCPs forem adicionados, incluir seus guides aqui.

## Agregação e exibição

Após todos os sub-agentes retornarem, o agente principal deve:

1. Converter milhas em BRL equivalente usando `config.json`:
   ```
   custo_equiv_brl = (milhas / 1000) * taxa_por_1000 + taxas
   ```
2. Ordenar todos os voos do mais barato ao mais caro (BRL equivalente)
3. Exibir em **dois blocos**: tabela resumo + detalhes

### Bloco 1: Tabela resumo

Tabela compacta com as colunas essenciais. Manter curta e legível.

```
**Resultados VCP > LIS** | 22-24/mar/2026 | 2 adultos | Economy | Só ida

| # | Programa | Data | Milhas | ~BRL | Duração | Escalas | Voos |
|---|----------|------|--------|------|---------|---------|------|
| 1 | United | 24/mar | 45.000 | R$1.800 | 9h50 | direto | AD8750 |
| 2 | Smiles | 23/mar | 277.000 | R$11.080 | 24h50 | 2 (SSA,MAD) | G31987,UX84,UX1155 |
| 3 | Smiles | 23/mar | 332.000 | R$13.280 | 34h05 | 1 (GIG) | G31957,TP3098 |

Taxa usada: R$40/mil (config.json)
```

**Regras da tabela:**
- **Milhas**: formatar com ponto de milhar (45.000, 277.000)
- **~BRL**: valor equivalente calculado
- **Duração**: converter `duracao_min` para formato legível (1490 min = 24h50)
- **Escalas**: numero + aeroportos entre parenteses (ex: `2 (SSA,MAD)`), ou `direto` se 0
- **Voos**: números dos voos separados por vírgula
- Máximo **10 linhas** na tabela — se houver mais, mostrar os 10 melhores

### Bloco 2: Detalhes dos voos

Abaixo da tabela, listar detalhes de cada voo numerado:

```
**Detalhes:**

**1. United 45.000 mi — AD8750**
  Azul A330-900neo | VCP 18:25 > LIS 07:15 (+1) | direto | 9h50
  Emissão via United MileagePlus | 9 assentos

**2. Smiles 277.000 mi — G31987, UX84, UX1155**
  GOL 737-800 | VCP 11:25 > SSA
  Air Europa 787-9 | SSA > MAD
  Air Europa 737-800 | MAD > LIS 15:15 (+1) | 24h50 total
  Emissão via Smiles | 2 assentos
```

**Regras dos detalhes:**
- **Horários**: extrair de `horario_ida` e `horario_chegada` (formato HH:MM, indicar +1/+2 se chega em outro dia)
- **Aeronaves**: usar `aeronaves[]` para listar o modelo por trecho
- **Companhias**: usar `companhia` (carriers por trecho)
- **Assentos**: indicar assentos disponíveis de `assentos_disponiveis`
- Se muitos voos similares (mesmo programa, mesma rota, horários diferentes), agrupar: "Mais 3 opções Smiles a partir de 277.000 mi"

### Notas finais

Após os dois blocos, incluir:
- Se algum MCP não retornou resultado: "TAP, Iberia: MCPs ainda não disponíveis"
- seats.aero não vende bilhetes — "Emissão deve ser feita diretamente no programa indicado"
- Se taxas não disponíveis: "Taxas não incluídas — verificar no momento da emissão"
- Dados cacheados: "Dados do seats.aero podem não refletir disponibilidade em tempo real"

## Atualização de valor de milhas

Quando o usuário pedir para mudar o valor das milhas (ex: "muda o Smiles para 35"):
1. Ler `references/config.json`
2. Atualizar o campo correspondente em `programs`
3. Atualizar `last_updated` com a data atual
4. Salvar o arquivo
5. Confirmar a mudança para o usuário

## Conversão de moedas

**NUNCA fazer chamadas de API, web search ou qualquer lookup externo para obter taxas de câmbio.** Usar as taxas fixas de `config.json` (`currency_rates`). Se uma moeda não estiver no config, usar estimativa razoável e indicar "(taxa estimada)" no resultado.

## Notas importantes

- Não gerar ou enviar capturas de tela/imagens — basta texto/tabelas
- Se o MCP retornar erro ou não encontrar resultados, marcar como "Sem disponibilidade" e continuar
- Taxas em EUR/USD: converter para BRL usando `currency_rates` do `config.json`
- Para datas range com muitos dias: avisar o usuário que a busca pode demorar
- **Minimizar consumo de contexto**: não fazer chamadas extras desnecessárias (web search, API calls, etc.) — toda informação necessária está no config ou nos resultados do MCP
