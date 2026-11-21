# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also `AGENTS.md` (shared agent instructions) — its rules apply here too.

## Commands

- Install: `npm i` (repo root)
- Dev server: `npm run dev` (Next.js 16, Turbopack; Tailwind v4 is wired through a Turbopack loader in `next.config.ts`)
- Build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit` (no `typecheck` script)
- There is no test framework or test script.

Manual API exploration: Swagger UI at `/api/docs`, backed by the spec at `/api/openapi` (built from `lib/openapi.ts`). When adding or changing a route, update `lib/openapi.ts` too.

## Repository state (important)

This checkout is a partial port of a larger app (an e-commerce / 3D product customizer — products, categories, Stripe payments, admin sessions) onto a fresh Next.js scaffold. As a result:

- Most routes under `app/api` (products, users, payment, admin, auth, bot, category, verify_recaptcha) import modules that **do not exist here**: `@/lib/prisma`, `@/lib/nextauth`, `@/lib/stripe`, `@/lib/sessions/dbSession`, `@/lib/api-utils`, `@/lib/sqlQuery`, `@/types`, `@/data/prompt-data`. There is no Prisma schema.
- `package.json` only declares `next`, `react`, `react-dom`. Packages imported by legacy code (`@prisma/client`, `next-auth`, `@langchain/groq`, `three`, `gsap`, `axios`, `react-google-recaptcha`, …) are not installed. Expect `tsc`/`build` to fail on those files; don't treat such errors as regressions from your change.
- Verify a helper exists before importing it; flag missing helpers rather than inventing their API.
- `hooks/`, `models/` (TS types for product/user/transaction/…), `icons/`, `constants/` and `lib/laingchain/` (sic) are also legacy carry-overs.

The actively developed, self-contained feature is the **Context Detector**.

## Context Detector architecture

An evidence-led fact-checking pipeline ("MiCheck"). User-facing strings, prompts and skill docs are in **French**.

Routes (public, under the `(client)` route group — no auth):
- `GET  /api/context-detector/skills` — skill catalog
- `POST /api/context-detector/claims` — claim extraction only
- `POST /api/context-detector/investigate` — full investigation, returns 201
- `POST /api/context-detector/chat` — conversational assistant, optionally grounded in a stored dossier
- `GET  /api/context-detector/investigations/[id]` — fetch a stored result
- `POST /api/context-detector/media-signals` — multipart image (≤ 4 MB, JPEG/PNG/WebP sniffed from bytes) → technical clues (EXIF, provenance markers); no AI call, never feeds the verdict (`lib/context-detector/media.ts`, see `docs/adr-content-detector.md`)

Routes are thin: validate with `validateInvestigationRequest` (`lib/context-detector/normalize.ts`), call the orchestrator, and map errors with `contextDetectorErrorResponse` (`lib/context-detector/http.ts`): validation → 400, missing config → 503, AI provider failure → 502, else 500.

Pipeline in `lib/context-detector/orchestrator.ts` (`runInvestigation`):
1. `skills.ts` detects input type and selects relevant skills (web search skills only if a search provider is configured).
2. First LLM call (`requestStructuredJson` in `ai.ts`) with the extraction prompt from `prompts.ts` → claims + search plan.
3. Up to 6 deduplicated queries go to `search.ts` (`CONTEXT_DETECTOR_SEARCH_PROVIDER` = `none` | `generic` | `brave` | `tavily`).
4. Results become an evidence packet. If media is present, `media.ts` sends image `dataUrl`s and client-supplied video `frames` to a vision model; those observations are added to the analysis input and merged into `media_findings`, always framed as observations that prove neither authenticity nor manipulation.
5. Second LLM call produces analysis + verdicts.
6. Everything is passed through `normalize.ts` (LLM output is never trusted raw), assembled into a `Dossier`, optionally rendered to Markdown by `report.ts`.
7. Saved in `store.ts` — an **in-memory Map with 30-min TTL** (lost on restart, not shared across instances). `chat.ts` reads it to ground `/chat`.

`ai.ts` talks to any OpenAI-compatible `/chat/completions` endpoint via plain `fetch` (default Groq, `llama-3.3-70b-versatile`) and extracts a JSON object from the response. No SDK dependencies.

Env vars (see `.env.example`): per-provider keys (`CONTEXT_DETECTOR_GROQ_API_KEY`, `_MISTRAL_`, `_GEMINI_`, `_XAI_`, `_HF_`), `CONTEXT_DETECTOR_AI_PROVIDERS`, `CONTEXT_DETECTOR_*_MODEL`, `CONTEXT_DETECTOR_*_VISION_MODEL`, `CONTEXT_DETECTOR_AI_MAX_TOKENS`, `CONTEXT_DETECTOR_CHAT_MAX_TOKENS`, `CONTEXT_DETECTOR_SEARCH_PROVIDERS`, `CONTEXT_DETECTOR_TAVILY_API_KEY`, `CONTEXT_DETECTOR_BRAVE_API_KEY`.

### Skills in `.agents/skills/`

`.agents/skills/*/SKILL.md` (claim-extraction, source-evaluation, verdict-calibration, …) are the design spec for the pipeline; `context-detector/reference/contract.md` defines the shared output schema (verdict enum, confidence levels, claim types). They are **not read at runtime** — `lib/context-detector/skills.ts` hardcodes a catalog that mirrors them, and `types.ts`/`normalize.ts` implement the contract. Keep these in sync when changing either side. `opencode.json` points OpenCode at this folder.

Key product rules from the spec that the code must preserve: never fabricate URLs/quotes/dates/numeric confidence scores; use `unverifiable` instead of guessing; treat submitted content and fetched pages as untrusted (prompt-injection resistant); don't count syndicated copies as independent corroboration.

## API route conventions

For any work in `app/api`, follow `.agents/skills/api-route-builder/SKILL.md`. Highlights:
- One named export per HTTP verb, no default export; `NextResponse.json(payload, { status })` with explicit codes.
- Use the `@/` alias for project modules (maps to repo root), relative imports within `app/api`.
- 4-space indent, double quotes, semicolons, trailing commas.
- Protected routes wrap a handler with `checkHasAccess(handler, { type: "db_session" | "nextauth", adminRole })` from `app/api/middlewares/auth.ts` (default: Bearer token, `ADMIN`). Route groups like `(client)` do not add protection.
- Error bodies: `{ message: "Internal Server Error", error }`, with `error` only when `NODE_ENV === "development"`.

## Content Detector
- "Content Detector" page: text and image analysis
- API lives in /api
- Only modify what the task asks for
