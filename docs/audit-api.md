# API audit — `app/api`

- **Date:** 2026-11-21
- **Branch:** `feat/api` (commit `baf353b`)
- **Scope:** every `route.ts` under `app/api`, `app/api/middlewares/auth.ts`, and the `lib/context-detector/*` modules those routes use.
- **Method:** read-only review of the code. Nothing was run. `node_modules` is not installed, and no `.env` file or database is present.

"Works?" means: would this route answer correctly if it were deployed from this checkout as it is now.

- ✅ yes
- ⚠️ works, but with bugs
- ❌ cannot work as it stands

## 1. Endpoint table

### Docs

| Endpoint | Purpose | Works? | Issue found |
|---|---|---|---|
| `GET /api/docs` | Swagger UI page | ✅ | Loads `swagger-ui-dist@5` from a CDN with a floating major version and no SRI hash. |
| `GET /api/openapi` | OpenAPI 3 spec from `lib/openapi.ts` | ✅ | The NextAuth path is written literally as `/api/auth/[...nextauth]`, so Swagger cannot call it. |

### Context Detector (public)

| Endpoint | Purpose | Works? | Issue found |
|---|---|---|---|
| `GET /api/context-detector/skills` | Lists the skill catalog | ✅ | None. |
| `POST /api/context-detector/claims` | Extracts claims only (1 AI call) | ⚠️ | No auth and no rate limit on a paid AI call. `options.language` is inserted into the system prompt as-is (prompt injection). Requires `CONTEXT_DETECTOR_AI_API_KEY`, otherwise returns 503. |
| `POST /api/context-detector/investigate` | Full pipeline: extract → search → analyse → dossier | ⚠️ | Same problems as `/claims`. The AI can rewrite the `excerpt` and `published_date` of real sources. Verdicts are not calibrated against the evidence. URLs and media are never actually opened. Runs up to 2×60 s of AI calls plus 20 s of search. Details in §2. |
| `GET /api/context-detector/investigations/{id}` | Fetches a stored result | ⚠️ | Results live in an in-memory `Map` for 30 minutes. They are lost on restart or hot reload, not shared between instances, and the map has no size limit. |

### Auth

| Endpoint | Purpose | Works? | Issue found |
|---|---|---|---|
| `GET/POST /api/auth/[...nextauth]` | NextAuth handler | ❌ | `@/lib/nextauth` is missing and `next-auth` is not installed. |
| `POST /api/auth/server_session` | Returns the decoded NextAuth JWT | ❌ | Uses `next-auth/jwt`, which is not installed. Also logs the full token with `console.log(token)` and returns the raw JWT payload. |

### Shop

| Endpoint | Purpose | Works? | Issue found |
|---|---|---|---|
| `GET /api/category` | Categories with all their products | ❌ | `@/lib/prisma` is missing. Response size is unbounded because each category includes every product. |
| `GET /api/product/{cuid}` | Product detail | ❌ | `@/lib/prisma` is missing. Error message is missing a space before the cuid. `searchParams` is unused. |
| `GET /api/products` | Paginated, filtered product list | ❌ | `@/lib/prisma` is missing. Pagination is skipped when `pagination_skip=0`. `totalCount` ignores the filters. A malformed `price_range` becomes `NaN`. |
| `GET /api/products/count` | Product count (admin) | ❌ | `@/lib/prisma` is missing, and auth helpers are missing. Returns `error.message` in production. |
| `GET /api/products/recent` | Last 5 products from the past 7 days (admin) | ❌ | Missing modules. The response key `mostSelledProducts` does not match what the route does, and sorting `asc` returns the oldest products of the week first. |

### Users

| Endpoint | Purpose | Works? | Issue found |
|---|---|---|---|
| `GET /api/users` | Paginated user list with accounts (admin) | ❌ | Missing modules. Same pagination bug as `/api/products`. Returns linked `accounts`, which may contain OAuth tokens. Leaks `error.message`. |
| `GET /api/users/count` | User count (admin) | ❌ | Missing modules. Leaks `error.message`. |
| `GET /api/users/get_stats` | Users per month (admin) | ❌ | `@/lib/sqlQuery` is missing. Uses `$queryRawUnsafe`. `year` is optional here but required in the payment version. |
| `GET /api/user` | Current user, from a NextAuth session | ❌ | Missing modules. If `req.userId` is `null`, Prisma throws and the route returns 500 instead of 401. |

### Payments

| Endpoint | Purpose | Works? | Issue found |
|---|---|---|---|
| `POST /api/payment` | Creates a Stripe Checkout session | ❌ | `@/lib/stripe` and `@/lib/prisma` are missing. See bugs 3 and 11. |
| `GET /api/payment` | Paginated transaction list (admin) | ❌ | Missing modules. Same pagination bug as `/api/products`. |
| `GET /api/payment/count` | Transactions per year (admin) | ❌ | Missing modules. Returns 404 when `year` is missing (should be 400). Uses `$queryRawUnsafe`. |
| `GET /api/payment/get_stats` | Transactions per month (admin) | ❌ | Same issues as `/api/payment/count`. |

