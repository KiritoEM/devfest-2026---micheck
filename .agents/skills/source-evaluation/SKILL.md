---
name: source-evaluation
description: Use when external evidence is available and source quality, primary/secondary status, traceability, dates, independence and syndication need to be assessed before drawing a verdict.
---

# Évaluation des sources

Évaluer la qualité et l'indépendance des sources, sans étiquette globale arbitraire.

## Critères

- Autorité et expertise sur le sujet précis.
- Source primaire, secondaire ou tertiaire.
- Transparence et traçabilité vers la preuve originale.
- Date de publication et date de mise à jour.
- Qualité et précision des éléments apportés.
- Conflits d'intérêts vérifiables le cas échéant.
- Indépendance : origine commune, syndication, copie de la même dépêche.
- Correspondance directe avec l'affirmation.

## Sortie

`source_assessments[]` avec `source_id`, `criteria_notes`, `quality_tier` (`strong`, `moderate`, `weak`, `unclear`), `independence_cluster_id`, `caveats`.

## Règles

Ne pas poser d'étiquette « fiable » ou « non fiable » sans raisons explicites. Ne pas inférer un biais de la seule propriété, identité ou opinion d'une source.

Voir [`../context-detector/reference/contract.md`](../context-detector/reference/contract.md).
