import {
    DetectorSkill,
    InputType,
    InvestigationInput,
    InvestigationOptions,
} from "@/lib/context-detector/types";

export const contextDetectorSkills: DetectorSkill[] = [
    {
        id: "claim-extraction",
        name: "Extraction des affirmations",
        description:
            "Décompose une publication en affirmations factuelles atomiques, avec type, importance, entités, questions de vérification et ambiguïtés.",
        trigger: "Toute publication contenant des affirmations factuelles",
        outputKey: "claims",
        phase: "preparation",
        inputTypes: ["text", "url", "image", "video", "document", "mixed"],
    },
    {
        id: "investigation-planning",
        name: "Planification de la recherche",
        description:
            "Prépare des requêtes variées, des cibles de sources et des critères de confirmation ou de réfutation pour chaque affirmation vérifiable.",
        trigger: "Après l'extraction, dès qu'une affirmation est vérifiable",
        outputKey: "search_plan",
        phase: "preparation",
        inputTypes: ["text", "url", "image", "video", "document", "mixed"],
    },
    {
        id: "web-evidence-search",
        name: "Recherche de preuves sur Internet",
        description:
            "Recherche des sources puis ouvre ou évalue les résultats pertinents, y compris des éléments susceptibles de contredire l'affirmation.",
        trigger: "Un plan de recherche existe pour une affirmation vérifiable",
        outputKey: "evidence",
        phase: "investigation",
        inputTypes: ["text", "url", "image", "video", "document", "mixed"],
        requiresTool: "web_search",
    },
    {
        id: "source-evaluation",
        name: "Évaluation des sources",
        description:
            "Évalue l'autorité, la primarité, la traçabilité, la date et l'indépendance des sources, et regroupe les sources issues d'un même origine.",
        trigger: "Au moins une source externe est disponible",
        outputKey: "source_assessments",
        phase: "analysis",
        inputTypes: ["text", "url", "image", "video", "document", "mixed"],
    },
    {
        id: "contradiction-analysis",
        name: "Analyse des contradictions",
        description:
            "Compare dates, chiffres, noms, lieux, périmètres et définitions entre sources, en distinguant vrai désaccord et contexte différent.",
        trigger: "Plusieurs sources ou une affirmation contestée",
        outputKey: "contradictions",
        phase: "analysis",
        inputTypes: ["text", "url", "image", "video", "document", "mixed"],
    },
    {
        id: "context-timeline",
        name: "Chronologie et contexte",
        description:
            "Distingue date de publication, date de repartage et date de l'événement afin de repérer une information ancienne recyclée ou déplacée.",
        trigger: "Affirmation sensible au temps, virale ou datée",
        outputKey: "timeline",
        phase: "analysis",
        inputTypes: ["text", "url", "image", "video", "document", "mixed"],
    },
    {
        id: "image-investigation",
        name: "Investigation d'image",
        description:
            "Décrit les éléments observables, transcrit le texte visible, relève les indices contextuels et vérifie la correspondance avec la légende.",
        trigger: "Image, capture d'écran, photo, mème ou infographie fournie",
        outputKey: "media_findings",
        phase: "investigation",
        inputTypes: ["image", "document", "mixed"],
        requiresTool: "vision",
    },
    {
        id: "video-investigation",
        name: "Investigation de vidéo",
        description:
            "Vérifie l'accessibilité, analyse des images clés et la transcription, puis compare dates de mise en ligne et date de l'événement allégué.",
        trigger: "Vidéo ou lien de vidéo fourni",
        outputKey: "video_findings",
        phase: "investigation",
        inputTypes: ["video", "mixed"],
        requiresTool: "frame_extraction",
    },
    {
        id: "quote-verification",
        name: "Vérification de citation",
        description:
            "Compare une citation avec sa source originale, y compris les omissions, traductions et le contexte environnant.",
        trigger: "Citation, propos attribué ou paraphrase présentée comme mot pour mot",
        outputKey: "quote_findings",
        phase: "investigation",
        inputTypes: ["text", "url", "image", "document", "mixed"],
    },
    {
        id: "manipulation-detection",
        name: "Détection du cadrage",
        description:
            "Repère certitude non étayée, appel à l'émotion, faux dilemme, statistique sélective, comparaison trompeuse ou contenu recyclé.",
        trigger: "Contenu viral, persuasif, politique, commercial ou chargé d'émotion",
        outputKey: "framing_findings",
        phase: "analysis",
        inputTypes: ["text", "url", "image", "video", "document", "mixed"],
    },
    {
        id: "evidence-gap-analysis",
        name: "Analyse des manques de preuves",
        description:
            "Indique pour chaque affirmation ce qui est établi, ce qui reste inconnu et quelle preuve manquante ferait évoluer la conclusion.",
        trigger: "Avant la formulation du verdict",
        outputKey: "evidence_gaps",
        phase: "analysis",
        inputTypes: ["text", "url", "image", "video", "document", "mixed"],
    },
    {
        id: "verdict-calibration",
        name: "Calibration du verdict",
        description:
            "Attribue un verdict nuancé et une confiance qualitative par affirmation, puis dérive le verdict global des affirmations centrales.",
        trigger: "L'analyse des preuves est suffisante pour une conclusion provisoire",
        outputKey: "claim_verdicts",
        phase: "analysis",
        inputTypes: ["text", "url", "image", "video", "document", "mixed"],
    },
    {
        id: "report-assembly",
        name: "Assemblage du dossier",
        description:
            "Produit un dossier de vérification concis, neutre et sourcé, avec verdict, preuves, chronologie, limites et conseil pratique.",
        trigger: "Après la calibration des verdicts",
        outputKey: "report",
        phase: "reporting",
        inputTypes: ["text", "url", "image", "video", "document", "mixed"],
    },
];

