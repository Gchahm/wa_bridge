# flight-search — Playwright Scraper Implementation Plan

Use this document to build the actual Playwright automation (one scraper per site) that the `flight-search` skill will call in parallel.

## 1. Objetivo
Criar quatro scripts Playwright (ou handlers MCP) que recebam os parâmetros da busca e retornem um JSON com o melhor preço por dia para o site correspondente:
- **seats.aero** (award availability)
- **TAP** (cash + Miles&Go)
- **Smiles** (milhas)
- **Iberia** (cash + Avios)

Os resultados serão consumidos por `scripts/aggregate.py`, então **use exatamente o formato descrito abaixo**.

## 2. Entrada esperada (por scraper)
```json
{
  "origem": "VCP",
  "destino": "DUB",
  "data_ida": {
    "tipo": "range",
    "inicio": "2026-03-23",
    "fim": "2026-03-24"
  },
  "data_volta": null,
  "passageiros": 2,
  "cabine": "Economy",
  "tipo_viagem": "one_way",
  "bagagem": "sem_despachada"
}
```

## 3. Saída esperada (lista JSON)
Cada scraper retorna **lista** com até 7 objetos (um por dia do range). Campos obrigatórios:

| Campo           | Tipo    | Descrição |
|-----------------|---------|-----------|
| `site`          | string  | Nome legível ("Smiles", "TAP", etc.)
| `programa`      | string  | Programa ou "Cash"
| `programa_key`  | string/null | Chave usada em `config.json` (smiles, tap_miles_go, iberia_plus, seats_aero) ou null p/ cash
| `tipo`          | string  | `"cash"` ou `"miles"`
| `classe`        | string  | Economy / Business / etc.
| `origem`,`destino` | string | Códigos IATA
| `data_ida`,`data_volta` | string/"—" | Formato ISO `YYYY-MM-DD`
| `passageiros`   | int     | nº de adultos
| `preco_brl`     | number  | Apenas para cash (total para todos passageiros)
| `milhas`        | int     | Apenas para miles (por passageiro)
| `taxas_brl`     | number  | Apenas para miles
| `escalas`       | int/string | Nº de escalas
| `link`          | string  | URL da busca filtrada
| `observacao`    | string  | Notas (login necessário, etc.)

## 4. Regras gerais (aplicam-se a todos os scrapers)
- **Sem capturas de tela/imagens** — apenas texto/logs.
- Se o site bloquear (login/CAPTCHA), **pedir ao usuário** para intervir; logar mensagem clara.
- Sempre buscar **somente o melhor preço por dia** dentro do range solicitado.
- Converter datas DD/MM/YYYY → ISO antes de usar.
- Respeitar filtros de cabine (Economy/Business).
- Considerar apenas tarifas `sem bagagem despachada` quando aplicável (tarifas Light/Basic).
- Timeout sugerido: 90s por site.

## 5. Guias específicos
### 5.1 seats.aero (`references/seats-aero.md`)
- Endpoint: https://seats.aero/search
- Preencher origem/destino, data e classe.
- Iterar cada dia do range individualmente.
- Capturar: programa que emite, milhas por pax, taxas (USD→BRL se necessário), escalas, link da busca.
- `programa_key`: `"seats_aero"` (ou nome específico se ajustarmos o config).

### 5.2 TAP (`references/tap.md`)
- URL: https://booking.flytap.com/booking
- Duas abas: **Cash** e **Miles&Go**. Priorizar cash (tarifa econômica sem bagagem) e, em seguida, milhas.
- Range: usar calendário de preços se disponível; senão iterar datas.
- Para cash: capturar tarifa mínima do dia (total para todos passageiros) + link.
- Para Miles&Go: capturar milhas por pax + taxas (converter EUR→BRL).
- `programa_key`: `null` (cash) ou `"tap_miles_go"` (milhas).

### 5.3 Smiles (`references/smiles.md`)
- URL: https://www.smiles.com.br/home → módulo "Passagens".
- Modo "Só ida" e "Milhas Smiles".
- Preferir resultados "Sem Clube" (tarifa padrão) salvo instrução contrária.
- Capturar milhas por pax, taxas BRL, escalas, link.
- `programa_key`: `"smiles"`.

### 5.4 Iberia (`references/iberia.md`)
- URL: https://www.iberia.com/br/
- Necessário alternar entre cash e Avios (se disponível). Priorizar cash.*
- Conexões via MAD são comuns; registrar nº de escalas.
- Taxas em EUR → converter para BRL.
- `programa_key`: `null` (cash) ou `"iberia_plus"` (Avios).

*Se Avios exigir login, registrar "requer login" em `observacao` e prosseguir com cash.

## 6. Conversão de moedas
- Usar taxa aproximada fornecida (ex: 1 EUR = 5.5 BRL). Ideal: chamar API (ex. exchangerate.host) ou aceitar valor passado pelo usuário.
- Armazenar taxa usada em `observacao`.

## 7. Integração
- Cada scraper deve ser exposto como comando (ex.: `scrape-smiles`) ou handler no MCP para que o skill possa chamá-lo.
- A orquestração central fará gather e passará para `scripts/aggregate.py`.

## 8. Testes sugeridos
1. Caso base: VCP → DUB, 23–24/03/2026, 2 adultos, Economy, one-way.
2. Range maior: GRU → LIS, 01–07/12/2026, 1 adulto, ida e volta.
3. Verificar comportamento quando o site não retorna nada (deve gerar lista vazia). 

## 9. Entregáveis
- Scripts Playwright (TypeScript/JavaScript ou Python) + instruções de execução.
- Documentação rápida de como rodar cada scraper localmente.
- Atualização do `SKILL.md` ou arquivo adicional explicando como os scrapers são chamados.

Com esse plano, outro agente pode implementar os scrapers e entregar o pacote pronto para conectar ao skill.
