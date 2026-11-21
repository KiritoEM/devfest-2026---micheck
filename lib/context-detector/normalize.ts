import {
    dataUrlByteSize,
    isSupportedImageDataUrl,
    MAX_IMAGE_BYTES,
    MAX_VIDEO_FRAMES,
} from "@/lib/context-detector/image-data";
import {
    Checkability,
    Claim,
    ClaimType,
    ClaimVerdict,
    Confidence,
    Contradiction,
    ContextFinding,
    Evidence,
    EvidenceGap,
    FramingFinding,
    Importance,
    InvestigationInput,
    InvestigationOptions,
    InvestigationRequest,
    MediaFinding,
    MediaInput,
    OverallVerdict,
    QuoteFinding,
    Relevance,
    SearchPlan,
    SearchResult,
    Source,
    SourceAssessment,
    SourceQuality,
    Stance,
    TimelineEntry,
    VerdictLabel,
    VideoFinding,
} from "@/lib/context-detector/types";

export class ContextDetectorValidationError extends Error {
    readonly code = "INVALID_INPUT";
}

const CLAIM_TYPES: ClaimType[] = [
    "event",
    "policy_legal",
    "statistic",
    "quote",
    "identity_allegation",
    "science_health",
    "causal",
    "historical",
    "other",
];
const IMPORTANCES: Importance[] = ["high", "medium", "low"];
const CHECKABILITIES: Checkability[] = [
    "verifiable",
    "partially_verifiable",
    "not_verifiable",
    "opinion_or_prediction",
];
const VERDICTS: VerdictLabel[] = [
    "confirmed",
    "refuted",
    "misleading_or_out_of_context",
    "unverifiable",
    "partially_confirmed",
    "opinion_or_non_factual",
];
const CONFIDENCES: Confidence[] = ["low", "medium", "high"];
const STANCES: Stance[] = ["supports", "contradicts", "contextualizes", "neutral"];
const RELEVANCES: Relevance[] = ["high", "medium", "low"];
const QUALITIES: SourceQuality[] = ["strong", "moderate", "weak", "unclear"];
const IMPACTS: Array<"material" | "minor"> = ["material", "minor"];
const DATE_CERTAINTIES: Array<"certain" | "approximate" | "unknown"> = [
    "certain",
    "approximate",
    "unknown",
];
const MATCH_TYPES: QuoteFinding["match_type"][] = [
    "exact",
    "translation",
    "paraphrase",
    "unattributed",
    "unverified",
];
const MAX_TEXT_LENGTH = 20000;
const MAX_MEDIA = 10;

export const asRecord = (value: unknown): Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const asString = (value: unknown, fallback = ""): string =>
    typeof value === "string" ? value : fallback;

const asOptionalString = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;

const asStringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        : [];

const asEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    typeof value === "string" && (allowed as readonly string[]).includes(value)
        ? (value as T)
        : fallback;

const validateImageDataUrl = (value: string, label: string): string => {
    if (!isSupportedImageDataUrl(value)) {
        throw new ContextDetectorValidationError(
            `${label} doit être une image JPEG, PNG ou WebP encodée en base64.`,
        );
    }
    if (dataUrlByteSize(value) > MAX_IMAGE_BYTES) {
        throw new ContextDetectorValidationError(
            `${label} dépasse ${MAX_IMAGE_BYTES / (1024 * 1024)} Mo.`,
        );
    }
    return value;
};

const parseMedia = (value: unknown): MediaInput[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.slice(0, MAX_MEDIA).map((item, index) => {
        const media = asRecord(item);
        const type = asEnum(media.type, ["image", "video", "document"] as const, "image");
        const rawDataUrl = asOptionalString(media.dataUrl);
        const dataUrl = rawDataUrl
            ? validateImageDataUrl(rawDataUrl, `media[${index}].dataUrl`)
            : undefined;
        const frames = (Array.isArray(media.frames) ? media.frames : [])
            .slice(0, MAX_VIDEO_FRAMES)
            .map((frame, frameIndex) => {
                const rawFrame = asOptionalString(frame);
                if (!rawFrame) {
                    throw new ContextDetectorValidationError(
                        `media[${index}].frames[${frameIndex}] est vide.`,
                    );
                }
                return validateImageDataUrl(
                    rawFrame,
                    `media[${index}].frames[${frameIndex}]`,
                );
            });

        return {
            type,
            url: asOptionalString(media.url),
            dataUrl,
            ...(frames.length ? { frames } : {}),
            name: asOptionalString(media.name),
            mimeType: asOptionalString(media.mimeType),
        };
    });
};

