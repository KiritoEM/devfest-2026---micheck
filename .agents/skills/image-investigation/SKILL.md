---
name: image-investigation
description: Use for a screenshot, photo, meme, chart or infographic to describe observable features, OCR visible text, collect context clues and compare the image with its caption. Requires vision, OCR or reverse-image tooling for the full procedure.
---

# Investigation d'image

Analyser une image sans confondre observation et conclusion.

## Procédure

1. Décrire uniquement les caractéristiques observables.
2. Lire le texte visible (OCR) et le transcrire en notant les incertitudes.
3. Relever les indices pertinents : panneaux, monuments, météo, uniformes, langue, dates — sans les traiter comme concluants.
4. Si la recherche d'image inversée est disponible, fouiller l'image entière et des recadrages distinctifs ; consigner les résultats réels.
5. Vérifier si la légende ou l'affirmation correspond à ce que l'image montre et à son contexte d'origine.
6. N'envisager montage, recadrage, incrustation ou génération que si des preuves le soutiennent.

## Sortie

`media_findings[]` avec `media_id`, `visual_observations`, `ocr`, `matches`, `source_ids`, `context_mismatch`, `limitations`.

## Règle

Ne pas déclarer une image authentique, manipulée ou générée par IA sur la seule inspection visuelle.

Voir [`../context-detector/reference/contract.md`](../context-detector/reference/contract.md).
