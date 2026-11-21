export class ContextDetectorConfigurationError extends Error {
    readonly code = "CONFIGURATION_MISSING";
}

export class ContextDetectorAiError extends Error {
    readonly code = "AI_PROVIDER_ERROR";
}

export interface AiImage {
    mimeType: string;
    data: string;
}

export interface AiChatMessage {
    role: "user" | "assistant";
    content: string;
}

type AiProviderId = "groq" | "xai" | "mistral" | "gemini" | "huggingface";

interface AiProvider {
    id: AiProviderId;
    label: string;
    apiKey: string;
    baseUrl: string;
    models: string[];
    visionModels: string[];
    jsonMode: boolean;
}

interface ProviderCandidate {
    provider: AiProvider;
    model: string;
}

const DEFAULT_PROVIDER_ORDER: AiProviderId[] = [
    "groq",
    "xai",
    "mistral",
    "gemini",
    "huggingface",
];

const PROVIDER_LABELS: Record<AiProviderId, string> = {
    groq: "Groq",
    xai: "xAI",
    mistral: "Mistral",
    gemini: "Gemini",
    huggingface: "Hugging Face",
};

const DEFAULT_BASE_URLS: Record<AiProviderId, string> = {
    groq: "https://api.groq.com/openai/v1",
    xai: "https://api.x.ai/v1",
    mistral: "https://api.mistral.ai/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta",
    huggingface: "https://router.huggingface.co/v1",
};

const DEFAULT_MODELS: Record<AiProviderId, string> = {
    groq: "llama-3.3-70b-versatile",
    xai: "grok-3-mini",
    mistral: "mistral-small-latest",
    gemini: "gemini-2.5-flash",
    huggingface: "mistralai/Mistral-7B-Instruct-v0.3",
};

// Multimodal models used only when images are sent. Env variables override them.
const DEFAULT_VISION_MODELS: Partial<Record<AiProviderId, string[]>> = {
    groq: ["meta-llama/llama-4-scout-17b-16e-instruct"],
    mistral: ["pixtral-12b-2409"],
    gemini: ["gemini-2.5-flash"],
};

const BASE_URL_ENV_NAMES: Record<AiProviderId, string[]> = {
    groq: ["CONTEXT_DETECTOR_GROQ_BASE_URL", "CONTEXT_DETECTOR_AI_BASE_URL"],
    xai: ["CONTEXT_DETECTOR_XAI_BASE_URL"],
    mistral: ["CONTEXT_DETECTOR_MISTRAL_BASE_URL"],
    gemini: ["CONTEXT_DETECTOR_GEMINI_BASE_URL"],
    huggingface: ["CONTEXT_DETECTOR_HF_BASE_URL"],
};

const MODEL_ENV_NAMES: Record<AiProviderId, string[]> = {
    groq: ["CONTEXT_DETECTOR_GROQ_MODEL", "CONTEXT_DETECTOR_AI_MODEL"],
    xai: ["CONTEXT_DETECTOR_XAI_MODEL"],
    mistral: ["CONTEXT_DETECTOR_MISTRAL_MODEL"],
    gemini: ["CONTEXT_DETECTOR_GEMINI_MODEL"],
    huggingface: ["CONTEXT_DETECTOR_HF_MODEL"],
};

const VISION_MODEL_ENV_NAMES: Record<AiProviderId, string> = {
    groq: "CONTEXT_DETECTOR_GROQ_VISION_MODEL",
    xai: "CONTEXT_DETECTOR_XAI_VISION_MODEL",
    mistral: "CONTEXT_DETECTOR_MISTRAL_VISION_MODEL",
    gemini: "CONTEXT_DETECTOR_GEMINI_VISION_MODEL",
    huggingface: "CONTEXT_DETECTOR_HF_VISION_MODEL",
};

const MODEL_FALLBACK_ENV_NAMES: Record<AiProviderId, string> = {
    groq: "CONTEXT_DETECTOR_GROQ_FALLBACK_MODELS",
    xai: "CONTEXT_DETECTOR_XAI_FALLBACK_MODELS",
    mistral: "CONTEXT_DETECTOR_MISTRAL_FALLBACK_MODELS",
    gemini: "CONTEXT_DETECTOR_GEMINI_FALLBACK_MODELS",
    huggingface: "CONTEXT_DETECTOR_HF_FALLBACK_MODELS",
};

