export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const MAX_VIDEO_FRAMES = 4;

const IMAGE_DATA_URL_PATTERN =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/;

export const isSupportedImageDataUrl = (value: string): boolean =>
    IMAGE_DATA_URL_PATTERN.test(value.trim());

export const dataUrlByteSize = (value: string): number => {
    const comma = value.indexOf(",");
    const base64 = comma === -1 ? "" : value.slice(comma + 1).replace(/\s/g, "");
    return Math.ceil((base64.length * 3) / 4);
};

export const parseImageDataUrl = (
    value: string | undefined,
): { mimeType: string; data: string } | undefined => {
    if (!value) {
        return undefined;
    }
    const match = IMAGE_DATA_URL_PATTERN.exec(value.trim());
    if (!match) {
        return undefined;
    }
    const data = match[2].replace(/\s/g, "");
    if (Math.ceil((data.length * 3) / 4) > MAX_IMAGE_BYTES) {
        return undefined;
    }
    return { mimeType: match[1], data };
};
