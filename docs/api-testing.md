# Testing the chat API with Swagger

This guide covers the MiCheck chat endpoints (the Context Detector bot): how they are documented, what they need to run, and ready-to-use requests.

Sources: `PRODUCT_SCOPE.md` (hackathon scope), `docs/audit-api.md` (step 1 audit), `lib/openapi.ts` (the spec).

## 1. Swagger setup: library choice

**Recommendation: keep what is already there.** The spec is a hand-written OpenAPI object in `lib/openapi.ts`. `GET /api/openapi` serves it, and `GET /api/docs` loads Swagger UI from a CDN. This adds no npm dependency.

| Option                                                | Setup cost                                                 | Fit for this repo                                                                                                                                                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Hand-written spec + Swagger UI from CDN (current)** | None, it already works                                     | ✅ Simplest choice for App Router route handlers. No build step and nothing new to install, which suits a 24 h hackathon (PRODUCT_SCOPE §4). The drawback is that the spec must be updated by hand when a route changes. |
| `next-swagger-doc`                                    | 1 dependency, plus JSDoc `@swagger` comments on each route | Still hand-written YAML, only moved into comments. Nothing gained here.                                                                                                                                                  |
| `@asteasolutions/zod-to-openapi`                      | Adds `zod`, and the validation code must be rewritten      | Generates the spec from the same schemas that validate requests. A good choice **after** the hackathon, alongside replacing `validateInvestigationRequest`.                                                              |
| `swagger-ui-react`                                    | 1 large dependency and a client page                       | No benefit over the CDN version.                                                                                                                                                                                         |

Changes made in this step:

- `app/api/docs/route.ts`:
  - pinned `swagger-ui-dist@5.17.14`; it previously used the floating `@5`, see audit issue in §1
  - turned on `tryItOutEnabled`, so no extra click is needed before sending a request
  - turned on `displayRequestDuration`, which helps because `/investigate` takes several seconds
- `lib/openapi.ts`:
  - added 7 named examples to the **Examples** dropdown of `/claims` and `/investigate`, based on the demo scenarios in PRODUCT_SCOPE §5
  - added an example `id` for `/investigations/{id}`
  - corrected the `/investigate` description: it promised guarantees that the code does not enforce yet (see §6)
  - marked `/bot/bot_recommandation` as `deprecated` and non-functional

Open the UI with `npm run dev`, then go to <http://localhost:3000/api/docs>. The raw spec is at <http://localhost:3000/api/openapi>.

## 2. Requirements

### Environment variables

Copy `.env.example` to `.env.local` and restart `npm run dev` after any change.

| Variable                                                                                | Required?                                                                 | Default                                                            | Purpose                                                                                                                                                      |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CONTEXT_DETECTOR_AI_API_KEY`                                                           | **Yes** for `/claims` and `/investigate`. Without it they return **503**. | none                                                               | API key for an OpenAI-compatible model provider. The default provider is Groq; a free key is available at console.groq.com.                                  |
| `CONTEXT_DETECTOR_AI_BASE_URL`                                                          | No                                                                        | `https://api.groq.com/openai/v1`                                   | Any OpenAI-compatible `/chat/completions` endpoint. The model must support `response_format: json_object`.                                                   |
| `CONTEXT_DETECTOR_AI_MODEL`                                                             | No                                                                        | `llama-3.3-70b-versatile`                                          | Model name.                                                                                                                                                  |
| `CONTEXT_DETECTOR_GROQ_VISION_MODEL` / `_MISTRAL_VISION_MODEL` / `_GEMINI_VISION_MODEL` | No                                                                        | Groq `llama-4-scout`, Mistral `pixtral`, Gemini `gemini-2.5-flash` | Multimodal model used when an image or video frames are sent. Without it, media analysis is skipped with an explicit limitation.                             |
| `CONTEXT_DETECTOR_CHAT_MAX_TOKENS`                                                      | No                                                                        | `1024`                                                             | Max output tokens for `/chat`.                                                                                                                               |
| `CONTEXT_DETECTOR_SEARCH_PROVIDER`                                                      | No                                                                        | `none`                                                             | One of `none`, `brave`, `tavily` or `generic`. With `none`, no web search runs, there is no evidence, and the verdicts are expected to be `unverifiable`.    |
| `CONTEXT_DETECTOR_SEARCH_API_KEY`                                                       | Yes when the provider is not `none`                                       | none                                                               | Key for Brave (sent as the `X-Subscription-Token` header) or Tavily (sent as `api_key` in the body). The `generic` provider also requires it (audit bug 24). |
| `CONTEXT_DETECTOR_SEARCH_URL`                                                           | Only for `generic`                                                        | Brave or Tavily official URL                                       | Custom endpoint. The `generic` provider sends `POST {q, count}` and expects `{results:[{title,url,description\|snippet\|content,…}]}`.                       |

