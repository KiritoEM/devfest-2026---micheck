import {
    AiChatMessage,
    ContextDetectorConfigurationError,
    isAiConfigured,
    requestChatText,
} from "@/lib/context-detector/ai";
import { asRecord, ContextDetectorValidationError } from "@/lib/context-detector/normalize";
import { buildChatSystemPrompt } from "@/lib/context-detector/prompts";
import { Dossier, Source } from "@/lib/context-detector/types";

export interface ChatRequest {
    messages: AiChatMessage[];
    investigationId?: string;
    language?: string;
}

export interface ChatResponse {
    message: string;
    grounded: boolean;
    investigation_id?: string;
    sources: Source[];
}

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 24000;
const MAX_LANGUAGE_CHARS = 20;
const MAX_DOSSIER_CHARS = 6000;

export const validateChatRequest = (body: unknown): ChatRequest => {
    const record = asRecord(body);
    const rawMessages = record.messages;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
        throw new ContextDetectorValidationError(
            "Fournissez au moins un message dans messages.",
        );
    }

    const messages = rawMessages.slice(-MAX_MESSAGES).map((item, index) => {
        const message = asRecord(item);
        const role = message.role;
        const content =
            typeof message.content === "string" ? message.content.trim() : "";

        if (role !== "user" && role !== "assistant") {
            throw new ContextDetectorValidationError(
                `messages[${index}].role doit être "user" ou "assistant".`,
            );
        }
        if (!content) {
            throw new ContextDetectorValidationError(
                `messages[${index}].content est vide.`,
            );
        }
        if (content.length > MAX_MESSAGE_CHARS) {
            throw new ContextDetectorValidationError(
                `messages[${index}].content dépasse ${MAX_MESSAGE_CHARS} caractères.`,
            );
        }

        return { role, content } satisfies AiChatMessage;
    });

    const totalChars = messages.reduce(
        (total, message) => total + message.content.length,
        0,
    );
    if (totalChars > MAX_TOTAL_CHARS) {
        throw new ContextDetectorValidationError(
            `La conversation dépasse ${MAX_TOTAL_CHARS} caractères.`,
        );
    }
    if (messages[messages.length - 1].role !== "user") {
        throw new ContextDetectorValidationError(
            "Le dernier message doit être de rôle \"user\".",
        );
    }

    const language =
        typeof record.language === "string" && record.language.trim()
            ? record.language.trim().slice(0, MAX_LANGUAGE_CHARS)
            : undefined;
    const investigationId =
        typeof record.investigation_id === "string" && record.investigation_id.trim()
            ? record.investigation_id.trim()
            : undefined;

    return {
        messages,
        ...(investigationId ? { investigationId } : {}),
        ...(language ? { language } : {}),
    };
};

const summarizeDossier = (dossier: Dossier): string => {
    const summary = {
        input_summary: dossier.input_summary,
        investigation_date: dossier.investigation_date,
        overall_verdict: dossier.overall_verdict,
        claims: dossier.claims.map((claim) => {
            const verdict = dossier.claim_verdicts.find(
                (item) => item.claim_id === claim.id,
            );
            return {
                id: claim.id,
                claim_text: claim.claim_text,
                verdict: verdict?.verdict ?? "unverifiable",
                explanation: verdict?.explanation ?? "",
                confidence: verdict?.confidence ?? "low",
                evidence_ids: verdict?.evidence_ids ?? [],
            };
        }),
        sources: dossier.sources,
        limitations: dossier.limitations,
        practical_takeaway: dossier.practical_takeaway,
    };

    return JSON.stringify(summary).slice(0, MAX_DOSSIER_CHARS);
};

export const runChat = async (
    request: ChatRequest,
    dossier?: Dossier,
): Promise<ChatResponse> => {
    if (!isAiConfigured()) {
        throw new ContextDetectorConfigurationError(
            "Aucune clé IA configurée (CONTEXT_DETECTOR_*_API_KEY).",
        );
    }

    const systemPrompt = buildChatSystemPrompt(
        request.language,
        dossier ? summarizeDossier(dossier) : undefined,
    );
    const message = await requestChatText(systemPrompt, request.messages);

    return {
        message,
        grounded: Boolean(dossier),
        ...(dossier ? { investigation_id: dossier.investigation_id } : {}),
        sources: dossier?.sources ?? [],
    };
};