const KEY_ENV_NAMES: Record<AiProviderId, string[]> = {
    groq: ["CONTEXT_DETECTOR_GROQ_API_KEY", "CONTEXT_DETECTOR_AI_API_KEY"],
    xai: ["CONTEXT_DETECTOR_XAI_API_KEY"],
    mistral: ["CONTEXT_DETECTOR_MISTRAL_API_KEY"],
    gemini: ["CONTEXT_DETECTOR_GEMINI_API_KEY"],
    huggingface: ["CONTEXT_DETECTOR_HF_API_KEY"],
};

// Models tried on the same provider when a quota or model error makes the primary
// one unusable. A small free-tier token budget (e.g. 80 TPM) cannot serve this
// pipeline, so retrying the same model is pointless: another model is needed.
const DEFAULT_MODEL_FALLBACKS: Partial<Record<AiProviderId, string[]>> = {
    groq: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"],
};

const SECRET_ENV_NAMES = [
    "CONTEXT_DETECTOR_AI_API_KEY",
    ...Object.values(KEY_ENV_NAMES).flat(),
];

const MAX_ATTEMPTS_PER_MODEL = 2;
const RETRY_BASE_MS = 1500;
const MAX_RETRY_WAIT_MS = 20000;
const DEFAULT_REQUEST_BUDGET_MS = 60000;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const DEFAULT_CHAT_MAX_OUTPUT_TOKENS = 1024;
const MAX_ERROR_DETAIL_CHARS = 300;
const VISION_IMAGE_TOKENS = 1000;

const envValue = (...names: string[]): string => {
    for (const name of names) {
        const value = process.env[name]?.trim();
        if (value) {
            return value;
        }
    }
    return "";
};

const positiveIntEnv = (name: string, fallback: number): number => {
    const value = Number(envValue(name));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};

const splitList = (value: string): string[] =>
    value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

const redactSecrets = (text: string): string =>
    SECRET_ENV_NAMES.map((name) => envValue(name))
        .filter(Boolean)
        .reduce((value, secret) => value.split(secret).join("***"), text);

const errorDetail = async (response: Response): Promise<string> => {
    try {
        const payload = (await response.json()) as {
            error?: { message?: unknown } | string;
            message?: unknown;
        };
        if (typeof payload.error === "string") {
            return payload.error;
        }
        if (typeof payload.error?.message === "string") {
            return payload.error.message;
        }
        return typeof payload.message === "string" ? payload.message : "";
    } catch {
        return "";
    }
};

const isAiProviderId = (value: string): value is AiProviderId =>
    (DEFAULT_PROVIDER_ORDER as string[]).includes(value);

const providerIds = (): AiProviderId[] => {
    const legacy = envValue("CONTEXT_DETECTOR_AI_PROVIDER").toLowerCase();
    const configured = (legacy || envValue("CONTEXT_DETECTOR_AI_PROVIDERS"))
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(isAiProviderId);

    // The env list only sets the preference order: every other provider that has a
    // key is still tried, so a single throttled key cannot take the API down.
    return Array.from(new Set([...configured, ...DEFAULT_PROVIDER_ORDER]));
};

const modelsFor = (id: AiProviderId): string[] => {
    const primary = envValue(...MODEL_ENV_NAMES[id]) || DEFAULT_MODELS[id];
    const configuredFallbacks = splitList(envValue(MODEL_FALLBACK_ENV_NAMES[id]));
    const defaultFallbacks = DEFAULT_MODEL_FALLBACKS[id] ?? [];
    return Array.from(
        new Set([primary, ...configuredFallbacks, ...defaultFallbacks].filter(Boolean)),
    );
};

const visionModelsFor = (id: AiProviderId): string[] => {
    const configured = splitList(envValue(VISION_MODEL_ENV_NAMES[id]));
    const defaults = DEFAULT_VISION_MODELS[id] ?? [];
    return Array.from(new Set([...configured, ...defaults].filter(Boolean)));
};

