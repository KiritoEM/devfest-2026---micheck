import { runChat, validateChatRequest } from "@/lib/context-detector/chat";
import { contextDetectorErrorResponse } from "@/lib/context-detector/http";
import { getInvestigation } from "@/lib/context-detector/store";
import { Dossier } from "@/lib/context-detector/types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = await req.json().catch(() => undefined);
        const request = validateChatRequest(body);

        let dossier: Dossier | undefined;
        if (request.investigationId) {
            dossier = getInvestigation(request.investigationId)?.dossier;
            if (!dossier) {
                return NextResponse.json(
                    {
                        message: `Aucune investigation trouvée avec l'id: ${request.investigationId}`,
                    },
                    { status: 404 },
                );
            }
        }

        const result = await runChat(request, dossier);
        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        return contextDetectorErrorResponse(error);
    }
}
