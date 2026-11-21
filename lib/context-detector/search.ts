import { SearchResult } from "@/lib/context-detector/types";

type SearchProviderId = "tavily" | "brave" | "generic";

interface SearchProviderConfig {
    id: SearchProviderId;
    label: string;
    apiKey: string;
}

export interface SearchOutcome {
    results: SearchResult[];
    note: string;
}

const DEFAULT_PROVIDER_ORDER: SearchProviderId[] = ["tavily", "brave", "generic"];
const DEFAULT_BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";
const DEFAULT_TAVILY_URL = "https://api.tavily.com/search";
const MAX_RESULTS_PER_QUERY = 6;
const MAX_RESULTS = 12;

interface RawSearchResult {
    title?: unknown;
    url?: unknown;
    description?: unknown;
    snippet?: unknown;
    content?: unknown;
    publisher?: unknown;
    source?: unknown;
    published_date?: unknown;
    publishedDate?: unknown;
    page_age?: unknown;
}

const envValue = (...names: string[]): string => {
    for (const name of names) {
        const value = process.env[name]?.trim();
        if (value) {
            return value;
        }
    }
    return "";
};

const isSearchProviderId = (value: string): value is SearchProviderId =>
    (DEFAULT_PROVIDER_ORDER as string[]).includes(value);

const buildProvider = (id: SearchProviderId): SearchProviderConfig | undefined => {
    const keyEnvNames: Record<SearchProviderId, string[]> = {
        tavily: ["CONTEXT_DETECTOR_TAVILY_API_KEY", "CONTEXT_DETECTOR_SEARCH_API_KEY"],
        brave: ["CONTEXT_DETECTOR_BRAVE_API_KEY", "CONTEXT_DETECTOR_SEARCH_API_KEY"],
        generic: ["CONTEXT_DETECTOR_SEARCH_API_KEY"],
    };
    const apiKey = envValue(...keyEnvNames[id]);
    if (!apiKey) {
        return undefined;
    }
    return { id, label: id, apiKey };
};

const isSearchDisabled = (value: string): boolean =>
    ["none", "off", "disabled", "false"].includes(value.trim().toLowerCase());

export const getSearchProviders = (): SearchProviderConfig[] => {
    const legacy = envValue("CONTEXT_DETECTOR_SEARCH_PROVIDER").toLowerCase();
    const configuredRaw = legacy || envValue("CONTEXT_DETECTOR_SEARCH_PROVIDERS");
    if (isSearchDisabled(configuredRaw)) {
        return [];
    }

    const configured = configuredRaw
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(isSearchProviderId);

    // The env list sets the preference order; any other provider with a key is
    // still tried as a fallback instead of failing on the first throttled one.
    const order = Array.from(new Set([...configured, ...DEFAULT_PROVIDER_ORDER]));
    return order
        .map((id) => buildProvider(id))
        .filter((provider): provider is SearchProviderConfig => Boolean(provider));
};

export const getSearchProvider = (): SearchProviderId | "none" =>
    getSearchProviders()[0]?.id ?? "none";

export const isSearchConfigured = (): boolean => getSearchProviders().length > 0;

const asText = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;

const normalizeResult = (
    raw: RawSearchResult,
    query: string,
): SearchResult | undefined => {
    const url = asText(raw.url);
    const title = asText(raw.title);
    if (!url || !title || !/^https?:\/\//i.test(url)) {
        return undefined;
    }

    return {
        url,
        title,
        publisher: asText(raw.publisher) ?? asText(raw.source),
        publishedDate:
            asText(raw.published_date) ??
            asText(raw.publishedDate) ??
            asText(raw.page_age),
        snippet:
            asText(raw.description) ??
            asText(raw.snippet) ??
            asText(raw.content) ??
            "",
        query,
    };
};

const fetchGeneric = async (
    provider: SearchProviderConfig,
    query: string,
): Promise<RawSearchResult[]> => {
    const url = envValue("CONTEXT_DETECTOR_SEARCH_URL");
    if (!url) {
        throw new Error("URL manquante");
    }

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({ q: query, count: MAX_RESULTS_PER_QUERY }),
        signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { results?: RawSearchResult[] };
    return Array.isArray(payload.results) ? payload.results : [];
};

const fetchBrave = async (
    provider: SearchProviderConfig,
    query: string,
): Promise<RawSearchResult[]> => {
    const baseUrl = envValue("CONTEXT_DETECTOR_SEARCH_URL") || DEFAULT_BRAVE_URL;
    const endpoint = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${new URLSearchParams({
        q: query,
        count: String(MAX_RESULTS_PER_QUERY),
    })}`;

    const response = await fetch(endpoint, {
        headers: {
            accept: "application/json",
            "x-subscription-token": provider.apiKey,
        },
        signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
        web?: { results?: RawSearchResult[] };
    };
    return Array.isArray(payload.web?.results) ? payload.web.results : [];
};

const fetchTavily = async (
    provider: SearchProviderConfig,
    query: string,
): Promise<RawSearchResult[]> => {
    const baseUrl = envValue("CONTEXT_DETECTOR_TAVILY_URL") || DEFAULT_TAVILY_URL;

    const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            api_key: provider.apiKey,
            query,
            max_results: MAX_RESULTS_PER_QUERY,
        }),
        signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { results?: RawSearchResult[] };
    return Array.isArray(payload.results) ? payload.results : [];
};

const fetchResults = (provider: SearchProviderConfig, query: string) => {
    if (provider.id === "brave") {
        return fetchBrave(provider, query);
    }
    if (provider.id === "tavily") {
        return fetchTavily(provider, query);
    }
    return fetchGeneric(provider, query);
};

export const searchWeb = async (queries: string[]): Promise<SearchOutcome> => {
    const providers = getSearchProviders();
    if (providers.length === 0) {
        return {
            results: [],
            note: "Recherche web indisponible : configurez une clé de recherche (Tavily, Brave ou générique).",
        };
    }

    const uniqueQueries = Array.from(
        new Set(queries.map((query) => query.trim()).filter(Boolean)),
    );
    if (uniqueQueries.length === 0) {
        return { results: [], note: "Aucune requête de recherche générée." };
    }

    const failures: string[] = [];
    for (const provider of providers) {
        const batches = await Promise.all(
            uniqueQueries.map(async (query) => {
                try {
                    const rawResults = await fetchResults(provider, query);
                    return rawResults.map((raw) => ({ query, raw }));
                } catch (error) {
                    const reason = error instanceof Error ? error.message : String(error);
                    failures.push(`${provider.id}: ${reason}`);
                    console.error("Context Detector search provider failed:", provider.id, reason);
                    return [];
                }
            }),
        );

        const seen = new Set<string>();
        const results: SearchResult[] = [];
        batches.flat().forEach(({ query, raw }) => {
            const normalized = normalizeResult(raw, query);
            if (!normalized || seen.has(normalized.url)) {
                return;
            }
            seen.add(normalized.url);
            results.push(normalized);
        });

        if (results.length > 0) {
            return {
                results: results.slice(0, MAX_RESULTS),
                note: `Sources trouvées via ${provider.label}. Les résultats de recherche sont des pistes, pas des preuves ; seules les sources évaluées doivent étayer un verdict.`,
            };
        }
    }

    return {
        results: [],
        note: failures.length
            ? `Aucun moteur de recherche n'a renvoyé de résultat exploitable (${failures.join(" | ")}).`
            : "Aucun moteur de recherche n'a renvoyé de résultat exploitable.",
    };
};
