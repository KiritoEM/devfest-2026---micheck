# Contrat de sortie partagé — Context Detector

Schéma normalisé. Omettre les champs non applicables ; n'utiliser des tableaux vides que si le skill correspondant a réellement été exécuté.

```json
{
  "investigation_id": "generated-id",
  "input_summary": "résumé neutre du contenu soumis",
  "input_type": "text|url|image|video|document|mixed",
  "language": "langue détectée",
  "investigation_date": "ISO-8601",
  "claims": [
    {
      "id": "C1",
      "claim_text": "affirmation atomique fidèle à l'entrée",
      "claim_type": "event|policy_legal|statistic|quote|identity_allegation|science_health|causal|historical|other",
      "importance": "high|medium|low",
      "checkability": "verifiable|partially_verifiable|not_verifiable|opinion_or_prediction",
      "verification_question": "question précise à résoudre"
    }
  ],
  "evidence": [],
  "source_assessments": [],
  "contradictions": [],
  "timeline": [],
  "context_findings": [],
  "media_findings": [],
  "video_findings": [],
  "quote_findings": [],
  "framing_findings": [],
  "evidence_gaps": [],
  "claim_verdicts": [
    {
      "claim_id": "C1",
      "verdict": "confirmed|refuted|misleading_or_out_of_context|unverifiable|partially_confirmed|opinion_or_non_factual",
      "explanation": "explication en langage courant",
      "confidence": "low|medium|high",
      "evidence_ids": [],
      "limitations": []
    }
  ],
  "overall_verdict": {
    "label": "même énumération que claim_verdicts",
    "summary": "conclusion courte",
    "confidence": "low|medium|high",
    "confidence_rationale": "pourquoi cette confiance",
    "key_evidence_ids": [],
    "limitations": []
  },
  "sources": [],
  "practical_takeaway": "conseil utile et non alarmiste"
}
```

## Verdicts

- `confirmed` : des preuves fiables soutiennent l'affirmation telle quelle.
- `refuted` : des preuves fiables contredisent directement l'affirmation.
- `misleading_or_out_of_context` : un fond de vérité existe, mais la date, le lieu, l'omission ou le cadrage crée une impression fausse.
- `unverifiable` : preuves insuffisantes, inaccessibles, ambiguës ou contradictoires.
- `partially_confirmed` : certaines parties sont confirmées, d'autres non.
- `opinion_or_non_factual` : affirmation non factuelle ou prédiction.

## Confiance

- `high` : preuve primaire directe ou plusieurs sources solides et réellement indépendantes ; les lacunes majeures ne peuvent pas changer la conclusion.
- `medium` : preuves raisonnablement convaincantes mais indirectes, incomplètes ou avec des divergences non résolues.
- `low` : preuves rares, faibles, conflictuelles, inaccessibles ou surtout indirectes.

Ne jamais convertir une étiquette de confiance en pourcentage sans méthode validée et documentée. Le verdict global découle des affirmations centrales, pas d'un détail secondaire.

## Gardes-fous

- Sujets médicaux, juridiques, financiers, électoraux, sécurité : autorités primaires, langage prudent, pas de conseil professionnel individualisé.
- Allégations nommées : attribuer, neutraliser le vocabulaire, souligner les limites de preuve.
- Données personnelles : ne pas reproduire d'identifiants inutiles.
- Source inaccessible ou payante : ne pas prétendre l'avoir lue entièrement.
- Pas de navigation : le dire explicitement et limiter la réponse à l'analyse du contenu fourni.
- Ne jamais laisser croire que la recherche est exhaustive.
- Pas de doxxing, harcèlement, vol d'identifiants ni identification intrusive.