export const validateInvestigationRequest = (body: unknown): InvestigationRequest => {
    const record = asRecord(body);
    const rawContent = record.content;
    let input: InvestigationInput;

    if (typeof rawContent === "string") {
        if (!rawContent.trim()) {
            throw new ContextDetectorValidationError("Le contenu soumis est vide.");
        }
        input = { type: "text", text: rawContent.slice(0, MAX_TEXT_LENGTH) };
    } else {
        const content = asRecord(rawContent);
        const text = asOptionalString(content.text);
        const url = asOptionalString(content.url);
        const media = parseMedia(content.media);

        if (!text && !url && media.length === 0) {
            throw new ContextDetectorValidationError(
                "Fournissez au moins un texte, une URL ou un média dans content.",
            );
        }
        if (text && text.length > MAX_TEXT_LENGTH) {
            throw new ContextDetectorValidationError(
                `Le texte soumis dépasse ${MAX_TEXT_LENGTH} caractères.`,
            );
        }

        const declaredType = asOptionalString(content.type);
        const inputTypes: InvestigationInput["type"][] = [
            "text",
            "url",
            "image",
            "video",
            "document",
            "mixed",
        ];
        input = {
            type: inputTypes.find((candidate) => candidate === declaredType),
            text,
            url,
            media: media.length ? media : undefined,
        };
    }

    const rawOptions = asRecord(record.options);
    const options: InvestigationOptions = {};
    const language = asOptionalString(rawOptions.language);
    const investigationDate = asOptionalString(rawOptions.investigationDate);

    if (language) {
        options.language = language;
    }
    if (investigationDate && !Number.isNaN(Date.parse(investigationDate))) {
        options.investigationDate = investigationDate;
    }
    if (Array.isArray(rawOptions.skills)) {
        options.skills = asStringArray(rawOptions.skills).slice(0, 20);
    }
    if (typeof rawOptions.includeReport === "boolean") {
        options.includeReport = rawOptions.includeReport;
    }
    if (typeof rawOptions.skipSearch === "boolean") {
        options.skipSearch = rawOptions.skipSearch;
    }

    return { content: input, options };
};

export const normalizeClaims = (value: unknown): Claim[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((item, index) => {
        const claim = asRecord(item);
        const claimText = asString(claim.claim_text).trim();
        if (!claimText) {
            return [];
        }

        return [
            {
                id: asString(claim.id).trim() || `C${index + 1}`,
                claim_text: claimText,
                claim_type: asEnum(claim.claim_type, CLAIM_TYPES, "other"),
                importance: asEnum(claim.importance, IMPORTANCES, "medium"),
                entities: asStringArray(claim.entities),
                date_or_period: asOptionalString(claim.date_or_period),
                location: asOptionalString(claim.location),
                verification_question: asString(claim.verification_question).trim(),
                ambiguities: asStringArray(claim.ambiguities),
                checkability: asEnum(claim.checkability, CHECKABILITIES, "verifiable"),
            },
        ];
    });
};

export const normalizeSearchPlans = (
    value: unknown,
    claims: Claim[],
): SearchPlan[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const claimIds = new Set(claims.map((claim) => claim.id));

    return value.flatMap((item) => {
        const plan = asRecord(item);
        const claimId = asString(plan.claim_id).trim();
        if (!claimIds.has(claimId)) {
            return [];
        }

        return [
            {
                claim_id: claimId,
                queries: asStringArray(plan.queries).slice(0, 4),
                source_targets: asStringArray(plan.source_targets),
                supporting_evidence_criteria: asString(plan.supporting_evidence_criteria),
                contradicting_evidence_criteria: asString(
                    plan.contradicting_evidence_criteria,
                ),
                expected_limitations: asStringArray(plan.expected_limitations),
            },
        ];
    });
};

export const buildEvidencePacket = (
    results: SearchResult[],
    accessedDate: string,
): Evidence[] =>
    results.map((result, index) => ({
        source_id: `S${index + 1}`,
        claim_ids: [],
        url: result.url,
        title: result.title,
        publisher: result.publisher,
        published_date: result.publishedDate,
        accessed_date: accessedDate,
        source_type: "resultat_de_recherche",
        excerpt: result.snippet,
        stance: "neutral",
        relevance: "medium",
        retrieval_notes: `Requête : ${result.query}. Résultat de recherche non ouvert automatiquement.`,
    }));

export const normalizeEvidence = (
    value: unknown,
    packet: Evidence[],
): Evidence[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const byId = new Map(packet.map((item) => [item.source_id, item]));
    const seen = new Set<string>();

    return value.flatMap((item) => {
        const evidence = asRecord(item);
        const sourceId = asString(evidence.source_id).trim();
        const source = byId.get(sourceId);
        if (!source || seen.has(sourceId)) {
            return [];
        }
        seen.add(sourceId);

        // url, title, publisher, excerpt, published_date and accessed_date always
        // come from the retrieved search result (the packet), never from the model:
        // otherwise the model could attach an invented quote or date to a real URL.
        return [
            {
                ...source,
                claim_ids: asStringArray(evidence.claim_ids),
                source_type: asString(evidence.source_type, source.source_type),
                stance: asEnum(evidence.stance, STANCES, "neutral"),
                relevance: asEnum(evidence.relevance, RELEVANCES, "medium"),
                retrieval_notes: asOptionalString(evidence.retrieval_notes) ?? source.retrieval_notes,
            },
        ];
    });
};

