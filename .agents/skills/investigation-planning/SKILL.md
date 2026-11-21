---
name: investigation-planning
description: Use after claim extraction to build a targeted evidence search plan per verifiable claim, with query variants, source targets, and criteria for supporting or contradicting evidence. Part of the Context Detector pipeline.
---

# Planification de la recherche

Préparer une recherche efficace et contradictoire pour chaque affirmation vérifiable.

## Procédure

1. Identifier les entités, les autorités probables, les juridictions, les dates et les mots-clés.
2. Créer plusieurs variantes de requêtes : phrase exacte, entités clés, date et lieu, affirmation + « officiel », affirmation + « fact check », et une requête de contradiction.
3. Choisir des types de sources adaptés au domaine : actes officiels, déclarations originales, articles scientifiques, presse de qualité, archives, fact-checkers spécialisés.
4. Définir ce qui confirmerait, contredirait ou laisserait l'affirmation non résolue.
5. Prioriser les sources primaires ; utiliser des sources secondaires indépendantes pour interpréter ou corroborer.

## Sortie

`search_plan[]` avec `claim_id`, `queries`, `source_targets`, `supporting_evidence_criteria`, `contradicting_evidence_criteria`, `expected_limitations`.

Voir [`../context-detector/reference/contract.md`](../context-detector/reference/contract.md).
