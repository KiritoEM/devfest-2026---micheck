import { contextDetectorErrorResponse } from "@/lib/context-detector/http";
import { validateInvestigationRequest } from "@/lib/context-detector/normalize";
import { runClaimExtraction } from "@/lib/context-detector/orchestrator";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = await req.json().catch(() => undefined);
        const request = validateInvestigationRequest(body);
        const result = await runClaimExtraction(request);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        return contextDetectorErrorResponse(error);
    }
}