### Admin

| Endpoint | Purpose | Works? | Issue found |
|---|---|---|---|
| `GET /api/admin/info` | All admins, including `adminFacial` (admin) | ❌ | Missing modules. Sends facial data (biometric) for every admin to any authenticated admin. |
| `GET /api/admin/session/{token}` | Returns the DB session for a token | ❌ | `@/lib/sessions/dbSession` is missing. **No auth**: anyone can test whether a token is valid and read its session. The token also sits in the URL, where it ends up in logs. |

### Other

| Endpoint | Purpose | Works? | Issue found |
|---|---|---|---|
| `POST /api/bot/bot_recommandation` | Shop chatbot (LangChain + Groq) | ❌ | `@langchain/*` is not installed and `@/data/prompt-data` is missing. Returns 404 for empty input (should be 400) and 201 for a generated reply. No rate limit. |
| `POST /api/verify_recaptcha` | Checks a reCAPTCHA token | ❌ | `axios` is not installed. `captchaValue` goes into the URL without encoding. The secret travels in the query string. Returns 200 even when `success: false`. |

**Summary:** 6 of the 25 endpoints can work today: the 2 docs routes and the 4 Context Detector routes. The other 19 fail because of missing modules and packages (see the "Repository state" section of `CLAUDE.md`).

## 2. Bugs ranked by severity

Each bug is tagged with what it affects:

- **[CD]** Context Detector
- **[Legacy]** the older shop and admin routes
- **[All]** the whole app

### Critical

1. **[All] `next build` should fail for the whole app.** I inferred this from the code; it was not run.
   - Next compiles every route at build time. 19 routes import modules that do not exist (`@/lib/prisma`, `@/lib/nextauth`, `@/lib/stripe`, `@/lib/sessions/dbSession`, `@/lib/api-utils`, `@/lib/sqlQuery`, `@/types`, `@/data/prompt-data`), or packages missing from `package.json` (`@prisma/client`, `next-auth`, `@langchain/*`, `axios`).
   - The Context Detector would then not ship either. In dev, Turbopack compiles routes only when they are requested, which hides the problem.
   - Fix: restore these dependencies, or isolate or remove the legacy routes.
2. **[CD] Paid AI endpoints are public with no limits.** `/claims` and `/investigate` have no auth, no rate limit, no quota and no request size limit. A simple script can run up the Groq and search bills, or use up the quota.
3. **[Legacy] `GET /api/admin/session/{token}` has no auth.** Anyone can check whether an admin token is valid and read its session. Admin tokens can be brute-forced or replayed.

### High

4. **[CD] The AI can change real source data.** In `normalize.ts` (`normalizeEvidence`), the AI's `excerpt` and `published_date` overwrite the values that came back from search. The AI can therefore attach an invented quote or date to a real URL. This breaks the "never invent citations" principle.
   - Fix: always keep the excerpt and date from the packet, and store the AI's paraphrase in a separate field.
5. **[CD] Verdicts are not checked against the evidence.**
   - `normalizeClaimVerdicts` accepts `confirmed` or `refuted` with `high` confidence even when `evidence_ids` is empty. This happens for example when search is not configured or `skipSearch` is set, and the AI then answers from its own knowledge.
   - Fix: when a verdict has no evidence, downgrade it to `unverifiable` with `low` confidence. Downgrade `high` when the evidence comes from search snippets that were never opened.
6. **[CD] Prompt injection through `options.language`.**
   - The value is inserted as-is into **both system prompts** (`prompts.ts`), with no length limit or allow-list. This bypasses the "untrusted data" framing used for submitted content.
   - Fix: accept only a short language code such as `fr` or `en-US`.
7. **[Legacy] `checkHasAccess` does not really check authorization.**
   - With `adminRole: "ADMIN"` (the default), the user's role is never checked.
   - If `getSession` returns `null`, `new Date(undefined).getTime()` gives `NaN`. Whether the request is then rejected depends on `isTokenExpired`, which is missing, so it is not certain that it fails closed.
8. **[Legacy] `POST /api/auth/server_session`** writes the decoded JWT to logs and returns it to the client.
9. **[Legacy] `GET /api/admin/info`** sends every admin's facial data to any admin.

### Medium

10. **[CD] No overall timeout.** Two AI calls of up to 60 s each, plus up to 20 s of search, can exceed serverless function limits. The client has no streaming or job status to follow progress.
11. **[Legacy] `POST /api/payment`:**
    - It has no auth.
    - `unit_amount: product.price.toNumber()` sends euros where Stripe expects cents. This is likely a ×100 error, and Stripe rejects decimal amounts.
    - `description.split` crashes when `description` is null.
    - No `Transaction` record is created.
    - Quantity is always 1.