**Minimum to test:** set only `CONTEXT_DETECTOR_AI_API_KEY`. The pipeline then runs without evidence.

**For a convincing demo:** also configure a search provider. Tavily or Brave both have free tiers.

### HTTP

| Item           | Value                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication | **None.** All chat endpoints are public. The scope document (PRODUCT_SCOPE §8) asks for rate limiting before any public deployment; see audit bug 2.     |
| Request header | `Content-Type: application/json` for the POST endpoints.                                                                                                 |
| Response       | Always `application/json`.                                                                                                                               |
| Body size      | No server-side limit, so avoid sending large `dataUrl` values. Media content is never analysed anyway.                                                   |
| Duration       | `/claims` makes 1 AI call and takes about 2–10 s. `/investigate` makes 2 AI calls plus a search and takes about 10–60 s; the worst case is around 140 s. |
| Language       | Prompts, the report and the error messages are in French. Set `options.language` to choose the answer language.                                          |

### Error format

The four chat endpoints share the same error format, produced by `lib/context-detector/http.ts`:

| Status | When                                                                                       | Body                                                              |
| ------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 400    | Empty content, invalid JSON, or `text` longer than 20,000 characters                       | `{ "message": "…" }`                                              |
| 404    | `investigations/{id}` is unknown or has expired                                            | `{ "message": "Aucune investigation trouvée avec l'id: …" }`      |
| 502    | The model provider is unreachable, returned an error status, or replied without valid JSON | `{ "message": "…", "error"?: "…" }` (`error` only in development) |
| 503    | `CONTEXT_DETECTOR_AI_API_KEY` is missing                                                   | same as 502                                                       |
| 500    | Any other error                                                                            | `{ "message": "Internal Server Error", "error"?: "…" }`           |

## 3. Request format (`/claims` and `/investigate`)

```jsonc
{
  // Required. Either a plain string (treated as text) or an object:
  "content": {
    "type": "text | url | image | video | document | mixed", // optional, detected automatically
    "text": "string, at most 20,000 characters",
    "url": "https://…", // passed to the AI as text only, never downloaded
    "media": [
      // at most 10 items
      {
        "type": "image | video | document",
        "url": "…",
        "dataUrl": "data:image/jpeg;base64,…", // images only, 4 MB max: analysed by the vision model
        "frames": ["data:image/jpeg;base64,…"], // video keyframes, 4 max, supplied by the client
        "name": "…",
        "mimeType": "…",
      },
    ],
    // at least one of text, url or media is required
  },
  "options": {
    // all optional
    "language": "fr", // keep it to a short code (audit bug 6)
    "skipSearch": false, // true skips the web search, for a fast test
    "includeReport": true, // false leaves out the Markdown `report` field
    "investigationDate": "2026-11-21T10:00:00Z", // any date Date.parse accepts; defaults to now
    "skills": ["claim-extraction", "…"], // filters the pipeline; never send [] (audit bug 14)
  },
}
```

## 4. Endpoints and example requests

In Swagger UI, open the endpoint and pick an entry in the **Examples** dropdown above the request body. Then click **Execute**.

The `curl` commands below send the same requests.

### 4.1 `GET /api/context-detector/skills`

Lists the 14 pipeline skills. It needs no key and is the quickest check that the server is running.

```bash
curl -s http://localhost:3000/api/context-detector/skills
```

Response 200: `{ "count": 14, "skills": [{ "id", "name", "description", "trigger", "outputKey", "phase", "inputTypes", "requiresTool"? }], "note": "…" }`

### 4.2 `POST /api/context-detector/claims`

Splits content into claims that can be checked. It makes 1 AI call, returns no evidence and no verdict, and stores nothing.

