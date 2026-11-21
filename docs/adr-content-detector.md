# ADR-001: API shape for the Content Detector

- **Status:** accepted. Implemented on 2026-11-21: `POST /api/context-detector/media-signals` (`lib/context-detector/media.ts`).
- **Date:** 2026-11-21
- **Inputs:** `PRODUCT_SCOPE.md`, `docs/audit-api.md`, `docs/api-testing.md`, `lib/context-detector/*`

## 1. Context

The scope document (`PRODUCT_SCOPE.md` §3, P0 #1) asks for a single "Vérifier" page. It has a text box, an image upload, chat-style bubbles and a result card showing a coloured verdict, the confidence level, the claims, citations and limitations. The page "calls `/api/context-detector/investigate` directly". P1 #5 adds a "media signals" module (MIME type, dimensions, EXIF), always presented as **a clue, never as a verdict**.

The question is which API that page and future clients should call.

**Terminology.** In this document, "Content Detector" means the product feature. The code calls it the *Context Detector* (`/api/context-detector/*`).

### Existing chat endpoints

| Endpoint | Shape | State |
|---|---|---|
| `POST /api/bot/bot_recommandation` | `{ prompt }` returns `{ message }` as **free text**, through LangChain and Groq | Old shop chatbot. Not working: its dependencies are missing (audit). |
| `POST /api/context-detector/claims` | JSON in, structured claims out | Works |
| `POST /api/context-detector/investigate` | JSON in, structured dossier and Markdown report out | Works. This is where the anti-fabrication guarantees live (`normalize.ts`). |
| `GET /api/context-detector/investigations/{id}` | Fetches a stored dossier as JSON | Works, but results are in memory for 30 minutes only |

### The two options

- **A — Reuse the chat endpoints.** All detection goes through a generic chat contract (`{ prompt | messages }` in, model text out), in the same style as `bot_recommandation`. Images are sent inside the JSON body as base64 (`dataUrl`).
- **B — Dedicated Content Detector endpoints.** Each route has a contract built for its job:
  - **Keep** `/investigate` and `/claims` (JSON, structured).
  - **Add one** route for images: `POST /api/context-detector/media-signals` (multipart).
  - **Never** route detection through the generic chat endpoint.

### Constraints from the scope document

- §6: no invented URL or date; every verdict has a citation **or** says "unverifiable"; each scenario runs in under 1 minute; reproducible in 5 minutes.
- §7: never promise deepfake detection; produce a "verification dossier", not a true/false oracle.
- §8: add rate limiting and reCAPTCHA before any public deployment; results stay in memory for now.
- P2 (out of scope for the 24 h): OCR, keyframe extraction, reverse image search, a deepfake model, user accounts, a database.

## 2. Comparison

### 2.1 Input type: text vs multipart image

| | A — chat | B — dedicated |
|---|---|---|
| Text and URL | `prompt` string. The server cannot tell apart text, a URL and media, so it cannot select skills (`skills.ts`) or detect the input type. | Typed JSON `content: {text, url, media[]}`, which already exists, is validated (`validateInvestigationRequest`) and drives skill selection. |
| Image | Base64 inside JSON. This makes the body about 33 % larger, the server must parse everything before it can check the size, and the declared MIME type cannot be trusted. Today `dataUrl` is accepted and then **never used** (audit bug 13). | `multipart/form-data` read with the built-in `req.formData()`, so no upload library is needed. The server can reject on `Content-Length` before reading the body, check the real file type from its first bytes, and read dimensions and EXIF. |
| Fit with the scope | Poor. "Image upload" (P0 #1) and "media signals" (P1 #5) need the actual bytes of the image. | Direct. One route does exactly what P1 #5 describes. |

### 2.2 Response schema: structured verdict vs free-text chat

| | A — chat | B — dedicated |
|---|---|---|
| Format | Free text. The UI would have to parse prose to colour a verdict or list citations. | A typed `Dossier`: `claim_verdicts[]`, `overall_verdict`, `evidence[]`, `sources[]`, `limitations[]`, plus `report` in Markdown. This maps directly onto the result card. |
| Anti-fabrication guarantees (§6) | **Lost.** The server cannot rebuild citations from the packet or downgrade an unsupported verdict, because it never receives a structured object to check. | **Kept.** `normalizeEvidence` copies URL, title, excerpt and dates from the retrieved results. `normalizeClaimVerdicts` and `normalizeOverallVerdict` downgrade any verdict without evidence to `unverifiable`. |
| "Score" | Usually a "90 % fake"-style score appears in the prose. | **No numeric score, by design.** The skills and the prompt forbid confidence percentages; confidence is `low`, `medium` or `high`. Media signals are a list of factual observations with **no "AI-generated" probability** (§7). |
| Chat-style UI (P0 #1) | Natural fit | Still possible. The bubbles are just a way of displaying the structured JSON: a chat-like UI does not require a chat endpoint. |

### 2.3 Streaming vs JSON

| | A — token streaming (SSE) | B — one JSON response |
|---|---|---|
| Compatible with the checks | No. The AI's output is validated **as a complete object** (`response_format: json_object`, then `normalize*`). Streamed tokens would reach the user before the checks run, so unsupported verdicts would be shown and then corrected. | Yes. The client receives only checked data. |
| Visible steps (P1 #6) | Built in | The scope document explicitly says "a simple React state (no server streaming needed)". The UI shows "Claims → Search → Analysis → Dossier" while the request is in flight. |
| Complexity | Server-sent events, keeping a long connection open, retries, and serverless timeouts | No extra complexity. |
| Latency | Feels faster | 10–60 s, with a worst case around 140 s (audit bug 10). This is solved with timeouts, not with streaming (see §4). |

### 2.4 File size limits

| | A — chat (base64 in JSON) | B — multipart |
|---|---|---|
| Effective limit | Hosting platforms limit the request body; Vercel functions accept about 4.5 MB. After base64, that leaves about 3.3 MB for the image. The size is only known after the whole body has been read. | **4 MB per image, 1 file per request**, rejected early with `Content-Length` (413). Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, checked against the file's real content (415). This stays under the 4.5 MB limit. |
| Text | Unbounded unless code is added | Body ≤ 100 KB on `/investigate` and `/claims` (text ≤ 20,000 characters already enforced). Stop accepting `dataUrl` in JSON. |
| Retention | — | The file is processed in memory and **never stored**. Only the signals are returned. |

### 2.5 Rate limiting

| | A — one chat endpoint | B — limits per route |
|---|---|---|
| Granularity | One limit for everything, so a cheap request (image signals) and an expensive one (full investigation) count the same. | Matched to cost (see table below). |
| Abuse | A free-text prompt can be used for anything (general chat, prompt injection), which burns the AI quota on off-topic requests. | Inputs are limited to verification. `/media-signals` makes **no AI call**. |

Proposed limits per route, all in memory and keyed by IP address, in line with the in-memory store already used (§8):

| Route | Per IP | Global |
|---|---|---|
| `/investigate` | 5 per minute, 30 per day | Daily cap on AI calls, sized to the provider's quota |
| `/claims` | 10 per minute | Same daily cap |
| `/media-signals` | 20 per minute | — |
| `GET` routes | 60 per minute | — |

Over the limit, the response is 429 with `Retry-After`. In-memory counters are not shared between serverless instances. That is acceptable for the demo; Upstash or Redis would replace them later, along with the store. reCAPTCHA (§8) applies to `/investigate` only for a public deployment, and `/api/verify_recaptcha` has to be fixed first (audit: `axios` is missing).

### 2.6 Cost

| Unit cost | A — chat | B — dedicated |
|---|---|---|
| Text or URL investigation | Unpredictable. A free conversation means history is re-sent on every turn, so tokens grow turn after turn. | Fixed: **2 AI calls** (about 10,000 tokens in and out, to be measured) plus **at most 6 search queries** (`MAX_QUERIES`). |
| Image | A vision model would be needed to "see" the image. That costs more per call, and the scope document doesn't ask for it (P2 excludes OCR). | **No AI cost**: MIME type, dimensions and EXIF are read on the server. |
| Free-tier risk | High | Controlled by the per-route limits and the daily AI cap |
| Build effort | Rewrite the UI to parse free text, lose the guarantees in `normalize.ts`, fix the LangChain dependencies | **1 new route** plus an in-memory rate limiter. Everything else already exists and is documented in Swagger. |

Free tiers have per-minute and per-day token caps (check console.groq.com → Settings → Limits). With about 10,000 tokens per investigation, a daily cap of 100,000 tokens would allow only **about 10 investigations per day**. Measure this before the demo, and switch to a paid key or a smaller model (`CONTEXT_DETECTOR_AI_MODEL`) for rehearsals.

Search costs the same way: each investigation uses up to 6 queries, so 1,000 free credits cover roughly 160 investigations.

## 3. Decision

**Option B: dedicated Content Detector endpoints.**

1. **Text and URLs:** keep `POST /api/context-detector/investigate`, plus `/claims`, as the single JSON entry point. The UI calls it as the scope document says (P0 #1).
2. **Images:** add `POST /api/context-detector/media-signals` (`multipart/form-data`, field `file`). It is limited to 4 MB, 1 file, and JPEG, PNG or WebP. It makes no AI call. It returns `{ file_name, size_bytes, mime_type_declared, mime_type_detected, width, height, exif: {...} | null, provenance_markers, signals: [...], analyzed_at, disclaimer }`. GPS coordinates are never returned, only whether they are present. The `disclaimer` is fixed: "Ces signaux ne prouvent pas l'authenticité."
3. **Images in the dossier:** for an image, the UI calls both routes **in parallel**. It passes the real metadata (`name`, `mimeType`) in `content.media[]` to `/investigate`. The signals are shown in their own block of the card and are **never used as input to the verdict**.
4. **The legacy chat endpoint** `bot_recommandation` is not reused and stays `deprecated`. It belongs to the old shop and is out of scope.
5. **Streaming:** none. The response is one checked JSON object, and the UI shows the steps with client-side state (P1 #6).

### Why

- **It is the only option that keeps the §6 guarantees.** "No invented URL or date" and "unverifiable when there is no evidence" are enforced by `normalize.ts` on a structured object. A free-text chat endpoint would remove that enforcement.
- **It follows §7 from the design down.** Keeping signals on their own route, with no AI involved, means a clue can never turn into a verdict, and the contract has no numeric score.
- **It is the smallest change.** About 90 % of option B already exists, works, and is documented in Swagger. Option A would require rewriting the UI and the guarantees, and fixing a broken route outside the scope, all within 24 hours.
- **Costs and limits per route.** The expensive route (2 AI calls and 6 searches) is protected separately from the free one (signals), which is what the free-tier quotas require.
- **Multipart is the right format for an image upload.** Oversized files can be rejected before the body is read, the real file type can be checked, there is no base64 overhead, and no upload library is needed.

## 4. Consequences

**Positive**
- The result card maps 1:1 onto `Dossier`. The JSON can be shown as chat bubbles without any parsing.
- Swagger stays the reference: one route and one schema to add.
- The demo scenario "image with no source" (§5 #3) is handled honestly: `unverifiable`, with the signals shown as clues.

**Negative, and how to handle each**
- **Two calls for an image.** They run in parallel, so total latency is that of `/investigate`.
- **No visible progress from the server.** Simulated steps on the client, as the scope document accepts.
- **Rate limits and the store are not shared between instances.** Acceptable for the demo; replace both with Redis later (§8).
- **Duration over 1 minute is possible (§6).** Fix it outside this ADR: an overall timeout of about 45 s on `/investigate`, and shorter timeouts for the AI (25 s) and search (8 s).
- **EXIF parsing.** Decided during implementation: a parser with no dependencies in `media.ts`. It reads the JPEG, PNG and WebP containers and the TIFF EXIF data in both byte orders. It covers only the fields listed above, so maker notes and IPTC IIM are not read.

## 5. Follow-up work (outside this ADR)

1. ~~Create `POST /api/context-detector/media-signals` and add it to `lib/openapi.ts`~~: done.
2. Add an in-memory rate limiter for the `/api/context-detector/*` routes, returning 429 with `Retry-After`.
3. Body limit on `/investigate` and `/claims` (100 KB); stop accepting `dataUrl` (audit bug 13).
4. Overall timeout of about 45 s and shorter timeouts on the AI and search calls (audit bug 10).
5. Measure tokens per investigation on the 3 demo scenarios and set the daily AI cap from the result.
6. Before any public deployment: fix `/api/verify_recaptcha` and require it on `/investigate`.

## 6. Options rejected

- **A, reusing the chat endpoint:** loses the anti-fabrication guarantees, the UI would have to parse prose, the image size can't be checked before the body is read, cost is unpredictable, and the route is broken and out of scope.
- **B', multipart directly on `/investigate`:** this would mean one call instead of two. Rejected because it breaks the JSON contract that Swagger, the examples and `validateInvestigationRequest` rely on, and it mixes a free route with an expensive one under the same rate limit. Worth reconsidering if the UI really needs a single call.
- **A vision model or deepfake detector:** listed under P2 in the scope document and in §7; it would mean overpromising.