12. **[Legacy] Pagination is skipped on the first page.** `paginationCount && paginationSkip` is false when `skip=0`, so every row is returned. Affects `products`, `users` and `payment` (GET).
13. **[CD] Media and data URLs are accepted with no size limit.** `parseMedia` keeps `dataUrl`, so a request body can be several MB. The data is then never used (only metadata reaches the prompt), so this is pointless risk.
14. **[CD] `options.skills` can drop required steps.**
    - With `skills: []`, every skill is filtered out. Search still runs, but `evidence`, `source_assessments` and the other sections are left out of the dossier.
    - `claim-extraction` and `verdict-calibration` can also be excluded, while the pipeline still runs them.
15. **[Legacy] `verify_recaptcha`:** the token is not encoded, the secret is in the URL, and the route returns 200 even when verification fails.
16. **[CD] The result store has no size limit.** It is purged only when a request comes in, so memory can grow without bound under load.
17. **[Legacy] Raw SQL through `$queryRawUnsafe`.** `year` is converted to an integer first, so this is not exploitable today, but it is fragile. Use `$queryRaw` with parameters instead.

### Low

18. **[CD] Duplicate claim IDs from the AI are kept** (`normalizeClaims`). Verdicts are then attached to the wrong claim.
    - `evidence.claim_ids`, `contradictions.claim_id` and `evidence_gaps.claim_id` are not checked against the extracted claims.
19. **[CD] The overall verdict fallback uses the first non-opinion verdict**, not the most important claim.
20. **[CD] Text inputs are not validated the same way.** `content: "..."` (a string) is silently truncated to 20,000 characters. `content.text` longer than that is rejected with a 400.
21. **[CD] Quote detection (`hasQuote`) misses some quote marks.** It does not recognize `“`, `‘`, `’` or `»` on their own.
22. **[CD] Source titles from search are inserted into the Markdown report without escaping.** A `]` or `)` in a title breaks the citation links.
23. **[CD] The declared `type` takes priority over the detected one.** A request with `type: "image"` and no media runs the image analysis on nothing.
24. **[CD] The `generic` search provider requires an API key** even when the endpoint does not need one.
25. **[Legacy] Wrong HTTP status codes:**
    - 404 for invalid input in `bot`, `payment/count`, `payment/get_stats` and `admin/session` (should be 400).
    - 201 for a generated reply in `bot`.
    - The "no AI response" case in `bot` returns 404 (should be 502).
26. **[Legacy] `error.message` is exposed in production** in about ten routes. This goes against the `api-route-builder` convention.
27. **[Legacy] Smaller issues:**
    - `products/recent`: misleading name and sort order.
    - `product/{cuid}`: missing space in the message.
    - `category`: response size is unbounded.

## 3. Missing features for the Context Detector

Based on the spec in `.agents/skills/` compared with the current code:

1. **Fetching submitted URLs.** `content.url` is only passed to the AI as text. The page is never downloaded, so there is no extraction of the main text, title, date or author, and no archive check (Wayback Machine). The `url` input type is therefore only nominal.
2. **Opening search results.** The evidence consists only of search snippets (`"Résultat de recherche non ouvert automatiquement"`). No source page is read, even though the prompt and the `source-evaluation` skill assume they are.
3. **Real media analysis.** `image-investigation` and `video-investigation` only receive metadata. Missing:
   - sending the image to a vision model
   - OCR
   - EXIF metadata
   - reverse image search
   - extracting key frames from videos and transcribing them
   - parsing documents (PDF)
4. **File uploads.** There is no multipart upload endpoint, and no limits on size or MIME type.
5. **Durable storage of investigations.** Use a database (Prisma or Neon) instead of the in-memory `Map`, with listing, deletion and history.
6. **Async jobs and progress.** For example `POST /investigate` returning 202 with a job ID, then polling or SSE to follow progress through each step. The current call blocks for up to about 140 s.
7. **Protection for the endpoints.** Rate limiting per IP or user, optional auth, and an AI quota or budget.
8. **Checks on the AI output.**
   - Downgrade verdicts that lack evidence.
   - Group sources by independence in code rather than relying on the AI to fill `independence_cluster_id`.
   - Detect syndicated copies of the same article, for example by domain or by near-identical text.
9. **More specialised sources.** Fact-check APIs such as the Google Fact Check Tools API or ClaimReview data, a search for the earliest publication (for `context-timeline`), and quote search (`quote-verification`).
10. **Report export.** The Markdown report exists, but there is no HTML or PDF version and no shareable link.
11. **Tests.** There are no unit tests for `normalize.ts`, `skills.ts` or `report.ts`, which hold all the protections against bad AI output, and no test fixtures for AI responses.
12. **Observability.** No correlation ID in logs, and no tracking of latency or token usage per step.
13. **User interface.** `app/page.tsx` is still the Next.js starter page, so there is no front end for submitting content and reading the dossier.