const buildProvider = (id: AiProviderId): AiProvider | undefined => {
    const apiKey = envValue(...KEY_ENV_NAMES[id]);
    if (!apiKey) {
        return undefined;
    }

    return {
        id,
        label: PROVIDER_LABELS[id],
        apiKey,
        baseUrl: envValue(...BASE_URL_ENV_NAMES[id]) || DEFAULT_BASE_URLS[id],
        models: modelsFor(id),
        visionModels: visionModelsFor(id),
        jsonMode: id !== "huggingface",
    };
};

export const getAiProviders = (): AiProvider[] =>
    providerIds()
        .map((id) => buildProvider(id))
        .filter((provider): provider is AiProvider => Boolean(provider));

export const getVisionProviders = (): AiProvider[] =>
    getAiProviders().filter((provider) => provider.visionModels.length > 0);

export const isAiConfigured = (): boolean => getAiProviders().length > 0;

export const isVisionConfigured = (): boolean => getVisionProviders().length > 0;

export const getAiModel = (): string =>
    getAiProviders()[0]?.models[0] ?? DEFAULT_MODELS.groq;

class ProviderHttpError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly detail: string,
        readonly retryAfterMs?: number,
    ) {
        super(message);
    }
}

type FailureKind =
    | "rate_limit"
    | "auth"
    | "model"
    | "server"
    | "network"
    | "response"
    | "request";

const failureKind = (error: unknown): FailureKind => {
    if (error instanceof ProviderHttpError) {
        if (error.status === 429) {
            return "rate_limit";
        }
        if (error.status === 401 || error.status === 403) {
            return "auth";
        }
        if (error.status === 404) {
            return "model";
        }
        if (error.status >= 500) {
            return "server";
        }
        if (error.status === 400) {
            return /model|does not exist|invalid/i.test(error.detail)
                ? "model"
                : "request";
        }
        return "request";
    }
    return error instanceof ContextDetectorAiError ? "response" : "network";
};

const parseRetryAfterMs = (value: string | null): number | undefined => {
    if (!value) {
        return undefined;
    }
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.ceil(seconds * 1000);
    }
    const date = Date.parse(value);
    return Number.isNaN(date) ? undefined : Math.max(date - Date.now(), 0);
};

const parseDelayFromDetail = (detail: string): number | undefined => {
    const match =
        detail.match(/retry[-_ ]?after[:\s]+(\d+(?:\.\d+)?)/i) ??
        detail.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
    return match ? Math.ceil(Number(match[1]) * 1000) : undefined;
};

// Groq (and compatible gateways) report the rejected per-minute budget, e.g.
// "on tokens per minute (TPM): Limit 80". Comparing it with the request size
// tells us whether waiting can help at all.
const parseTpmLimit = (detail: string): number | undefined => {
    const match =
        detail.match(/(?:tokens per minute|\bTPM\b)[^.]{0,40}?limit\s+(\d+)/i) ??
        detail.match(/limit\s+(\d+)[^.]{0,40}?(?:tokens per minute|\bTPM\b)/i);
    return match ? Number(match[1]) : undefined;
};

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const httpError = async (
    provider: AiProvider,
    response: Response,
): Promise<ProviderHttpError> => {
    const detail = redactSecrets(await errorDetail(response)).slice(
        0,
        MAX_ERROR_DETAIL_CHARS,
    );
    const retryAfterMs =
        parseRetryAfterMs(response.headers.get("retry-after")) ??
        parseDelayFromDetail(detail);
    const suffix = retryAfterMs
        ? ` — retry-after:${Math.ceil(retryAfterMs / 1000)}s`
        : "";
    return new ProviderHttpError(
        `${provider.label} HTTP ${response.status}${detail ? ` — ${detail}` : ""}${suffix}`,
        response.status,
        detail,
        retryAfterMs,
    );
};

const extractJsonObject = (content: string): Record<string, unknown> => {
    const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
        throw new ContextDetectorAiError("La réponse IA ne contient pas d'objet JSON.");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
        throw new ContextDetectorAiError("La réponse IA n'est pas un JSON valide.");
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new ContextDetectorAiError("La réponse IA doit être un objet JSON.");
    }

    return parsed as Record<string, unknown>;
};

type OpenAiContent =
    | string
    | Array<{
          type: "text" | "image_url";
          text?: string;
          image_url?: { url: string };
      }>;

interface OpenAiMessage {
    role: "system" | "user" | "assistant";
    content: OpenAiContent;
}

