import { NextResponse } from "next/server";
import {
    ContextDetectorAiError,
    ContextDetectorConfigurationError,
} from "@/lib/context-detector/ai";
import { MediaSignalsError } from "@/lib/context-detector/media";
import { ContextDetectorValidationError } from "@/lib/context-detector/normalize";

export const contextDetectorErrorResponse = (error: unknown): NextResponse => {
    console.error("Context:", error);

    const message = error instanceof Error ? error.message : "Erreur inconnue";
    const detail = process.env.NODE_ENV === "development" ? String(error) : undefined;

    if (error instanceof MediaSignalsError) {
        return NextResponse.json({ message, code: error.code }, { status: error.status });
    }
    if (error instanceof ContextDetectorValidationError) {
        return NextResponse.json({ message }, { status: 400 });
    }
    if (error instanceof ContextDetectorConfigurationError) {
        return NextResponse.json({ message, error: detail }, { status: 503 });
    }
    if (error instanceof ContextDetectorAiError) {
        return NextResponse.json({ message, error: detail }, { status: 502 });
    }

    return NextResponse.json(
        { message: "Internal Server Error", error: detail },
        { status: 500 },
    );
};
