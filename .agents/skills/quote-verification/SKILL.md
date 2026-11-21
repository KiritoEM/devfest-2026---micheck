---
name: quote-verification
description: Use when a post contains quoted speech, an attributed statement, a quote screenshot, or a paraphrase presented as exact wording. Compares it with the original source, including omissions and translation.
---

# Vérification de citation

Comparer des propos rapportés avec leur source originale.

## Procédure

1. Rechercher la citation exacte et ses variantes.
2. Localiser le discours, l'interview, la transcription, le document ou la publication originale.
3. Comparer les mots exacts, omissions, ellipses, traduction et contexte environnant.
4. Distinguer citation exacte, traduction, paraphrase et propos non attribués.

## Sortie

`quote_findings[]` avec `quoted_text`, `attribution`, `original_source`, `match_type` (`exact`, `translation`, `paraphrase`, `unattributed`, `unverified`), `context`, `limitations`.

Ne pas conclure à une citation fabrication sans source originale consultable.

Voir [`../context-detector/reference/contract.md`](../context-detector/reference/contract.md).
