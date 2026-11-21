import { contextDetectorErrorResponse } from "@/lib/context-detector/http";
import {
    analyzeImage,
    MAX_IMAGE_BYTES,
    MediaSignalsError,
    MULTIPART_OVERHEAD_BYTES,
    sanitizeFileName,
} from "@/lib/context-detector/media";
import { MediaSignalsResponse } from "@/lib/context-detector/types";
import { NextRequest, NextResponse } from "next/server";

const MAX_MB = MAX_IMAGE_BYTES / (1024 * 1024);

// docs/adr-content-detector.md §3: multipart upload, 1 image, <= 4 MB,
// JPEG/PNG/WebP checked on the file bytes. No AI call; the file is analysed in
// memory and never stored.
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const contentType = req.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
            throw new MediaSignalsError(
                "Envoyez l'image en multipart/form-data dans le champ « file ».",
                415,
                "MULTIPART_REQUIRED",
            );
        }

        // Reject oversized uploads before reading the body when the size is announced.
        const contentLength = Number(req.headers.get("content-length"));
        if (contentLength > MAX_IMAGE_BYTES + MULTIPART_OVERHEAD_BYTES) {
            throw new MediaSignalsError(
                `Fichier trop volumineux : ${MAX_MB} Mo maximum.`,
                413,
                "FILE_TOO_LARGE",
            );
        }

        let form: FormData;
        try {
            form = await req.formData();
        } catch {
            throw new MediaSignalsError(
                "Corps multipart invalide ou incomplet.",
                400,
                "INVALID_MULTIPART",
            );
        }

        const entries = form.getAll("file");
        if (entries.length === 0) {
            throw new MediaSignalsError(
                "Aucun fichier reçu : ajoutez une image dans le champ « file ».",
                400,
                "FILE_REQUIRED",
            );
        }
        if (entries.length > 1) {
            throw new MediaSignalsError(
                "Un seul fichier par requête.",
                400,
                "TOO_MANY_FILES",
            );
        }

        const file = entries[0];
        if (typeof file === "string") {
            throw new MediaSignalsError(
                "Le champ « file » doit contenir un fichier, pas du texte.",
                400,
                "FILE_REQUIRED",
            );
        }
        if (file.size === 0) {
            throw new MediaSignalsError("Le fichier est vide.", 400, "EMPTY_FILE");
        }
        if (file.size > MAX_IMAGE_BYTES) {
            throw new MediaSignalsError(
                `Fichier trop volumineux : ${MAX_MB} Mo maximum.`,
                413,
                "FILE_TOO_LARGE",
            );
        }

        const bytes = new Uint8Array(await file.arrayBuffer());
        const result: MediaSignalsResponse = analyzeImage(
            bytes,
            sanitizeFileName(file.name),
            file.type || null,
        );

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        return contextDetectorErrorResponse(error);
    }
}
