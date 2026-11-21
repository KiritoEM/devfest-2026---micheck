import {
  ExifSummary,
  ImageMimeType,
  MediaSignal,
  MediaSignalsResponse,
} from "@/lib/context-detector/types";

// Media signals (PRODUCT_SCOPE.md P1 #5, docs/adr-content-detector.md §3):
// factual clues read from the file itself, without any AI call. They are never
// a verdict and never claim to detect deepfakes (PRODUCT_SCOPE.md §7).

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// Headroom for multipart boundaries and part headers when pre-checking Content-Length.
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
export const ACCEPTED_IMAGE_TYPES: ImageMimeType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const MEDIA_SIGNALS_DISCLAIMER =
  "Ces signaux ne prouvent pas l'authenticité : ce sont des indices à croiser avec une vérification des sources. MiCheck ne détecte pas les deepfakes ni les images générées par IA de manière fiable.";

const MAX_FILE_NAME_LENGTH = 255;
const MAX_TEXT_FIELD_LENGTH = 120;
const MAX_CHUNKS = 2048;
const LOW_RESOLUTION_PX = 400;

const EXTENSIONS: Record<ImageMimeType, string[]> = {
  "image/jpeg": ["jpg", "jpeg", "jpe", "jfif"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

// PNG text keywords written by common image generators (Stable Diffusion WebUI,
// ComfyUI, InvokeAI, NovelAI...). Their presence is a declaration, not proof.
const GENERATION_KEYWORDS = new Set([
  "parameters",
  "prompt",
  "workflow",
  "invokeai_metadata",
  "sd-metadata",
  "dream",
]);

export type MediaSignalsErrorStatus = 400 | 413 | 415 | 422;

export class MediaSignalsError extends Error {
  readonly status: MediaSignalsErrorStatus;
  readonly code: string;

  constructor(message: string, status: MediaSignalsErrorStatus, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ParsedImage {
  width?: number;
  height?: number;
  exif: ExifSummary | null;
  exifUnreadable: boolean;
  xmp: string[];
  c2pa: boolean;
  generationKeywords: string[];
}

const emptyParsed = (): ParsedImage => ({
  exif: null,
  exifUnreadable: false,
  xmp: [],
  c2pa: false,
  generationKeywords: [],
});

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(
    ...bytes.subarray(start, Math.min(start + length, bytes.length)),
  );

const latin1 = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return out;
};

const u16be = (b: Uint8Array, o: number): number => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number): number =>
  ((b[o] << 24) >>> 0) + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
const u16le = (b: Uint8Array, o: number): number => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number): number =>
  b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const u32le = (b: Uint8Array, o: number): number =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + ((b[o + 3] << 24) >>> 0);

const startsWith = (b: Uint8Array, signature: number[], offset = 0): boolean =>
  signature.every((byte, index) => b[offset + index] === byte);

const cleanText = (value: string): string | undefined => {
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return text ? text.slice(0, MAX_TEXT_FIELD_LENGTH) : undefined;
};

export const detectImageType = (bytes: Uint8Array): ImageMimeType | null => {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  return null;
};

// --- EXIF (TIFF structure) ---------------------------------------------------

const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_SOFTWARE = 0x0131;
const TAG_DATE_TIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATE_TIME_ORIGINAL = 0x9003;

const parseExif = (tiff: Uint8Array): ExifSummary | null => {
  if (tiff.length < 8) {
    return null;
  }
  const order = ascii(tiff, 0, 2);
  if (order !== "II" && order !== "MM") {
    return null;
  }
  const le = order === "II";
  const r16 = (o: number) => (le ? u16le(tiff, o) : u16be(tiff, o));
  const r32 = (o: number) => (le ? u32le(tiff, o) : u32be(tiff, o));
  if (r16(2) !== 42) {
    return null;
  }

  const readIfd = (
    offset: number,
  ): Map<number, { type: number; count: number; at: number }> => {
    const entries = new Map<
      number,
      { type: number; count: number; at: number }
    >();
    if (offset < 8 || offset + 2 > tiff.length) {
      return entries;
    }
    const count = Math.min(r16(offset), 512);
    for (let i = 0; i < count; i += 1) {
      const at = offset + 2 + i * 12;
      if (at + 12 > tiff.length) {
        break;
      }
      entries.set(r16(at), { type: r16(at + 2), count: r32(at + 4), at });
    }
    return entries;
  };

  const readAscii = (
    ifd: Map<number, { type: number; count: number; at: number }>,
    tag: number,
  ): string | undefined => {
    const entry = ifd.get(tag);
    if (!entry || entry.type !== 2 || entry.count === 0) {
      return undefined;
    }
    const start = entry.count <= 4 ? entry.at + 8 : r32(entry.at + 8);
    if (start + entry.count > tiff.length) {
      return undefined;
    }
    return cleanText(
      ascii(tiff, start, Math.min(entry.count, MAX_TEXT_FIELD_LENGTH * 2)),
    );
  };

  const pointer = (
    ifd: Map<number, { type: number; count: number; at: number }>,
    tag: number,
  ): number | undefined => {
    const entry = ifd.get(tag);
    return entry ? r32(entry.at + 8) : undefined;
  };

  const ifd0 = readIfd(r32(4));
  const exifPointer = pointer(ifd0, TAG_EXIF_IFD);
  const exifIfd = exifPointer !== undefined ? readIfd(exifPointer) : new Map();
  const gpsPointer = pointer(ifd0, TAG_GPS_IFD);
  const gpsIfd = gpsPointer !== undefined ? readIfd(gpsPointer) : new Map();

  return {
    make: readAscii(ifd0, TAG_MAKE),
    model: readAscii(ifd0, TAG_MODEL),
    software: readAscii(ifd0, TAG_SOFTWARE),
    date_time_original: readAscii(exifIfd, TAG_DATE_TIME_ORIGINAL),
    date_time_modified: readAscii(ifd0, TAG_DATE_TIME),
    // Coordinates are deliberately never extracted or returned.
    gps_present: gpsIfd.size > 0,
  };
};

const applyExif = (parsed: ParsedImage, tiff: Uint8Array): void => {
  try {
    const exif = parseExif(tiff);
    if (exif) {
      parsed.exif = exif;
    } else {
      parsed.exifUnreadable = true;
    }
  } catch {
    parsed.exifUnreadable = true;
  }
};

// --- Container parsers -------------------------------------------------------

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const parseJpeg = (b: Uint8Array): ParsedImage => {
  const parsed = emptyParsed();
  let offset = 2;

  for (
    let guard = 0;
    guard < MAX_CHUNKS && offset + 4 <= b.length;
    guard += 1
  ) {
    if (b[offset] !== 0xff) {
      break;
    }
    const marker = b[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const length = u16be(b, offset + 2);
    const start = offset + 4;
    const end = offset + 2 + length;
    if (length < 2 || end > b.length) {
      break;
    }
    const data = b.subarray(start, end);

    if (SOF_MARKERS.has(marker) && data.length >= 5) {
      parsed.height = u16be(data, 1);
      parsed.width = u16be(data, 3);
    } else if (marker === 0xe1 && ascii(data, 0, 6) === "Exif\u0000\u0000") {
      applyExif(parsed, data.subarray(6));
    } else if (
      marker === 0xe1 &&
      ascii(data, 0, 28) === "http://ns.adobe.com/xap/1.0/"
    ) {
      parsed.xmp.push(latin1(data.subarray(29)));
    } else if (marker === 0xeb && latin1(data).includes("c2pa")) {
      // APP11 carries JUMBF boxes; C2PA manifests are labelled "c2pa".
      parsed.c2pa = true;
    }

    offset = end;
  }

  return parsed;
};

const parsePngText = (
  parsed: ParsedImage,
  type: string,
  data: Uint8Array,
): void => {
  const separator = data.indexOf(0);
  if (separator <= 0) {
    return;
  }
  const keyword = ascii(data, 0, separator);
  if (GENERATION_KEYWORDS.has(keyword.toLowerCase())) {
    parsed.generationKeywords.push(keyword);
  }
  if (type === "iTXt" && keyword === "XML:com.adobe.xmp") {
    // keyword\0 compression-flag compression-method lang\0 translated\0 text
    const compressed = data[separator + 1] === 1;
    if (!compressed) {
      const rest = data.subarray(separator + 3);
      const langEnd = rest.indexOf(0);
      const translatedEnd = langEnd >= 0 ? rest.indexOf(0, langEnd + 1) : -1;
      if (translatedEnd >= 0) {
        parsed.xmp.push(latin1(rest.subarray(translatedEnd + 1)));
      }
    }
  }
};

const parsePng = (b: Uint8Array): ParsedImage => {
  const parsed = emptyParsed();
  let offset = 8;

  for (
    let guard = 0;
    guard < MAX_CHUNKS && offset + 8 <= b.length;
    guard += 1
  ) {
    const length = u32be(b, offset);
    const type = ascii(b, offset + 4, 4);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > b.length) {
      break;
    }
    const data = b.subarray(start, end);

    if (type === "IHDR" && data.length >= 8) {
      parsed.width = u32be(data, 0);
      parsed.height = u32be(data, 4);
    } else if (type === "eXIf") {
      applyExif(parsed, data);
    } else if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
      parsePngText(parsed, type, data);
    } else if (type === "caBX") {
      parsed.c2pa = true;
    } else if (type === "IEND") {
      break;
    }

    offset = end + 4; // skip CRC
  }

  return parsed;
};

