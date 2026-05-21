import { getModelRegistry, getRoutingConfig } from "./config";

export type ModelType =
  | "reasoning"
  | "chat"
  | "code"
  | "vision"
  | "image-gen"
  | "fast"
  | "embed";

export type ChatMode =
  | "chat"
  | "reasoning"
  | "code"
  | "vision"
  | "ocr"
  | "fast"
  | "multilingual"
  | "image-gen"
  | "agent"
  | "embed";

export interface ModelDefinition {
  id: string;
  displayName: string;
  type: ModelType;
  description: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  available?: boolean;
}

/**
 * Hybrid Model Stack — AuraAI 2026
 * Source of truth is config/models.yaml; this registry is a
 * typed fallback used when the config hasn't loaded yet.
 */
export const MODEL_REGISTRY: ModelDefinition[] = [
  // ── Reasoning / General Intelligence ───────────────────────
  {
    id: "llama3.1:70b",
    displayName: "LLaMA 3.1 70B",
    type: "reasoning",
    description: "Primary brain — best open-source general intelligence. Deep reasoning, planning, agent loops.",
    defaultTemperature: 0.7,
    defaultMaxTokens: 4096,
  },
  {
    id: "deepseek-r1",
    displayName: "DeepSeek R1",
    type: "reasoning",
    description: "Best chain-of-thought reasoning engine. Symbolic logic, multi-step planning.",
    defaultTemperature: 0.6,
    defaultMaxTokens: 8192,
  },
  {
    id: "qwen2.5:72b",
    displayName: "Qwen 2.5 72B",
    type: "reasoning",
    description: "Best multilingual + logic model. Strongest non-English reasoning.",
    defaultTemperature: 0.7,
    defaultMaxTokens: 8192,
  },

  // ── Coding / DevOps / Automation ────────────────────────────
  {
    id: "deepseek-coder-v2",
    displayName: "DeepSeek Coder V3",
    type: "code",
    description: "Strongest open-source coder. Git tools, debugging, refactoring, smart agents.",
    defaultTemperature: 0.2,
    defaultMaxTokens: 8192,
  },
  {
    id: "codellama:70b",
    displayName: "Code LLaMA 70B",
    type: "code",
    description: "Stable, predictable, enterprise-grade code generation.",
    defaultTemperature: 0.2,
    defaultMaxTokens: 4096,
  },
  {
    id: "starcoder2",
    displayName: "StarCoder2",
    type: "code",
    description: "Multi-language repos, fill-in-the-middle, large codebase understanding.",
    defaultTemperature: 0.2,
    defaultMaxTokens: 4096,
  },
  {
    id: "codellama",
    displayName: "Code LLaMA 7B",
    type: "code",
    description: "Fast code model for lightweight tasks.",
    defaultTemperature: 0.2,
    defaultMaxTokens: 4096,
  },

  // ── Vision / Multimodal ─────────────────────────────────────
  {
    id: "llava:v1.6",
    displayName: "LLaVA 1.6",
    type: "vision",
    description: "Best open-source vision-language model. Image understanding, UI analysis, diagram interpretation.",
    defaultTemperature: 0.3,
    defaultMaxTokens: 2048,
  },
  {
    id: "qwen2-vl",
    displayName: "Qwen-VL",
    type: "vision",
    description: "Strong OCR and document reading. Best for text extraction from images.",
    defaultTemperature: 0.3,
    defaultMaxTokens: 2048,
  },
  {
    id: "moondream",
    displayName: "Moondream 2",
    type: "vision",
    description: "Extremely fast lightweight vision model. Real-time mobile/edge vision tasks.",
    defaultTemperature: 0.3,
    defaultMaxTokens: 1024,
  },
  {
    id: "llava",
    displayName: "LLaVA",
    type: "vision",
    description: "LLaVA base — classic vision-language assistant.",
    defaultTemperature: 0.3,
    defaultMaxTokens: 2048,
  },

  // ── Image Generation ────────────────────────────────────────
  {
    id: "flux",
    displayName: "Flux 1.1 Dev",
    type: "image-gen",
    description: "Best open-source image generator. Requires FAL_API_KEY.",
    defaultTemperature: 0,
    defaultMaxTokens: 0,
  },
  {
    id: "flux-schnell",
    displayName: "Flux Schnell",
    type: "image-gen",
    description: "Flux fast 4-step distilled variant. Requires FAL_API_KEY.",
    defaultTemperature: 0,
    defaultMaxTokens: 0,
  },
  {
    id: "sdxl",
    displayName: "SDXL 1.0",
    type: "image-gen",
    description: "Stable Diffusion XL — stable and customizable. Requires COMFYUI_URL or SD_URL.",
    defaultTemperature: 0,
    defaultMaxTokens: 0,
  },
  {
    id: "sd3",
    displayName: "Stable Diffusion 3",
    type: "image-gen",
    description: "Best photorealism. Requires COMFYUI_URL or SD_URL.",
    defaultTemperature: 0,
    defaultMaxTokens: 0,
  },

  // ── Small / Fast (Edge / Mobile) ────────────────────────────
  {
    id: "phi3:mini",
    displayName: "Phi-3 Mini",
    type: "fast",
    description: "Best tiny model. Fast mode, offline mode, lightweight agents, mobile.",
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
  },
  {
    id: "gemma2:9b",
    displayName: "Gemma 2 9B",
    type: "fast",
    description: "Google Gemma 2 9B — high quality in small size. Low-power servers.",
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
  },
  {
    id: "mistral",
    displayName: "Mistral 7B",
    type: "fast",
    description: "Fast and reliable fallback model.",
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
  },
  {
    id: "mixtral",
    displayName: "Mixtral 8x7B",
    type: "fast",
    description: "MoE 8×7B — high capability with efficient inference.",
    defaultTemperature: 0.7,
    defaultMaxTokens: 4096,
  },

  // ── Embeddings ──────────────────────────────────────────────
  {
    id: "nomic-embed-text",
    displayName: "Nomic Embed Text",
    type: "embed",
    description: "Default RAG embedding model.",
    defaultTemperature: 0,
    defaultMaxTokens: 512,
  },
  {
    id: "mxbai-embed-large",
    displayName: "MxBAI Embed Large",
    type: "embed",
    description: "High-quality retrieval embeddings.",
    defaultTemperature: 0,
    defaultMaxTokens: 512,
  },
];

