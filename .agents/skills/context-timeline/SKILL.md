---
name: context-timeline
description: Use when a claim refers to a current event, contains dates or places, or may be recycled old content. Builds a timeline to detect old, relocated or out-of-context information.
---

# Chronologie et contexte

Détecter l'information ancienne recyclée, déplacée ou sortie de son contexte.

## Procédure

1. Distinguer date de publication originale, date de l'événement et date de repartage.
2. Rechercher les formulations distinctives, détails visuels, noms et descriptions d'événement pour trouver des occurrences antérieures.
3. Comparer le lieu allégué avec les sources et les indices visibles, sans surinterpréter la géolocalisation.
4. Construire une chronologie courte des occurrences significatives.
5. Expliquer si le sens a changé à cause de la date, du lieu, d'une omission ou d'événements postérieurs.

## Sortie

`timeline[]` avec `date`, `event`, `source_ids`, `date_certainty`, `significance` ; et `context_findings[]`.

## Règle

« Première publication trouvée » signifie la plus ancienne occurrence trouvée pendant cette recherche, pas nécessairement la première absolue.

Voir [`../context-detector/reference/contract.md`](../context-detector/reference/contract.md).
