import { Dossier, VerdictLabel } from "@/lib/context-detector/types";

export const VERDICT_LABELS_FR: Record<VerdictLabel, string> = {
    confirmed: "Confirmé",
    refuted: "Réfuté",
    misleading_or_out_of_context: "Trompeur ou hors contexte",
    unverifiable: "Non vérifiable",
    partially_confirmed: "Partiellement confirmé",
    opinion_or_non_factual: "Opinion ou non factuel",
};

const CONFIDENCE_LABELS_FR = {
    low: "faible",
    medium: "moyenne",
    high: "élevée",
} as const;

const list = (items: string[]): string =>
    items.length ? items.map((item) => `- ${item}`).join("\n") : "- Aucun élément renseigné.";

const citation = (sourceId: string, dossier: Dossier): string => {
    const source = dossier.sources.find((item) => item.source_id === sourceId);
    if (!source) {
        return sourceId;
    }
    const details = [source.publisher, source.published_date]
        .filter(Boolean)
        .join(" — ");
    return `[${sourceId} : ${source.title}${details ? ` — ${details}` : ""}](${source.url})`;
};

export const renderDossierReport = (dossier: Dossier): string => {
    const sections: string[] = [];
    const overall = dossier.overall_verdict;

    sections.push(
        `## ${VERDICT_LABELS_FR[overall.label]} — dossier de vérification`,
        "",
        `**Résumé :** ${overall.summary || "Aucun résumé disponible."}`,
        "",
        `**Date de l'enquête :** ${dossier.investigation_date}`,
        "",
        "### Ce qui a été soumis",
        "",
        dossier.input_summary || "Aucune description disponible.",
        "",
        "### Affirmations vérifiées",
        "",
    );

    dossier.claims.forEach((claim) => {
        const verdict = dossier.claim_verdicts.find((item) => item.claim_id === claim.id);
        const verdictLabel = verdict
            ? VERDICT_LABELS_FR[verdict.verdict]
            : VERDICT_LABELS_FR.unverifiable;
        sections.push(`- **${claim.id} — ${claim.claim_text}** → ${verdictLabel}`);

        if (verdict?.explanation) {
            sections.push(`  - Explication : ${verdict.explanation}`);
        }
        if (verdict?.evidence_ids.length) {
            sections.push(
                `  - Preuves : ${verdict.evidence_ids.map((id) => citation(id, dossier)).join(", ")}`,
            );
        }
        if (verdict?.limitations.length) {
            sections.push(`  - Limites : ${list(verdict.limitations)}`);
        }
    });

    if (dossier.timeline?.length) {
        sections.push("", "### Chronologie et contexte", "");
        dossier.timeline.forEach((entry) => {
            const sources = entry.source_ids.map((id) => citation(id, dossier)).join(", ");
            sections.push(
                `- ${entry.date} : ${entry.event}${sources ? ` — ${sources}` : ""} (date ${entry.date_certainty}).`,
            );
        });
    }

    if (dossier.context_findings?.length) {
        sections.push(
            "",
            "### Constats de contexte",
            "",
            list(dossier.context_findings.map((finding) => finding.finding)),
        );
    }

    if (dossier.source_assessments?.length) {
        sections.push("", "### Qualité et indépendance des sources", "");
        dossier.source_assessments.forEach((assessment) => {
            sections.push(
                `- ${citation(assessment.source_id, dossier)} : ${assessment.quality_tier}, cluster d'indépendance ${assessment.independence_cluster_id}. ${assessment.criteria_notes}`,
            );
        });
    }

    if (dossier.media_findings?.length || dossier.video_findings?.length) {
        sections.push("", "### Analyse des médias", "");
        (dossier.media_findings ?? []).forEach((finding) => {
            sections.push(`- **${finding.media_id}**`);
            finding.visual_observations.forEach((observation) => {
                sections.push(`  - Observation : ${observation}`);
            });
            if (finding.ocr) {
                sections.push(`  - Texte visible : ${finding.ocr}`);
            }
            finding.limitations.forEach((limitation) => {
                sections.push(`  - Limite : ${limitation}`);
            });
        });
        (dossier.video_findings ?? []).forEach((finding) => {
            sections.push(`- **${finding.media_id}** : ${finding.verified_scope}`);
            finding.limitations.forEach((limitation) => {
                sections.push(`  - Limite : ${limitation}`);
            });
        });
    }

    sections.push("", "### Ce qui reste inconnu", "");
    const gaps = [
        ...(dossier.evidence_gaps ?? []).map(
            (gap) => `${gap.claim_id} : ${gap.missing_evidence} (${gap.impact}). ${gap.next_step}`,
        ),
        ...overall.limitations,
        ...dossier.limitations,
    ];
    sections.push(list(gaps));

    sections.push(
        "",
        `**Confiance :** ${CONFIDENCE_LABELS_FR[overall.confidence]} — ${overall.confidence_rationale || "raison non renseignée"}`,
        "",
        "### À retenir",
        "",
        dossier.practical_takeaway || "Aucun conseil pratique disponible.",
        "",
        "### Sources",
        "",
    );

    sections.push(
        dossier.sources.length
            ? list(
                  dossier.sources.map((source) => {
                      const details = [source.publisher, source.published_date]
                          .filter(Boolean)
                          .join(" — ");
                      return `${details ? `${details} — ` : ""}[${source.title}](${source.url}) (consulté le ${source.accessed_date})`;
                  }),
              )
            : "- Aucune source externe vérifiable n'a pu être citée.",
    );

    return sections.join("\n");
};