export const buildSources = (
    packet: Evidence[],
    evidence: Evidence[],
    extraIds: string[] = [],
): Source[] => {
    const citedIds = new Set([
        ...evidence.map((item) => item.source_id),
        ...extraIds,
    ]);

    return packet
        .filter((item) => citedIds.has(item.source_id))
        .map((item) => ({
            source_id: item.source_id,
            url: item.url,
            title: item.title,
            publisher: item.publisher,
            published_date: item.published_date,
            accessed_date: item.accessed_date,
        }));
};

const mapArray = <T>(value: unknown, mapper: (record: Record<string, unknown>) => T): T[] =>
    Array.isArray(value) ? value.map((item) => mapper(asRecord(item))) : [];

export const normalizeAnalysis = (
    analysis: Record<string, unknown>,
    evidence: Evidence[],
) => {
    const sourceIds = new Set(evidence.map((item) => item.source_id));
    const filterSourceIds = (value: unknown): string[] =>
        asStringArray(value).filter((id) => sourceIds.has(id));

    return {
        source_assessments: mapArray<SourceAssessment>(
            analysis.source_assessments,
            (item) => ({
                source_id: asString(item.source_id),
                criteria_notes: asString(item.criteria_notes),
                quality_tier: asEnum(item.quality_tier, QUALITIES, "unclear"),
                independence_cluster_id: asString(item.independence_cluster_id, "inconnu"),
                caveats: asStringArray(item.caveats),
            }),
        ).filter((item) => sourceIds.has(item.source_id)),
        contradictions: mapArray<Contradiction>(analysis.contradictions, (item) => ({
            claim_id: asString(item.claim_id),
            issue: asString(item.issue),
            evidence_ids: filterSourceIds(item.evidence_ids),
            explanation: asString(item.explanation),
            unresolved: item.unresolved === true,
            what_would_resolve_it: asString(item.what_would_resolve_it),
        })),
        timeline: mapArray<TimelineEntry>(analysis.timeline, (item) => ({
            date: asString(item.date),
            event: asString(item.event),
            source_ids: filterSourceIds(item.source_ids),
            date_certainty: asEnum(item.date_certainty, DATE_CERTAINTIES, "unknown"),
            significance: asString(item.significance),
        })),
        context_findings: mapArray<ContextFinding>(analysis.context_findings, (item) => ({
            claim_id: asOptionalString(item.claim_id),
            finding: asString(item.finding),
            source_ids: filterSourceIds(item.source_ids),
            impact: asEnum(item.impact, IMPACTS, "minor"),
        })),
        media_findings: mapArray<MediaFinding>(analysis.media_findings, (item) => ({
            media_id: asString(item.media_id),
            visual_observations: asStringArray(item.visual_observations),
            ocr: asOptionalString(item.ocr),
            matches: asStringArray(item.matches),
            source_ids: filterSourceIds(item.source_ids),
            context_mismatch: asOptionalString(item.context_mismatch),
            limitations: asStringArray(item.limitations),
        })),
        video_findings: mapArray<VideoFinding>(analysis.video_findings, (item) => ({
            media_id: asString(item.media_id),
            accessible: item.accessible === true,
            segment_notes: asStringArray(item.segment_notes),
            transcript_snippets: asStringArray(item.transcript_snippets),
            provenance_matches: asStringArray(item.provenance_matches),
            timeline: mapArray<TimelineEntry>(item.timeline, (entry) => ({
                date: asString(entry.date),
                event: asString(entry.event),
                source_ids: filterSourceIds(entry.source_ids),
                date_certainty: asEnum(entry.date_certainty, DATE_CERTAINTIES, "unknown"),
                significance: asString(entry.significance),
            })),
            verified_scope: asString(item.verified_scope),
            limitations: asStringArray(item.limitations),
        })),
        quote_findings: mapArray<QuoteFinding>(analysis.quote_findings, (item) => ({
            claim_id: asOptionalString(item.claim_id),
            quoted_text: asString(item.quoted_text),
            attribution: asString(item.attribution),
            original_source: asOptionalString(item.original_source),
            match_type: asEnum(item.match_type, MATCH_TYPES, "unverified"),
            context: asOptionalString(item.context),
            limitations: asStringArray(item.limitations),
        })),
        framing_findings: mapArray<FramingFinding>(analysis.framing_findings, (item) => ({
            claim_id: asOptionalString(item.claim_id),
            technique: asString(item.technique),
            excerpt: asString(item.excerpt),
            explanation: asString(item.explanation),
            affects_factual_interpretation: item.affects_factual_interpretation === true,
        })),
        evidence_gaps: mapArray<EvidenceGap>(analysis.evidence_gaps, (item) => ({
            claim_id: asString(item.claim_id),
            missing_evidence: asString(item.missing_evidence),
            impact: asEnum(item.impact, IMPACTS, "minor"),
            reason: asString(item.reason),
            next_step: asString(item.next_step),
        })),
    };
};

