# MiCheck — périmètre hackathon 24 h (« Fight the misinformation »)

## 1. Alignement avec le sujet

| Attendu du hackathon | Ce qu'on a déjà | Ce qui manque |
| --- | --- | --- |
| Fake news / affirmations fausses | Extraction d'affirmations, recherche de preuves, verdicts nuancés (`confirmed`, `refuted`, `misleading_or_out_of_context`, `unverifiable`, ...) | Une interface pour que l'utilisateur puisse réellement s'en servir |
| Informations sorties de leur contexte | `context-timeline` : dates de publication events/repartage, détection de recyclage | Le montrer visuellement dans une chronologie lisible |
| Vérification des sources (NLP, Cloud, données) | Orchestrateur IA + moteur de recherche branchable + évaluation d'indépendance des sources | Une source de fact-checks existants (Google Fact Check Tools) pour accélérer la réponse |
| Images manipulées, deepfakes, contenus générés par IA | Limite explicitement déclarée dans le dossier (**on ne prétend pas détecter**) | Un module « signaux » honnête (métadonnées/EXIF, type MIME, dimensions) présenté comme indice, jamais comme verdict |
| « Aider à vérifier avant de partager » | Dossier Markdown avec citations cliquables et conseil pratique | Un bouton « copier un résumé nuancé à partager » et une interface type chat en français |
| Accessibilité grand public | Réponses en français, verdicts libellés en français | Une seule page claire, mobile, sans jargon |
| Réseaux sociaux / messageries | API REST publique | Un vrai bot externe est hors périmètre 24 h ; prévoir un webhook Telegram en option uniquement |

**Conclusion :** le sujet est bien couvert sur le fond. Le vrai manque, c'est la **démonstration utilisateur** : aujourd'hui le produit est un backend, pas encore un outil que quelqu'un peut utiliser en 30 secondes.

## 2. État actuel (ce qui existe déjà)

- 14 skills IA (orchestrateur + 13 étapes) dans `.agents/skills/`.
- Pipeline complet : extraction → plan de recherche → recherche web → évaluation des sources → contradictions → chronologie → verdicts → dossier.
- 4 endpoints : `POST /api/context-detector/claims`, `POST /api/context-detector/investigate`, `GET /api/context-detector/skills`, `GET /api/context-detector/investigations/{id}`.
- Documentation Swagger `/api/docs`, spec `/api/openapi`.
- Garde-fou important : les URL citées sont construites côté serveur à partir des résultats de recherche **réellement récupérés**, donc pas de citation inventée. Sans preuve, le verdict est `unverifiable`.
- Configuration : clés IA par fournisseur (`GROQ`, `XAI`, `MISTRAL`, `GEMINI`, `HF`) essayées dans l'ordre de `CONTEXT_DETECTOR_AI_PROVIDERS`, puis tout fournisseur doté d'une clé ; recherche via `CONTEXT_DETECTOR_SEARCH_PROVIDERS` (Tavily en premier, repli Brave/générique). Voir `.env.example` (sans secrets).

**Ce que ce n'est pas :** pas d'OCR réel, pas de recherche d'image inversée, pas d'analyse de vidéo/images clés, pas de modèle de détection de deepfake, pas de base de données persistante.

## 3. Fonctionnalités à ajouter, priorisées

### P0 — indispensables pour la démo