const buildOpenAiMessages = (
    systemPrompt: string,
    messages: AiChatMessage[],
    images: AiImage[],
): OpenAiMessage[] => {
    const mapped = messages.map(
        (message): OpenAiMessage => ({ role: message.role, content: message.content }),
    );

    if (images.length > 0) {
        const last = mapped[mapped.length - 1];
        last.content = [
            { type: "text", text: typeof last.content === "string" ? last.content : "" },
            ...images.map((image) => ({
                type: "image_url" as const,
                image_url: {
                    url: `data:${image.mimeType};base64,${image.data}`,
                },
            })),
        ];
    }

    return [{ role: "system", content: systemPrompt }, ...mapped];
};

interface RequestInput {
    provider: AiProvider;
    model: string;
    systemPrompt: string;
    messages: AiChatMessage[];
    images: AiImage[];
    jsonMode: boolean;
    maxOutputTokens: number;
}

const requestOpenAiCompatible = async ({
    provider,
    model,
    systemPrompt,
    messages,
    images,
    jsonMode,
    maxOutputTokens,
}: RequestInput): Promise<string> => {
    const baseUrl = provider.baseUrl.replace(/\/+$/, "");
    const body: Record<string, unknown> = {
        model,
        temperature: 0,
        max_tokens: maxOutputTokens,
        messages: buildOpenAiMessages(systemPrompt, messages, images),
    };
    if (jsonMode && provider.jsonMode) {
        body.response_format = { type: "json_object" };
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) {
        throw await httpError(provider, response);
    }

    const payload = (await response.json()) as {
        choices?: { message?: { content?: unknown } }[];
    };
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
        throw new ContextDetectorAiError(`${provider.label} : réponse vide.`);
    }
    return content;
};

