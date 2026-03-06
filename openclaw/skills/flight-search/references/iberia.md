# Iberia — Guia de Pesquisa

**Site:** https://www.iberia.com/br/
**Tipo:** Cash (tarifas regulares) + Iberia Plus (Avios)
**Programa de milhas:** Iberia Plus (Avios)

## Fluxo de Pesquisa com Playwright

### 1. Navegar
```
https://www.iberia.com/br/
```

### 2. Selecionar tipo de busca
- Para **cash:** usar o formulário padrão de busca de voos
- Para **Avios:** clicar em "Voos de prêmio" ou "Usar Avios" (aba específica)

### 3. Preencher campos
- **Tipo de viagem:** Ida e volta / Só ida
- **Origem:** aeroporto (ex: GRU)
- **Destino:** aeroporto (ex: LIS ou MAD)
- **Data de ida:** conforme solicitado
- **Data de volta:** se ida e volta
- **Passageiros:** número de adultos

### 4. Capturar resultados

Para **busca cash**, capturar por data:
- Tarifa mais barata do dia
- Classe (Economy / Business)
- Nº de escalas
- Companhia operadora (Iberia, Iberia Express, codeshare)
- Link da busca

Para **busca Avios**, capturar:
- Avios por passageiro (ida + volta separados se possível)
- Taxas obrigatórias em cash (EUR ou BRL)
- Classe (Economy / Business / First)
- Nº de escalas
- Link da busca

### 5. Para range de datas
Verificar se Iberia exibe calendário de preços — se sim, usar para capturar mínimo por dia. Caso contrário, iterar data a data.

## Cálculo do custo equivalente em BRL (Avios)

```
custo_equivalente_brl = (avios / 1000) * taxa_por_1000 + taxas_em_brl
```

Usar a taxa do programa `iberia_plus` em `config.json`.

## Notas
- Avios são intercambiáveis com British Airways Executive Club — mesma valorização
- Taxas em EUR devem ser convertidas para BRL (buscar taxa de câmbio aproximada)
- Iberia opera GRU → MAD → LIS (conexão em Madri é comum)
- Link resultado: URL da página de resultados com parâmetros da busca
