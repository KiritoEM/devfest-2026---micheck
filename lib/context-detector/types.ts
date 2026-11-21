export type InputType =
    | "text"
    | "url"
    | "image"
    | "video"
    | "document"
    | "mixed";

export type VerdictLabel =
    | "confirmed"
    | "refuted"
    | "misleading_or_out_of_context"
    | "unverifiable"
    | "partially_confirmed"
    | "opinion_or_non_factual";

export type Confidence = "low" | "medium" | "high";

export type ClaimType =
    | "event"
    | "policy_legal"
    | "statistic"
    | "quote"
    | "identity_allegation"
    | "science_health"
    | "causal"
    | "historical"
    | "other";

export type Importance = "high" | "medium" | "low";

export type Checkability =
    | "verifiable"
    | "partially_verifiable"
    | "not_verifiable"
    | "opinion_or_prediction";

export type SourceQuality = "strong" | "moderate" | "weak" | "unclear";

export type Stance =
    | "supports"
    | "contradicts"
    | "contextualizes"
    | "neutral";

export type Relevance = "high" | "medium" | "low";

export interface MediaInput {
    type: "image" | "video" | "document";
    url?: string;
    dataUrl?: string;
    frames?: string[];
    name?: string;
    mimeType?: string;
}

export interface InvestigationInput {
    type?: InputType;
    text?: string;
    url?: string;
    media?: MediaInput[];
}

export interface InvestigationOptions {
    language?: string;
    skills?: string[];
    investigationDate?: string;
    includeReport?: boolean;
    skipSearch?: boolean;
}

export interface InvestigationRequest {
    content: string | InvestigationInput;
    options?: InvestigationOptions;
}

export interface Claim {
    id: string;
    claim_text: string;
    claim_type: ClaimType;
    importance: Importance;
    entities: string[];
    date_or_period?: string;
    location?: string;
    verification_question: string;
    ambiguities: string[];
    checkability: Checkability;
}

export interface SearchPlan {
    claim_id: string;
    queries: string[];
    source_targets: string[];
    supporting_evidence_criteria: string;
    contradicting_evidence_criteria: string;
    expected_limitations: string[];
}

export interface SearchResult {
    url: string;
    title: string;
    publisher?: string;
    publishedDate?: string;
    snippet: string;
    query: string;
}

export interface Evidence {
    source_id: string;
    claim_ids: string[];
    url: string;
    title: string;
    publisher?: string;
    published_date?: string;
    accessed_date: string;
    source_type: string;
    excerpt: string;
    stance: Stance;
    relevance: Relevance;
    retrieval_notes?: string;
}

export interface SourceAssessment {
    source_id: string;
    criteria_notes: string;
    quality_tier: SourceQuality;
    independence_cluster_id: string;
    caveats: string[];
}

export interface Contradiction {
    claim_id: string;
    issue: string;
    evidence_ids: string[];
    explanation: string;
    unresolved: boolean;
    what_would_resolve_it: string;
}

export interface TimelineEntry {
    date: string;
    event: string;
    source_ids: string[];
    date_certainty: "certain" | "approximate" | "unknown";
    significance: string;
}

export interface ContextFinding {
    claim_id?: string;
    finding: string;
    source_ids: string[];
    impact: "material" | "minor";
}

export interface MediaFinding {
    media_id: string;
    visual_observations: string[];
    ocr?: string;
    matches: string[];
    source_ids: string[];
    context_mismatch?: string;
    limitations: string[];
}

export interface VideoFinding {
    media_id: string;
    accessible: boolean;
    segment_notes: string[];
    transcript_snippets: string[];
    provenance_matches: string[];
    timeline: TimelineEntry[];
    verified_scope: string;
    limitations: string[];
}

export interface QuoteFinding {
    claim_id?: string;
    quoted_text: string;
    attribution: string;
    original_source?: string;
    match_type: "exact" | "translation" | "paraphrase" | "unattributed" | "unverified";
    context?: string;
    limitations: string[];
}

export interface FramingFinding {
    claim_id?: string;
    technique: string;
    excerpt: string;
    explanation: string;
    affects_factual_interpretation: boolean;
}

export interface EvidenceGap {
    claim_id: string;
    missing_evidence: string;
    impact: "material" | "minor";
    reason: string;
    next_step: string;
}

export interface ClaimVerdict {
    claim_id: string;
    verdict: VerdictLabel;
    explanation: string;
    confidence: Confidence;
    evidence_ids: string[];
    limitations: string[];
}

export interface OverallVerdict {
    label: VerdictLabel;
    summary: string;
    confidence: Confidence;
    confidence_rationale: string;
    key_evidence_ids: string[];
    limitations: string[];
}

export interface Source {
    source_id: string;
    url: string;
    title: string;
    publisher?: string;
    published_date?: string;
    accessed_date: string;
}

export interface Dossier {
    investigation_id: string;
    input_summary: string;
    input_type: InputType;
    language: string;
    investigation_date: string;
    skills_used: string[];
    claims: Claim[];
    search_plan?: SearchPlan[];
    evidence?: Evidence[];
    source_assessments?: SourceAssessment[];
    contradictions?: Contradiction[];
    timeline?: TimelineEntry[];
    context_findings?: ContextFinding[];
    media_findings?: MediaFinding[];
    video_findings?: VideoFinding[];
    quote_findings?: QuoteFinding[];
    framing_findings?: FramingFinding[];
    evidence_gaps?: EvidenceGap[];
    claim_verdicts: ClaimVerdict[];
    overall_verdict: OverallVerdict;
    sources: Source[];
    practical_takeaway: string;
    limitations: string[];
}

export interface InvestigationResponse {
    investigation_id: string;
    dossier: Dossier;
    report?: string;
}

export interface ClaimsResponse {
    input_type: InputType;
    input_summary: string;
    language: string;
    investigation_date: string;
    claims: Claim[];
}

export type SkillPhase =
    | "preparation"
    | "investigation"
    | "analysis"
    | "reporting";

export interface DetectorSkill {
    id: string;
    name: string;
    description: string;
    trigger: string;
    outputKey: string;
    phase: SkillPhase;
    inputTypes: InputType[];
    requiresTool?: string;
}

export interface SkillsResponse {
    count: number;
    skills: DetectorSkill[];
    note: string;
}

export type ImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export type MediaSignalCategory = "format" | "metadata" | "provenance" | "privacy";

export interface MediaSignal {
    code: string;
    category: MediaSignalCategory;
    message: string;
}

export interface ExifSummary {
    make?: string;
    model?: string;
    software?: string;
    date_time_original?: string;
    date_time_modified?: string;
    gps_present: boolean;
}

export interface MediaSignalsResponse {
    file_name: string;
    size_bytes: number;
    mime_type_declared: string | null;
    mime_type_detected: ImageMimeType;
    width: number;
    height: number;
    exif: ExifSummary | null;
    provenance_markers: string[];
    signals: MediaSignal[];
    analyzed_at: string;
    disclaimer: string;
}