The Swagger examples, all available for both `/claims` and `/investigate`:

| Example                        | What it tests                    | Expected result                       |
| ------------------------------ | -------------------------------- | ------------------------------------- |
| `texte_simple`                 | `content` sent as a plain string | 200                                   |
| `scenario_1_fausse_loi`        | Demo 1 (viral fake law)          | Several claims of type `policy_legal` |
| `scenario_2_video_recyclee`    | Demo 2 (text plus a video)       | `input_type: "mixed"`                 |
| `scenario_3_image_sans_source` | Demo 3 (image with no source)    | `input_type: "mixed"`                 |
| `url_publication`              | A shared link                    | `input_type: "url"`                   |
| `sans_recherche_web`           | A precise factual claim          | 200                                   |
| `erreur_400_contenu_vide`      | Validation                       | **400** "Le contenu soumis est vide." |

```bash
curl -s -X POST http://localhost:3000/api/context-detector/claims \
  -H 'Content-Type: application/json' \
  -d '{"content":{"type":"text","text":"URGENT : à partir de demain, une nouvelle loi interdit de payer en espèces au-delà de 10 € dans tous les commerces en France. Partagez avant que ce soit supprimé !"},"options":{"language":"fr"}}'
```

Response 200:

```json
{
  "input_type": "text",
  "input_summary": "…",
  "language": "fr",
  "investigation_date": "2026-11-21T…Z",
  "claims": [
    {
      "id": "C1",
      "claim_text": "…",
      "claim_type": "policy_legal",
      "importance": "high",
      "entities": ["France"],
      "date_or_period": "…",
      "location": "France",
      "verification_question": "…",
      "ambiguities": [],
      "checkability": "verifiable"
    }
  ]
}
```

### 4.3 `POST /api/context-detector/investigate`

