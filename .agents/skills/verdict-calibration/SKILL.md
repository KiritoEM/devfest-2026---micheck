---
name: verdict-calibration
description: Use once evidence analysis is complete to assign nuanced claim-level verdicts and an overall verdict, with a qualitative confidence level and an explanation. Final decision step of the Context Detector pipeline.
---

# Calibration du verdict

Produire des conclusions nuancées, proportionnées aux preuves.

## Verdicts autorisés

- `confirmed` : des preuves fiables soutiennent l'affirmation telle quelle.
- `refuted` : des preuves fiables la contredisent directement.
- `misleading_or_out_of_context` : un fond de vérité existe mais le cadrage induit en erreur.
- `unverifiable` : preuves insuffisantes, inaccessibles, ambiguës ou non concluantes.
- `partially_confirmed` : des parties importantes sont vraies, d'autres non.
- `opinion_or_non_factual` : non soumis à vérification factuelle.

## Procédure

1. Évaluer chaque affirmation séparément.
2. Tenir compte de la solidité des sources, de leur indépendance, de leur caractère direct, des contradictions, des dates et des manques de preuves.
3. Expliquer le verdict en langage courant.
4. Donner une confiance qualitative `low`, `medium` ou `high` et en expliquer les raisons ; aucun pourcentage.
5. Dériver le verdict global des affirmations centrales.

## Sortie

`claim_verdicts[]` et `overall_verdict` conformes au [contrat partagé](../context-detector/reference/contract.md).
