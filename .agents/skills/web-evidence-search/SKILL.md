---
name: web-evidence-search
description: Use when a search plan exists for a verifiable claim and live web evidence is needed. Retrieves candidate sources, opens promising results, and looks for disconfirming evidence. Requires a configured web search tool.
---

# Recherche de preuves sur Internet

Récupérer des sources pertinentes sans confondre pistes et preuves.

## Procédure

1. Rechercher avec les requêtes du plan et la plage de dates pertinente.
2. Ouvrir les résultats prometteurs ; ne pas se fier aux seuls extraits pour une affirmation importante.
3. Enregistrer les sources et les passages pertinents avec leur contexte.
4. Chercher explicitement des éléments susceptibles de réfuter l'affirmation.
5. Suivre les liens vers le matériel primaire quand il existe.
6. Élargir les requêtes si les résultats sont rares et signaler la limite.

## Sortie

`evidence[]` avec `source_id`, `claim_ids`, `url`, `title`, `publisher/author`, `published_date`, `accessed_date`, `source_type`, `excerpt`, `stance` (`supports`, `contradicts`, `contextualizes`, `neutral`), `relevance`, `retrieval_notes`.

## Limites

Un résultat de recherche n'est pas une preuve ; un extrait est une piste. Ne jamais fabriquer de métadonnée de source. Dans ce dépôt, le moteur est branché via `CONTEXT_DETECTOR_SEARCH_PROVIDER` ; sans moteur configuré, la recherche est déclarée indisponible.

Voir [`../context-detector/reference/contract.md`](../context-detector/reference/contract.md).
