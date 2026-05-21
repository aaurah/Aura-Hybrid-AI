# AuraAI

A hybrid AI orchestration platform that connects to a remote Ollama server (LLaMA, Code LLaMA, LLaVA, etc.) and exposes a clean API and web UI. Point it at your Ollama server and get a full AI command center — multi-model chat, RAG knowledge base, tool execution, and an admin dashboard.

## Run & Operate

- `pnpm --filter @workspace/aura-ui run dev` — run the web UI (port 20701, preview at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, preview at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `OLLAMA_BASE_URL` — Ollama server URL (default: `http://localhost:11434`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + TailwindCSS + shadcn/ui

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for the API contract
- `lib/db/src/schema/` — Drizzle ORM table definitions (sessions, messages, documents, logs)
- `artifacts/api-server/src/lib/` — core services: Ollama client, model registry, tool runners, RAG engine
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/aura-ui/src/pages/` — React pages: chat, sessions, models, rag, tools, admin

## Architecture decisions

- **Ollama-first**: All inference goes through Ollama's HTTP API at `OLLAMA_BASE_URL`. The orchestrator is a thin routing + persistence layer.
- **Model routing by mode**: `mode=chat` → LLaMA 3, `mode=code` → Code LLaMA, `mode=vision` → LLaVA. Override with explicit `model` field.
- **RAG via cosine similarity**: Embeddings stored as JSON in Postgres, similarity computed in Node. Suitable for moderate document counts; swap to pgvector for scale.
- **Tool safety**: Shell tool is allowlisted to read-only commands (ls, cat, grep, etc.). Git tools are read-only (status, diff, log).
- **Session auto-creation**: Chat endpoint auto-creates a session if `sessionId` is not provided.

## Product

- **Chat**: Multi-tab chat with mode switching (chat/code/vision), per-session system prompts, temperature/token controls, RAG and tool toggles
- **Sessions**: Manage and browse all chat history
- **Models**: Registry of all supported models with availability status from Ollama
- **Knowledge Base**: Ingest documents for RAG, test vector search
- **Tools**: Browse and manually execute tools (HTTP fetch, shell, git)
- **Admin**: Platform stats, model usage breakdown, Ollama connectivity, request logs

## Gotchas

- Set `OLLAMA_BASE_URL` to point at your running Ollama server (e.g. `http://192.168.1.100:11434`)
- RAG embeddings require `nomic-embed-text` model to be pulled on the Ollama server: `ollama pull nomic-embed-text`
- The API server must be running for the frontend to function — both workflows need to be active

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