export const getSkill = (id: string): DetectorSkill | undefined =>
    contextDetectorSkills.find((skill) => skill.id === id);

export const detectInputType = (input: InvestigationInput): InputType => {
    if (input.type && input.type !== "mixed") {
        return input.type;
    }

    const mediaTypes = new Set((input.media ?? []).map((media) => media.type));
    const kinds = new Set<InputType>();

    if (input.text?.trim()) {
        kinds.add("text");
    }
    if (input.url?.trim()) {
        kinds.add("url");
    }
    mediaTypes.forEach((type) => kinds.add(type));

    if (kinds.size > 1) {
        return "mixed";
    }
    if (mediaTypes.has("image")) {
        return "image";
    }
    if (mediaTypes.has("video")) {
        return "video";
    }
    if (mediaTypes.has("document")) {
        return "document";
    }
    if (input.url?.trim()) {
        return "url";
    }
    return "text";
};

export const selectSkills = (
    input: InvestigationInput,
    options: InvestigationOptions = {},
    availableTools: string[] = [],
): DetectorSkill[] => {
    const inputType = detectInputType(input);
    const hasImage = inputType === "image" || (input.media ?? []).some((media) => media.type === "image");
    const hasVideo = inputType === "video" || (input.media ?? []).some((media) => media.type === "video");
    const hasQuote = /["«”]/.test(input.text ?? "");
    const requested = options.skills;

    return contextDetectorSkills.filter((skill) => {
        if (requested && !requested.includes(skill.id)) {
            return false;
        }
        if (!skill.inputTypes.includes(inputType) && !requested) {
            return false;
        }
        if (skill.requiresTool && !availableTools.includes(skill.requiresTool)) {
            return false;
        }
        if (skill.id === "image-investigation" && !hasImage) {
            return false;
        }
        if (skill.id === "video-investigation" && !hasVideo) {
            return false;
        }
        if (skill.id === "quote-verification" && !hasQuote && !requested) {
            return false;
        }
        return true;
    });
};
