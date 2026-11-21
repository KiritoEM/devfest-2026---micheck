import { randomUUID } from "node:crypto";
import { InvestigationResponse } from "@/lib/context-detector/types";

const TTL_MS = 30 * 60 * 1000;

interface StoredInvestigation {
    expiresAt: number;
    response: InvestigationResponse;
}

const investigations = new Map<string, StoredInvestigation>();

export const createInvestigationId = (): string => randomUUID();

const purgeExpired = (): void => {
    const now = Date.now();
    investigations.forEach((entry, id) => {
        if (entry.expiresAt <= now) {
            investigations.delete(id);
        }
    });
};

export const saveInvestigation = (response: InvestigationResponse): void => {
    purgeExpired();
    investigations.set(response.investigation_id, {
        expiresAt: Date.now() + TTL_MS,
        response,
    });
};

export const getInvestigation = (id: string): InvestigationResponse | undefined => {
    purgeExpired();
    return investigations.get(id)?.response;
};
