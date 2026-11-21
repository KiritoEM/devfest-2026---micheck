import { contextDetectorErrorResponse } from "@/lib/context-detector/http";
import { getInvestigation } from "@/lib/context-detector/store";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const { id } = await params;
        const investigation = getInvestigation(id);

        if (!investigation) {
            return NextResponse.json(
                { message: `Aucune investigation trouvée avec l'id: ${id}` },
                { status: 404 },
            );
        }

        return NextResponse.json(investigation, { status: 200 });
    } catch (error) {
        return contextDetectorErrorResponse(error);
    }
}
