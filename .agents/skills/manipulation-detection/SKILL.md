---
name: manipulation-detection
description: Use for persuasive, sensational, emotionally charged, political, commercial or viral content to identify framing techniques such as missing context, false dichotomy, selective statistics or vague attribution, without basing the verdict on rhetoric alone.
---

# Détection du cadrage

Décrire les techniques rhétoriques observables sans en faire dépendre le verdict factuel.

## À inspecter

- Certitude non étayée.
- Manque de contexte.
- Faux dilemme.
- Cadrage émotionnel.
- Comparaison trompeuse.
- Statistique sélective.
- Attribution vague.
- Appel à l'autorité.
- Saut causal.
- Contenu recyclé.
- Indices d'usurpation d'identité.

## Sortie

`framing_findings[]` avec `technique`, `excerpt`, `explanation`, `affects_factual_interpretation`.

## Règle

Décrire le cadrage observé. Ne pas qualifier une personne ou un groupe de « manipulateur » sur la seule base du ton.

Voir [`../context-detector/reference/contract.md`](../context-detector/reference/contract.md).
