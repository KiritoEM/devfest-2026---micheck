---
name: claim-extraction
description: Use to decompose a pasted post, article, caption, screenshot text or statement into atomic verifiable factual claims, keeping qualifiers, dates, places and entities. First step of the Context Detector pipeline.
---

# Extraction des affirmations

Identifier les énoncés factuels discrets et vérifiables séparément.

## Procédure

1. Lire l'intégralité du contenu et en préserver le sens.
2. Extraire les affirmations factuelles ; diviser les énoncés composés qui peuvent être vérifiés indépendamment.
3. Conserver les qualificatifs importants : date, lieu, personnes, quantités, périmètre, causalité, degré de certitude.
4. Étiqueter chaque affirmation : `event`, `policy_legal`, `statistic`, `quote`, `identity_allegation`, `science_health`, `causal`, `historical`, `other`.
5. Signaler ce qui est ambigu, subjectif, prédictif ou non vérifiable de façon indépendante.
6. Attribuer un identifiant stable `C1`, `C2`, ... et une importance `high`, `medium` ou `low` selon le rôle dans le message.

## Sortie

`claims[]` avec `id`, `claim_text`, `claim_type`, `importance`, `entities`, `date_or_period`, `location`, `verification_question`, `ambiguities`, `checkability`.

## Contrôle qualité

Le texte d'une affirmation ne doit jamais être plus précis que le contenu d'origine. Ne pas déduire de faits non énoncés. Voir [`../context-detector/reference/contract.md`](../context-detector/reference/contract.md).