const parseWebp = (b: Uint8Array): ParsedImage => {
  const parsed = emptyParsed();
  let offset = 12;

  for (
    let guard = 0;
    guard < MAX_CHUNKS && offset + 8 <= b.length;
    guard += 1
  ) {
    const type = ascii(b, offset, 4);
    const length = u32le(b, offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > b.length) {
      break;
    }
    const data = b.subarray(start, end);

    if (type === "VP8X" && data.length >= 10) {
      parsed.width = u24le(data, 4) + 1;
      parsed.height = u24le(data, 7) + 1;
    } else if (
      type === "VP8 " &&
      data.length >= 10 &&
      startsWith(data, [0x9d, 0x01, 0x2a], 3)
    ) {
      parsed.width ??= u16le(data, 6) & 0x3fff;
      parsed.height ??= u16le(data, 8) & 0x3fff;
    } else if (type === "VP8L" && data.length >= 5 && data[0] === 0x2f) {
      const bits = u32le(data, 1);
      parsed.width ??= (bits & 0x3fff) + 1;
      parsed.height ??= ((bits >>> 14) & 0x3fff) + 1;
    } else if (type === "EXIF") {
      const tiff =
        ascii(data, 0, 6) === "Exif\u0000\u0000" ? data.subarray(6) : data;
      applyExif(parsed, tiff);
    } else if (type === "XMP ") {
      parsed.xmp.push(latin1(data));
    } else if (type === "C2PA") {
      parsed.c2pa = true;
    }

    offset = end + (length % 2); // chunks are padded to an even size
  }

  return parsed;
};