Runs the full pipeline and produces a dossier. This is the main endpoint for the **"Vérifier"** page (PRODUCT_SCOPE P0 #1). It accepts the same examples as `/claims`.

**Recommended order for testing:**

1. `sans_recherche_web`: confirms the AI key works. It is fast, and its verdicts should be `unverifiable`.
2. `scenario_1_fausse_loi`, run with a search provider configured.
3. Scenarios 2 and 3: the `limitations` field should say that the media was not analysed.

```bash
curl -s -X POST http://localhost:3000/api/context-detector/investigate \
  -H 'Content-Type: application/json' \
  -d '{"content":"La tour Eiffel mesure 330 mètres depuis l'"'"'ajout d'"'"'une nouvelle antenne en 2022.","options":{"language":"fr","skipSearch":true}}'
```

Response 201:

```jsonc
{
  "investigation_id": "uuid",            // copy this for 4.4
  "dossier": {
    "investigation_id": "uuid",
    "input_summary": "…", "input_type": "text", "language": "fr",
    "investigation_date": "…",
    "skills_used": ["claim-extraction", "…"],
    "claims": [ /* same shape as /claims */ ],
    "search_plan": [ { "claim_id", "queries", "source_targets", … } ],
    "evidence": [ { "source_id": "S1", "claim_ids", "url", "title", "publisher", "published_date",
                    "accessed_date", "source_type", "excerpt",
                    "stance": "supports|contradicts|contextualizes|neutral",
                    "relevance", "retrieval_notes" } ],
    "source_assessments": [], "contradictions": [], "timeline": [], "context_findings": [],
    "media_findings": [], "video_findings": [], "quote_findings": [], "framing_findings": [],
    "evidence_gaps": [],                 // each is present only if its skill ran
    "claim_verdicts": [ { "claim_id": "C1",
                          "verdict": "confirmed|refuted|misleading_or_out_of_context|unverifiable|partially_confirmed|opinion_or_non_factual",
                          "explanation", "confidence": "low|medium|high", "evidence_ids", "limitations" } ],
    "overall_verdict": { "label", "summary", "confidence", "confidence_rationale", "key_evidence_ids", "limitations" },
    "sources": [ { "source_id", "url", "title", "publisher", "published_date", "accessed_date" } ],
    "practical_takeaway": "…",
    "limitations": ["…"]
  },
  "report": "## Non vérifiable — dossier de vérification\n…"   // Markdown, left out if includeReport=false
}
```

### 4.4 `GET /api/context-detector/investigations/{id}`

Fetches a dossier that was already produced. Paste the `investigation_id` from 4.3 into the `id` field in Swagger. The prefilled example `id` will return 404, which is expected.

```bash
curl -s http://localhost:3000/api/context-detector/investigations/<investigation_id>
```

- **200:** the same body as 4.3.
- **404:** the id is unknown, the 30 minutes have passed, or the server restarted. In dev, a hot reload also clears the store.

### 4.5 `POST /api/context-detector/media-signals`

Reads technical clues from one image (PRODUCT_SCOPE P1 #5, ADR-001 §3). It makes **no AI call** and costs nothing. The file is analysed in memory and never stored. The signals are clues only: they are never a verdict and are not sent to `/investigate`.

| Item             | Value                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| Request          | `multipart/form-data` with one field, `file`                                      |
| Accepted formats | JPEG, PNG, WebP, checked on the file's **content**, not its name or declared type |
| Size limit       | 4 MB per file, 1 file per request                                                 |
| Not returned     | GPS coordinates (only `gps_present: true/false`)                                  |

**In Swagger UI:** open the endpoint, choose a file in the `file` field, then click **Execute**. Good test files:

- a photo straight from a phone camera, which has EXIF data
- a screenshot or an image downloaded from a social network, which usually has none
- a `.gif` file, which should return 415

```bash
curl -s -X POST http://localhost:3000/api/context-detector/media-signals \
  -F "file=@/path/to/photo.jpg"
```

Response 200:

```jsonc
{
  "file_name": "photo.jpg",
  "size_bytes": 2483112,
  "mime_type_declared": "image/jpeg", // what the client said (not trusted)
  "mime_type_detected": "image/jpeg", // what the bytes are
  "width": 4032,
  "height": 3024,
  "exif": {
    "make": "Nikon",
    "model": "D750",
    "date_time_original": "2021:03:14 09:26:53",
    "gps_present": true,
  }, // or null
  "provenance_markers": [], // "c2pa" | "iptc_ai_source" | "generation_parameters"
  "signals": [
    {
      "code": "camera_declared",
      "category": "metadata",
      "message": "Appareil déclaré dans l'EXIF : …",
    },
  ],
  "analyzed_at": "2026-11-21T10:00:00.000Z",
  "disclaimer": "Ces signaux ne prouvent pas l'authenticité : …",
}
```

| Signal `code`             | Category   | Triggered when                                                                              |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| `mime_mismatch`           | format     | The declared type differs from the real format                                              |
| `extension_mismatch`      | format     | The file extension differs from the real format                                             |
| `low_resolution`          | format     | The longest side is under 400 px                                                            |
| `no_exif`                 | metadata   | No EXIF data (common after social networks strip it, so it proves nothing)                  |
| `exif_unreadable`         | metadata   | An EXIF block exists but can't be read                                                      |
| `camera_declared`         | metadata   | EXIF names a camera make or model                                                           |
| `capture_date_declared`   | metadata   | EXIF contains a capture date                                                                |
| `software_declared`       | metadata   | EXIF names a software (export or editing)                                                   |
| `gps_present`             | privacy    | GPS data is present (coordinates are not returned)                                          |
| `c2pa_manifest`           | provenance | A C2PA / Content Credentials manifest is present (its signature is **not** verified)        |
| `iptc_ai_source_declared` | provenance | XMP metadata declares IPTC `DigitalSourceType` = AI-generated                               |
| `generation_parameters`   | provenance | The PNG has text fields that image generators write (`parameters`, `prompt`, `workflow`, …) |

Errors use the format `{ "message": "…", "code": "…" }`:

| Status | `code`                   | When                                                                                       |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------ |
| 400    | `INVALID_MULTIPART`      | The multipart body can't be parsed                                                         |
| 400    | `FILE_REQUIRED`          | No `file` field, or `file` is text rather than a file                                      |
| 400    | `TOO_MANY_FILES`         | More than one `file`                                                                       |
| 400    | `EMPTY_FILE`             | The file has 0 bytes                                                                       |
| 413    | `FILE_TOO_LARGE`         | Over 4 MB. When `Content-Length` announces it, the body is rejected **before** it is read. |
| 415    | `MULTIPART_REQUIRED`     | The request is not `multipart/form-data`                                                   |
| 415    | `UNSUPPORTED_MEDIA_TYPE` | The real content is not JPEG, PNG or WebP (for example a GIF renamed `.png`)               |
| 422    | `UNREADABLE_IMAGE`       | The image is truncated or damaged, so its dimensions can't be read                         |

**Using it with `/investigate` (ADR-001 §3):** the UI sends the image to `/media-signals` and the text to `/investigate` **in parallel**. It passes only the file's `name` and `mimeType` in `content.media[]`. The signals are shown in their own block of the result card.

### 4.6 `POST /api/bot/bot_recommandation` (legacy, out of scope)

This is the chatbot from the old e-commerce shop. It is marked `deprecated` in Swagger and **does not work** in this repository: `@langchain/*` is not installed and `@/data/prompt-data` is missing. It is documented here only for completeness. Example body: `{ "prompt": "Quel produit me conseillez-vous pour un cadeau ?" }`

## 5. Quick test checklist

Based on the success criteria in PRODUCT_SCOPE §6.

- [ ] `GET /skills` returns 200 with no `.env` file.
- [ ] `POST /claims` without an AI key returns **503** with a clear message.
- [ ] `erreur_400_contenu_vide` returns **400**.
- [ ] `sans_recherche_web` returns 201, `evidence` is empty, and every `claim_verdicts[].verdict` is `unverifiable` (or `opinion_or_non_factual`). A verdict the server downgraded has the limitation "Verdict ramené à « non vérifiable »…".
- [ ] With search on, every URL in `sources` comes from the search results (it is never invented), and every verdict cites at least one `evidence_ids` **or** is `unverifiable`.
- [ ] Scenarios 2 and 3: `limitations` includes "L'analyse binaire des médias … n'a pas été effectuée."
- [ ] `investigations/{id}` with the id from the previous call returns 200.
- [ ] `media-signals` returns 200 for a JPEG, PNG and WebP, 415 for a GIF, and 413 for a file over 4 MB. A photo with GPS data returns `gps_present: true` and no coordinates.
- [ ] The time shown by Swagger ("Duration") stays under 60 s per scenario, as PRODUCT_SCOPE §6 requires.

## 6. Gaps between PRODUCT_SCOPE.md and the code

These are things to keep in mind during testing and the demo.

| PRODUCT_SCOPE says                                   | Reality in the code                                                                                                                                                                                                                                                  | Reference                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| §2 "no invented citation"                            | ✅ **Fixed.** `url`, `title`, `publisher`, `excerpt`, `published_date` and `accessed_date` always come from the search results. The AI only chooses `claim_ids`, `stance`, `relevance`, `source_type` and `retrieval_notes`.                                         | audit bug 4, `normalizeEvidence`                                    |
| §2 "Without evidence, the verdict is `unverifiable`" | ✅ **Fixed.** The server now enforces it. `confirmed`, `refuted`, `partially_confirmed` and `misleading_or_out_of_context` with no valid `evidence_ids` become `unverifiable`/`low`, with a limitation explaining why. The same rule applies to the overall verdict. | audit bug 5, `normalizeClaimVerdicts` and `normalizeOverallVerdict` |
| §6 "Scenarios under one minute"                      | Not guaranteed: up to 2×60 s of AI calls plus 20 s of search, with no overall timeout.                                                                                                                                                                               | audit bug 10                                                        |
| §3 P0 #2 Google Fact Check Tools                     | Not implemented. There is no `GOOGLE_FACTCHECK_API_KEY` variable yet.                                                                                                                                                                                                | —                                                                   |
| §3 P1 #5 media signals (EXIF, MIME, dimensions)      | ✅ **Implemented** as `POST /api/context-detector/media-signals`, with no AI call and kept separate from the verdict.                                                                                                                                                | ADR-001, §4.5                                                       |
| §5 scenario 2 "first publication found"              | Possible only if search returns old results. The video itself is never analysed.                                                                                                                                                                                     | —                                                                   |
| §8 rate limiting before public deployment            | Not implemented.                                                                                                                                                                                                                                                     | audit bug 2                                                         |

The first two rows were the ones that mattered for the judges (PRODUCT_SCOPE §6: "No invented URL or date"). Both are fixed in `lib/context-detector/normalize.ts`.
