---
name: contradiction-analysis
description: Use when several sources disagree, or when a claim is contested or high impact, to distinguish genuine contradictions from differences of date, definition or population. Part of the Context Detector pipeline.
---

# Analyse des contradictions

Comparer les sources et rendre les désaccords explicites.

## Procédure

1. Comparer dates, chiffres, noms, lieux, périmètres, définitions et explications causales.
2. Distinguer contradiction réelle et différence de période, de définition ou de population.
3. Identifier la source primaire et ce que chaque source établit réellement.
4. Rapporter les preuves qui soutiennent et celles qui contredisent chaque affirmation.
5. Noter quand des sources partagent une origine commune et ne sont donc pas indépendantes.

## Sortie

`contradictions[]` avec `claim_id`, `issue`, `evidence_ids`, `explanation`, `unresolved`, `what_would_resolve_it`.

Voir [`../context-detector/reference/contract.md`](../context-detector/reference/contract.md).