const requestGemini = async ({
    provider,
    model,
    systemPrompt,
    messages,
    images,
    jsonMode,
    maxOutputTokens,
}: RequestInput): Promise<string> => {
    const baseUrl = provider.baseUrl.replace(/\/+$/, "");
    const contents = messages.map((message, index) => {
        const parts: Array<Record<string, unknown>> = [
            { text: message.content },
        ];
        if (images.length > 0 && index === messages.length - 1) {
            images.forEach((image) => {
                parts.push({
                    inline_data: { mime_type: image.mimeType, data: image.data },
                });
            });
        }
        return {
            role: message.role === "assistant" ? "model" : "user",
            parts,
        };
    });

    const response = await fetch(
        `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-goog-api-key": provider.apiKey,
            },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens,
                    ...(jsonMode ? { responseMimeType: "application/json" } : {}),
                },
            }),
            signal: AbortSignal.timeout(60000),
        },
    );
    if (!response.ok) {
        throw await httpError(provider, response);
    }

    const payload = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: unknown }[] } }[];
    };
    const parts = payload?.candidates?.[0]?.content?.parts ?? [];
    const content = parts
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim();
    if (!content) {
        throw new ContextDetectorAiError(`${provider.label} : réponse vide.`);
    }
    return content;
};

const requestContent = (input: RequestInput): Promise<string> =>
    input.provider.id === "gemini"
        ? requestGemini(input)
        : requestOpenAiCompatible(input);

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const runWithProviders = async (
    candidates: ProviderCandidate[],
    requiredTokens: number,
    call: (candidate: ProviderCandidate) => Promise<string>,
): Promise<string> => {
    const deadline =
        Date.now() +
        positiveIntEnv(
            "CONTEXT_DETECTOR_AI_REQUEST_BUDGET_MS",
            DEFAULT_REQUEST_BUDGET_MS,
        );
    const failures: string[] = [];

    for (const candidate of candidates) {
        const { provider, model } = candidate;
        const label = `${provider.id}/${model}`;
        let attempt = 0;

        while (true) {
            try {
                const content = await call(candidate);
                console.info("Context Detector AI provider used:", label);
                return content;
            } catch (error) {
                const kind = failureKind(error);
                const reason = redactSecrets(
                    error instanceof Error ? error.message : String(error),
                );

                if (kind === "auth") {
                    failures.push(`${label}: ${reason}`);
                    console.error(
                        "Context Detector AI provider rejected the key:",
                        label,
                        reason,
                    );
                    break;
                }

                if (kind === "rate_limit") {
                    const detail =
                        error instanceof ProviderHttpError ? error.detail : reason;
                    const tpmLimit = parseTpmLimit(detail);
                    if (tpmLimit && requiredTokens > tpmLimit) {
                        failures.push(
                            `${label}: quota de ${tpmLimit} tokens/minute insuffisant pour ~${requiredTokens} tokens requis`,
                        );
                        console.error(
                            "Context Detector AI quota too low for the request:",
                            label,
                            `${tpmLimit} TPM < ~${requiredTokens} tokens`,
                        );
                        break;
                    }
                }

                const retryable =
                    kind === "rate_limit" ||
                    kind === "server" ||
                    kind === "network" ||
                    kind === "response";
                if (retryable && attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
                    const waitMs = Math.min(
                        (error instanceof ProviderHttpError
                            ? error.retryAfterMs
                            : undefined) ?? RETRY_BASE_MS * 2 ** attempt,
                        MAX_RETRY_WAIT_MS,
                    );
                    if (Date.now() + waitMs < deadline) {
                        attempt += 1;
                        await sleep(waitMs);
                        continue;
                    }
                }

                failures.push(`${label}: ${reason}`);
                console.error(
                    "Context Detector AI request failed:",
                    label,
                    reason,
                );
                break;
            }
        }
    }

    throw new ContextDetectorAiError(
        `Tous les fournisseurs IA ont échoué (${failures.join(" | ")}). ` +
            "Vérifiez les quotas des clés configurées (tokens/minute) ou changez de modèle avec CONTEXT_DETECTOR_*_MODEL.",
    );
};

const structuredCandidates = (withVision: boolean): ProviderCandidate[] =>
    (withVision ? getVisionProviders() : getAiProviders()).flatMap((provider) =>
        (withVision ? provider.visionModels : provider.models).map((model) => ({
            provider,
            model,
        })),
    );

export const requestStructuredJson = async (
    systemPrompt: string,
    userPrompt: string,
    images: AiImage[] = [],
): Promise<Record<string, unknown>> => {
    const withVision = images.length > 0;
    const candidates = structuredCandidates(withVision);
    if (candidates.length === 0) {
        throw new ContextDetectorConfigurationError(
            withVision
                ? "Aucun modèle vision configuré (CONTEXT_DETECTOR_*_VISION_MODEL)."
                : "Aucune clé IA configurée (CONTEXT_DETECTOR_*_API_KEY).",
        );
    }

    const maxOutputTokens = positiveIntEnv(
        "CONTEXT_DETECTOR_AI_MAX_TOKENS",
        DEFAULT_MAX_OUTPUT_TOKENS,
    );
    const requiredTokens =
        estimateTokens(systemPrompt) +
        estimateTokens(userPrompt) +
        images.length * VISION_IMAGE_TOKENS +
        maxOutputTokens;

    const content = await runWithProviders(candidates, requiredTokens, (candidate) =>
        requestContent({
            ...candidate,
            systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            images,
            jsonMode: true,
            maxOutputTokens,
        }),
    );

    return extractJsonObject(content);
};

export const requestChatText = async (
    systemPrompt: string,
    messages: AiChatMessage[],
): Promise<string> => {
    const candidates = getAiProviders().flatMap((provider) =>
        provider.models.map((model) => ({ provider, model })),
    );
    if (candidates.length === 0) {
        throw new ContextDetectorConfigurationError(
            "Aucune clé IA configurée (CONTEXT_DETECTOR_*_API_KEY).",
        );
    }

    const maxOutputTokens = positiveIntEnv(
        "CONTEXT_DETECTOR_CHAT_MAX_TOKENS",
        DEFAULT_CHAT_MAX_OUTPUT_TOKENS,
    );
    const requiredTokens =
        estimateTokens(systemPrompt) +
        messages.reduce((total, message) => total + estimateTokens(message.content), 0) +
        maxOutputTokens;

    const content = await runWithProviders(candidates, requiredTokens, (candidate) =>
        requestContent({
            ...candidate,
            systemPrompt,
            messages,
            images: [],
            jsonMode: false,
            maxOutputTokens,
        }),
    );

    const answer = content.trim();
    if (!answer) {
        throw new ContextDetectorAiError("Réponse IA vide.");
    }
    return answer;
};
