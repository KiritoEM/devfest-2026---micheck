---
name: video-investigation
description: Use for an uploaded clip or a video link to check accessibility, inspect representative frames and transcripts, and compare upload, publication and alleged event dates. Requires frame extraction and transcription tooling for the full procedure.
---

# Investigation de vidéo

Examiner la provenance et le contexte d'une vidéo.

## Procédure

1. Confirmer que la vidéo est accessible ; le dire sinon.
2. Si les outils le permettent, extraire des images clés à intervalles représentatifs et transcrire l'audio ou les sous-titres.
3. Analyser les images clés avec le skill `image-investigation`.
4. Rechercher les images, formulations, lieux et détails d'événement distinctifs pour trouver des publications antérieures.
5. Comparer date de mise en ligne, date de publication et date de l'événement allégué.
6. Préciser si la vérification porte sur toute la vidéo ou seulement sur certains plans ou segments.

## Sortie

`video_findings[]` avec `accessible`, `segment_notes`, `transcript_snippets`, `provenance_matches`, `timeline`, `verified_scope`, `limitations`.

## Règle

Ne pas affirmer une vérification complète si seuls quelques plans ou une transcription ont été examinés.

Voir [`../context-detector/reference/contract.md`](../context-detector/reference/contract.md).
