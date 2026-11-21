---
name: evidence-gap-analysis
description: Use before any verdict to make uncertainty explicit: what is established, what remains unknown, which evidence is missing, whether the gap is material, and what evidence would be most useful next.
---

# Analyse des manques de preuves

Rendre visibles l'incertitude et les preuves absentes.

## Procédure

1. Pour chaque affirmation, lister ce qui est établi, ce qui reste inconnu et la preuve manquante.
2. Identifier les sources inaccessibles, plateformes non fouillables, dates absentes, pièces originales manquantes ou analyses médiatiques limitées.
3. Déterminer si le manque est matériel pour le verdict.
4. Recommander la prochaine preuve la plus utile, le cas échéant.

## Sortie

`evidence_gaps[]` avec `claim_id`, `missing_evidence`, `impact` (`material`, `minor`), `reason`, `next_step`.

Un manque matériel impose la prudence, voire le verdict `unverifiable` ; il ne constitue pas une preuve de fausseté.

Voir [`../context-detector/reference/contract.md`](../context-detector/reference/contract.md).