const PARSERS: Record<ImageMimeType, (bytes: Uint8Array) => ParsedImage> = {
  "image/jpeg": parseJpeg,
  "image/png": parsePng,
  "image/webp": parseWebp,
};

// --- Signals -----------------------------------------------------------------

const fileExtension = (name: string): string | undefined => {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name);
  return match ? match[1].toLowerCase() : undefined;
};

export const sanitizeFileName = (name: string): string => {
  const base = name.split(/[\\/]/).pop() ?? "";
  return cleanText(base)?.slice(0, MAX_FILE_NAME_LENGTH) ?? "image";
};

const declaresAiSource = (xmp: string[]): boolean =>
  xmp.some((packet) =>
    /DigitalSourceType[^<>]*?(trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia)|digitalsourcetype\/(trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia)/i.test(
      packet,
    ),
  );

const buildSignals = (
  declared: string | null,
  detected: ImageMimeType,
  fileName: string,
  width: number,
  height: number,
  parsed: ParsedImage,
  aiSource: boolean,
): MediaSignal[] => {
  const signals: MediaSignal[] = [];
  const exif = parsed.exif;

  if (declared && declared !== detected) {
    signals.push({
      code: "mime_mismatch",
      category: "format",
      message: `Le type déclaré (${declared}) ne correspond pas au contenu réel du fichier (${detected}). Cela arrive après une conversion ou un renommage ; ce n'est pas en soi une preuve de manipulation.`,
    });
  }

  const extension = fileExtension(fileName);
  if (extension && !EXTENSIONS[detected].includes(extension)) {
    signals.push({
      code: "extension_mismatch",
      category: "format",
      message: `L'extension « .${extension} » ne correspond pas au format réel (${detected}).`,
    });
  }

  if (Math.max(width, height) < LOW_RESOLUTION_PX) {
    signals.push({
      code: "low_resolution",
      category: "format",
      message: `Image de faible résolution (${width}×${height}) : les détails sont difficiles à examiner. Cherchez une version d'origine en meilleure qualité.`,
    });
  }

  if (parsed.exifUnreadable) {
    signals.push({
      code: "exif_unreadable",
      category: "metadata",
      message:
        "Un bloc EXIF est présent mais n'a pas pu être lu (format non standard ou endommagé).",
    });
  } else if (!exif) {
    signals.push({
      code: "no_exif",
      category: "metadata",
      message:
        "Aucune métadonnée EXIF. C'est courant pour les images partagées sur les réseaux sociaux ou les messageries, qui les suppriment : cela ne prouve rien dans un sens ni dans l'autre.",
    });
  }

  if (exif?.make || exif?.model) {
    signals.push({
      code: "camera_declared",
      category: "metadata",
      message: `Appareil déclaré dans l'EXIF : ${[exif.make, exif.model].filter(Boolean).join(" ")}. Ces champs peuvent être modifiés.`,
    });
  }

  if (exif?.date_time_original) {
    signals.push({
      code: "capture_date_declared",
      category: "metadata",
      message: `Date de prise de vue déclarée : ${exif.date_time_original} (horloge de l'appareil, modifiable). À comparer avec la date de l'événement allégué.`,
    });
  }

  if (exif?.software) {
    signals.push({
      code: "software_declared",
      category: "metadata",
      message: `Logiciel déclaré : ${exif.software}. Indique un passage par ce logiciel (export, retouche ou simple recadrage), pas nécessairement une manipulation.`,
    });
  }

  if (exif?.gps_present) {
    signals.push({
      code: "gps_present",
      category: "privacy",
      message:
        "Le fichier contient des coordonnées GPS. Elles ne sont pas renvoyées par MiCheck pour protéger la vie privée ; évitez de partager l'original.",
    });
  }

  if (parsed.c2pa) {
    signals.push({
      code: "c2pa_manifest",
      category: "provenance",
      message:
        "Le fichier contient un manifeste C2PA (Content Credentials). MiCheck ne vérifie pas sa signature : contrôlez-le sur contentcredentials.org/verify.",
    });
  }

  if (aiSource) {
    signals.push({
      code: "iptc_ai_source_declared",
      category: "provenance",
      message:
        "Les métadonnées IPTC déclarent un contenu produit par IA (DigitalSourceType). C'est une déclaration de l'outil ou du créateur, non vérifiée ; son absence ne prouve pas qu'une image est authentique.",
    });
  }

  if (parsed.generationKeywords.length) {
    signals.push({
      code: "generation_parameters",
      category: "provenance",
      message: `Champs texte typiques de générateurs d'images présents (${parsed.generationKeywords.join(", ")}). Indice à confirmer : ces champs peuvent être ajoutés ou retirés librement.`,
    });
  }

  return signals;
};