1. **Page « Vérifier » en un seul écran** — textarea, upload d'image, bouton « Vérifier », bulles de conversation type bot, carte de résultat avec verdict coloré, confiance, affirmations, citations et limites. Appel direct à `/api/context-detector/investigate`. Effort : moyen. Impact : maximal.
2. **Fact-checks existants en source supplémentaire** — interroger Google Fact Check Tools avec la requête de l'affirmation ; si un résultat est trouvé, l'ajouter comme preuve avec sa citation. Sans clé ou sans résultat, on dégrade proprement. Effort : faible. Impact : fort sur la crédibilité du démo.
3. **Bouton « partager prudemment »** — copie un résumé en 3 lignes : verdict + une citation + « À vérifier avant de partager ». Évite le résultat « vrai/faux » nucléaire. Effort : faible. Impact : fort (répond directement à l'énoncé).
4. **Jeu de démo + README reproductible** — 3 scénarios (voir §5), 10 cas de test rapides, instructions `npm i` + `.env` + `npm run dev` en 5 minutes. Effort : faible. Impact : fort pour les juges.

### P1 — si le temps reste

5. **Module « signaux média »** — lire le type MIME, les dimensions et les métadonnées/EXIF d'une image uploadée, afficher « ces signaux ne prouvent pas l'authenticité ». Effort : faible/moyen. Impact : montre qu'on a traité le volet deepfake **sans surpromettre**.
6. **Étapes visibles en direct** — « Affirmations extraites → Recherche → Analyse → Dossier » avec un simple état React (pas besoin de streaming serveur). Effort : faible. Impact : la démo paraît plus « IA ».
7. **Feedback utilisateur** — « ce verdict vous aide-t-il ? » stocké en mémoire ou affiché en console pour la calibration des prompts. Effort : faible.
8. **Webhook Telegram** — branchement optionnel d'un vrai bot si un token et une URL publique sont disponibles. Effort : moyen. Impact : démo uniquement.

### P2 — à ne pas faire pendant ces 24 h

OCR/Tesseract, extraction d'images clés ffmpeg, recherche d'image inversée, entraînement d'un détecteur de deepfake, comptes/utilisateurs, base de données, extension navigateur, multi-langue approfondie.

## 4. Planning suggéré (24 h)

| Créneau | Travail |
| --- | --- |
| 0–2 h | Cadrage, choix des 3 scénarios, vérification des clés API |
| 2–6 h | Page « Vérifier » + branchement API + carte de résultat |
| 6–10 h | Fact-checks existants + module signaux média |
| 10–14 h | Partage prudent, étapes visibles, finitions UI mobile |
| 14–18 h | Tests sur les 10 cas, ajustement des prompts, gestion des erreurs |
| 18–22 h | Répétition du pitch, captures d'écran, README |
| 22–24 h | Buffer / imprévus |

## 5. Scénarios de démo

1. **Fausse loi virale** : « Une nouvelle loi interdit X dès demain. » → affirmations extraites, recherche, verdict nuancé, sources datées.
2. **Vidéo recyclée** : une vidéo de 2021 présentée comme actuelle → `misleading_or_out_of_context`, chronologie avec « première publication trouvée » et mise en garde explicite.
3. **Image sans source / soupçon d'IA** → `unverifiable`, limites affichées, signaux média indiqués comme indices et non comme preuve.

## 6. Critères de réussite

- Les 3 scénarios passent en moins d'une minute chacun.
- Chaque verdict contient au moins une citation cliquable **ou** dit explicitement « non vérifiable ».
- Aucune URL ni date inventée.
- Interface française, lisible sur mobile.
- La limite « on ne détecte pas les deepfakes de manière fiable » est visible dans l'UI.
- Le projet est reproductible par un juge en 5 minutes.

## 7. Non-objectifs

- Ne pas promettre une détection fiable des deepfakes ou des contenus générés par IA.
- Ne pas présenter un outil « qui dit le vrai du faux » : on produit un **dossier de vérification**.
- Ne pas rendre le bot externe obligatoire pour la démo.
- Ne pas ajouter de paiement, de comptes ou de persistances lourdes.

## 8. Notes techniques

- Prototype public sans authentification : si déploiement public, ajouter un rate limiting et réutiliser le reCAPTCHA déjà présent dans le dépôt.
- Le stockage des dossiers est en mémoire (30 min) : suffisant pour la démo, à remplacer par une base plus tard.
- Le moteur de recherche est abstrait (`generic`, `brave`, `tavily`) : garder le même contrat de réponse pour ajouter un fournisseur.
- Ne jamais committer les clés : `.env` reste local, seul `.env.example` est versionné.
