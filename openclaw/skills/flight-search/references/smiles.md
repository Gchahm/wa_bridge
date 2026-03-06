# Smiles — Guia de Pesquisa

**Site:** https://www.smiles.com.br/home
**Tipo:** Milhas (programa Smiles, parceiro da GOL)
**Programa de milhas:** Smiles

## Fluxo de Pesquisa com Playwright

### 1. Navegar
```
https://www.smiles.com.br/home
```

### 2. Selecionar tipo de viagem
- Clicar em "Passagens" → "Milhas Smiles"
- Selecionar: "Ida e volta" ou "Somente ida"

### 3. Preencher campos
- **Origem:** aeroporto ou cidade (ex: GRU – São Paulo, Guarulhos)
- **Destino:** aeroporto ou cidade (ex: LIS – Lisboa)
- **Data de ida:** conforme solicitado
- **Data de volta:** se ida e volta
- **Passageiros:** número de adultos

### 4. Capturar resultados

Para cada opção disponível, capturar:
- Milhas por passageiro
- Taxas obrigatórias em cash (R$)
- Clube Smiles vs tarifa regular (preferir regular salvo instrução contrária)
- Classe (Econômica / Executiva)
- Companhia aérea operadora
- Nº de escalas / conexões
- Link da busca (URL resultante)

### 5. Para range de datas
Smiles geralmente exibe calendário de disponibilidade. Usar o calendário para identificar os dias com menor custo em milhas. Capturar o melhor preço por dia.

## Cálculo do custo equivalente em BRL

```
custo_equivalente_brl = (milhas / 1000) * taxa_por_1000 + taxas_em_brl
```

Usar a taxa do programa `smiles` em `config.json`.

## Notas
- Smiles pode exigir login para ver disponibilidade completa — se bloqueado, registrar como "requer login"
- Taxas da Smiles já são em BRL, não precisa converter
- Diferenciar tarifas "Smiles + Dinheiro" vs "Só Milhas" quando disponível — mostrar ambas
- Link resultado: URL da página de resultados após a busca