/**
 * Routing map — preferred model per mode.
 * Falls back to config/routing.yaml when available.
 */
const DEFAULT_ROUTING: Record<string, string> = {
  chat:         "llama3.1:70b",
  reasoning:    "deepseek-r1",
  agent:        "deepseek-r1",
  code:         "deepseek-coder-v2",
  vision:       "llava:v1.6",
  ocr:          "qwen2-vl",
  fast:         "phi3:mini",
  multilingual: "qwen2.5:72b",
  "image-gen":  "flux",
  embed:        "nomic-embed-text",
};

/**
 * Route to the best model for a given mode.
 * Priority: explicit model > config routing > default routing > first match > fallback
 */
export function routeModel(mode: ChatMode | string, explicitModel?: string | null): ModelDefinition {
  // 1. Explicit model override
  if (explicitModel) {
    const found = MODEL_REGISTRY.find((m) => m.id === explicitModel);
    if (found) return found;
  }

  // 2. Config-driven routing
  let targetId: string | undefined;
  try {
    const routingConfig = getRoutingConfig();
    // Check routing rules by mode condition
    const rule = routingConfig.rules
      .filter((r) => r.condition?.["mode"] === mode)
      .sort((a, b) => b.priority - a.priority)[0];
    if (rule) targetId = rule.target;
    // Fallback from config
    if (!targetId) targetId = routingConfig.fallback;
  } catch {
    // Config not loaded yet, use defaults
  }

  // 3. Default routing table
  if (!targetId) targetId = DEFAULT_ROUTING[mode] ?? DEFAULT_ROUTING["chat"]!;

  const found = MODEL_REGISTRY.find((m) => m.id === targetId);
  if (found) return found;

  // 4. Find first model of matching type
  const typeMap: Record<string, ModelType> = {
    chat: "reasoning", reasoning: "reasoning", agent: "reasoning",
    code: "code", vision: "vision", ocr: "vision",
    fast: "fast", "image-gen": "image-gen", embed: "embed",
    multilingual: "reasoning",
  };
  const preferredType = typeMap[mode] as ModelType | undefined;
  if (preferredType) {
    const byType = MODEL_REGISTRY.find((m) => m.type === preferredType);
    if (byType) return byType;
  }

  return MODEL_REGISTRY[0]!;
}

export function getModelById(id: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export const EMBED_MODEL = "nomic-embed-text";
export const FAST_MODEL  = "phi3:mini";
export const CHAT_MODEL  = "llama3.1:70b";
export const CODE_MODEL  = "deepseek-coder-v2";
export const VISION_MODEL = "llava:v1.6";