// Verdicts that assert something about reality and therefore must cite evidence.
const EVIDENCE_REQUIRED_VERDICTS: VerdictLabel[] = [
    "confirmed",
    "refuted",
    "partially_confirmed",
    "misleading_or_out_of_context",
];

const NO_EVIDENCE_LIMITATION =
    "Verdict ramené à « non vérifiable » : aucune preuve récupérée n'a été citée pour l'étayer.";

export const normalizeClaimVerdicts = (
    value: unknown,
    claims: Claim[],
    evidence: Evidence[],
): ClaimVerdict[] => {
    const claimIds = new Set(claims.map((claim) => claim.id));
    const sourceIds = new Set(evidence.map((item) => item.source_id));
    const byClaim = new Map<string, ClaimVerdict>();

    if (Array.isArray(value)) {
        value.forEach((item) => {
            const verdict = asRecord(item);
            const claimId = asString(verdict.claim_id).trim();
            if (!claimIds.has(claimId) || byClaim.has(claimId)) {
                return;
            }
            const label = asEnum(verdict.verdict, VERDICTS, "unverifiable");
            const evidenceIds = asStringArray(verdict.evidence_ids).filter((id) =>
                sourceIds.has(id),
            );
            const explanation = asString(verdict.explanation);
            const limitations = asStringArray(verdict.limitations);

            if (EVIDENCE_REQUIRED_VERDICTS.includes(label) && evidenceIds.length === 0) {
                byClaim.set(claimId, {
                    claim_id: claimId,
                    verdict: "unverifiable",
                    explanation: `Verdict initial « ${label} » non retenu faute de preuve citée.${
                        explanation ? ` Analyse non étayée du modèle : ${explanation}` : ""
                    }`,
                    confidence: "low",
                    evidence_ids: [],
                    limitations: [NO_EVIDENCE_LIMITATION, ...limitations],
                });
                return;
            }

            byClaim.set(claimId, {
                claim_id: claimId,
                verdict: label,
                explanation,
                confidence: asEnum(verdict.confidence, CONFIDENCES, "low"),
                evidence_ids: evidenceIds,
                limitations,
            });
        });
    }

    return claims.map(
        (claim) =>
            byClaim.get(claim.id) ?? {
                claim_id: claim.id,
                verdict: "unverifiable",
                explanation: "Aucun verdict exploitable n'a été produit pour cette affirmation.",
                confidence: "low",
                evidence_ids: [],
                limitations: ["Analyse incomplète pour cette affirmation."],
            },
    );
};

export const normalizeOverallVerdict = (
    value: unknown,
    verdicts: ClaimVerdict[],
    evidence: Evidence[],
): OverallVerdict => {
    const overall = asRecord(value);
    const sourceIds = new Set(evidence.map((item) => item.source_id));
    const central = verdicts.find((verdict) => verdict.verdict !== "opinion_or_non_factual");
    const label = asEnum(overall.label, VERDICTS, central?.verdict ?? "unverifiable");
    const keyEvidenceIds = asStringArray(overall.key_evidence_ids).filter((id) =>
        sourceIds.has(id),
    );
    const limitations = asStringArray(overall.limitations);

    // The overall verdict needs its own cited evidence, or at least one claim
    // verdict that survived the evidence check above with cited evidence.
    const isBacked =
        keyEvidenceIds.length > 0 ||
        verdicts.some(
            (verdict) =>
                EVIDENCE_REQUIRED_VERDICTS.includes(verdict.verdict) &&
                verdict.evidence_ids.length > 0,
        );

    if (EVIDENCE_REQUIRED_VERDICTS.includes(label) && !isBacked) {
        return {
            label: "unverifiable",
            summary:
                "Les preuves récupérées ne permettent pas de conclure : aucune source citée n'étaye un verdict.",
            confidence: "low",
            confidence_rationale: `Verdict initial « ${label} » non retenu faute de preuve citée.`,
            key_evidence_ids: [],
            limitations: [NO_EVIDENCE_LIMITATION, ...limitations],
        };
    }

    return {
        label,
        summary: asString(overall.summary),
        confidence: asEnum(overall.confidence, CONFIDENCES, "low"),
        confidence_rationale: asString(overall.confidence_rationale),
        key_evidence_ids: keyEvidenceIds,
        limitations,
    };
};