export const analyzeImage = (
  bytes: Uint8Array,
  fileName: string,
  declaredMimeType: string | null,
): MediaSignalsResponse => {
  const detected = detectImageType(bytes);
  if (!detected) {
    throw new MediaSignalsError(
      "Format non pris en charge : seuls JPEG, PNG et WebP sont acceptés (vérifié sur le contenu du fichier, pas sur son extension).",
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    );
  }

  const parsed = PARSERS[detected](bytes);
  const { width, height } = parsed;
  if (!width || !height) {
    throw new MediaSignalsError(
      "Image illisible : impossible de déterminer ses dimensions (fichier tronqué ou endommagé).",
      422,
      "UNREADABLE_IMAGE",
    );
  }

  const aiSource = declaresAiSource(parsed.xmp);
  const declared = declaredMimeType?.trim().toLowerCase() || null;
  const provenanceMarkers = [
    ...(parsed.c2pa ? ["c2pa"] : []),
    ...(aiSource ? ["iptc_ai_source"] : []),
    ...(parsed.generationKeywords.length ? ["generation_parameters"] : []),
  ];

  return {
    file_name: fileName,
    size_bytes: bytes.length,
    mime_type_declared: declared,
    mime_type_detected: detected,
    width,
    height,
    exif: parsed.exif,
    provenance_markers: provenanceMarkers,
    signals: buildSignals(
      declared,
      detected,
      fileName,
      width,
      height,
      parsed,
      aiSource,
    ),
    analyzed_at: new Date().toISOString(),
    disclaimer: MEDIA_SIGNALS_DISCLAIMER,
  };
};
