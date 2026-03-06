#!/usr/bin/env python3
"""
aggregate.py — Agrega resultados de busca de voos de múltiplos sites,
converte milhas para BRL equivalente e ordena do melhor ao pior preço.

Uso:
    python3 aggregate.py <results.json> [--config config.json]

Formato de entrada (results.json):
    Lista de objetos com os campos abaixo.

Formato de saída:
    Tabela markdown ordenada por custo_equivalente_brl (ascendente).
"""

import json
import sys
import argparse
from typing import Optional

REQUIRED_FIELDS = [
    "site", "programa", "classe", "origem", "destino",
    "data_ida", "passageiros", "tipo"  # tipo: cash | miles
]

def load_config(config_path: str) -> dict:
    with open(config_path) as f:
        return json.load(f)

def miles_to_brl(miles: int, program: str, config: dict, passengers: int = 1) -> float:
    """Converte milhas para BRL equivalente."""
    programs = config["miles_valuation"]["programs"]
    per = config["miles_valuation"]["per"]
    rate = programs.get(program, config["miles_valuation"].get("default_brl_per_1000", 40))
    return (miles / per) * rate * passengers

def format_price(result: dict, config: dict) -> tuple[float, str]:
    """Retorna (custo_equivalente_brl, display_price)."""
    tipo = result.get("tipo", "cash")
    passengers = result.get("passageiros", 1)

    if tipo == "cash":
        brl = result.get("preco_brl", 0)
        display = f"R$ {brl:,.0f}"
        return brl, display

    elif tipo == "miles":
        milhas = result.get("milhas", 0)
        taxas = result.get("taxas_brl", 0)
        programa_key = result.get("programa_key", "seats_aero")
        programs = config["miles_valuation"]["programs"]
        per = config["miles_valuation"]["per"]
        rate = programs.get(programa_key, 40)

        milhas_total = milhas * passengers
        brl_equiv = (milhas_total / per) * rate + taxas
        display = f"{milhas:,} mi + R$ {taxas:,.0f} ≈ R$ {brl_equiv:,.0f} ({rate}/mil)"
        return brl_equiv, display

    return float("inf"), "N/A"

def aggregate_and_sort(results: list, config: dict) -> list:
    enriched = []
    for r in results:
        brl, display = format_price(r, config)
        enriched.append({**r, "_custo_brl": brl, "_display": display})

    # Ordenar por custo equivalente em BRL (melhor ao pior)
    return sorted(enriched, key=lambda x: x["_custo_brl"])

def render_markdown(results: list) -> str:
    if not results:
        return "Nenhum resultado encontrado."

    lines = [
        "| # | Site | Programa | Classe | Rota | Data Ida | Data Volta | Passag. | Preço | Escalas | Link |",
        "|---|------|----------|--------|------|----------|------------|---------|-------|---------|------|"
    ]

    for i, r in enumerate(results, 1):
        rota = f"{r.get('origem','?')} → {r.get('destino','?')}"
        data_volta = r.get("data_volta", "—")
        escalas = r.get("escalas", "?")
        link = r.get("link", "")
        link_fmt = f"[🔗]({link})" if link else "—"

        lines.append(
            f"| {i} | {r.get('site','')} | {r.get('programa','')} | {r.get('classe','')} "
            f"| {rota} | {r.get('data_ida','')} | {data_volta} "
            f"| {r.get('passageiros',1)} | {r['_display']} | {escalas} | {link_fmt} |"
        )

    return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser(description="Agrega e ordena resultados de busca de voos")
    parser.add_argument("results", help="JSON com lista de resultados")
    parser.add_argument("--config", default="references/config.json", help="Path para config.json")
    args = parser.parse_args()

    with open(args.results) as f:
        results = json.load(f)

    config = load_config(args.config)
    sorted_results = aggregate_and_sort(results, config)
    print(render_markdown(sorted_results))

if __name__ == "__main__":
    main()
