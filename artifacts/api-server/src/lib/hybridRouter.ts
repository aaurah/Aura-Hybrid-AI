/**
 * AuraAI Hybrid Router
 * Analyzes message content and context to automatically select the best model.
 * No manual mode selection required — the right specialist activates itself.
 */

import { routeModel, MODEL_REGISTRY, type ModelDefinition, type ChatMode } from "./models";

export type HybridCategory =
  | "reasoning"
  | "code"
  | "vision"
  | "ocr"
  | "image-gen"
  | "fast"
  | "multilingual"
  | "chat";

export interface HybridDecision {
  model: ModelDefinition;
  category: HybridCategory;
  confidence: number;
  reason: string;
  pipeline: string[];
}

// ─── Detection patterns ───────────────────────────────────────────────────────

const CODE_KEYWORDS = [
  /```[\s\S]*/,
  /\b(function|class|import|export|const|let|var|def |async |await |return |throw |interface|struct|enum)\b/,
  /\b(debug|refactor|implement|compile|syntax error|stack trace|TypeError|undefined is not|null pointer)\b/i,
  /\.(py|js|ts|jsx|tsx|go|rs|java|cpp|c|cs|php|rb|swift|kt|sh|yaml|json|toml|sql)\b/i,
  /\b(git|npm|pip|cargo|docker|kubernetes|deploy|ci\/cd|devops|bash|terminal)\b/i,
  /\b(algorithm|big.?o|recursion|loop|array|hash.?map|linked.?list|binary.?tree)\b/i,
];

const REASONING_KEYWORDS = [
  /\b(why|analyze|analyse|reason|reasoning|explain how|compare|contrast|evaluate|critique)\b/i,
  /\b(pros and cons|trade.?off|should I|what if|hypothesis|theorem|prove|logical|deduce|infer)\b/i,
  /\b(strategy|philosophy|ethics|moral|argument|debate|implication|consequence|causality)\b/i,
  /\b(plan|planning|architecture|design pattern|system design|decision|prioritize)\b/i,
];

const MULTILINGUAL_KEYWORDS = [
  /\b(translate|translation|en français|in spanish|auf deutsch|в переводе|по-русски|中文|日本語|한국어|عربي)\b/i,
  /[\u0400-\u04FF]{5,}/,   // Cyrillic block
  /[\u4E00-\u9FFF]{3,}/,   // CJK block
  /[\u0600-\u06FF]{5,}/,   // Arabic block
  /[\u3040-\u30FF]{3,}/,   // Japanese kana
  /[\uAC00-\uD7A3]{3,}/,   // Korean hangul
];

const VISION_KEYWORDS = [
  /\b(image|photo|picture|screenshot|diagram|chart|graph|figure|drawing|illustration)\b/i,
  /\b(look at|read this|what('s| is) in|describe|analyze this image|identify|ocr|extract text)\b/i,
];

const OCR_KEYWORDS = [
  /\b(ocr|extract text|read text|text in image|handwriting|document scan|invoice|receipt|label)\b/i,
];

const IMAGE_GEN_KEYWORDS = [
  /\b(generate|create|draw|make|paint|render|illustrate|visualize)\b.{0,40}\b(image|picture|photo|art|artwork|illustration|icon|logo|banner|poster)\b/i,
  /\b(image of|picture of|photo of|painting of|illustration of)\b/i,
  /\b(flux|stable diffusion|sdxl|midjourney.?style|dall.?e.?style)\b/i,
];

const FAST_PATTERNS = [
  /^.{0,25}$/,                                      // very short messages
  /^(hi|hello|hey|yo|thanks|thank you|ok|okay|yes|no|sure|bye|good morning|good night)[.!?]?$/i,
  /^(what('s| is) (the time|today|your name|2\+2))[?]?$/i,
];

// ─── Scorer ───────────────────────────────────────────────────────────────────

interface Score { category: HybridCategory; score: number; reason: string }

function scoreMessage(message: string, hasImage: boolean): Score[] {
  const scores: Score[] = [];

  // Vision / OCR (image attached overrides everything)
  if (hasImage) {
    const isOcr = OCR_KEYWORDS.some((p) => p.test(message));
    scores.push({
      category: isOcr ? "ocr" : "vision",
      score: 100,
      reason: isOcr ? "image attached — OCR/text extraction mode" : "image attached — vision understanding mode",
    });
    return scores;
  }

  // Image generation
  const imageGenMatches = IMAGE_GEN_KEYWORDS.filter((p) => p.test(message)).length;
  if (imageGenMatches > 0) {
    scores.push({ category: "image-gen", score: 60 + imageGenMatches * 15, reason: "image generation request detected" });
  }

  // Vision keywords (no image attached — will still try vision model)
  const visionMatches = VISION_KEYWORDS.filter((p) => p.test(message)).length;
  if (visionMatches > 0) {
    scores.push({ category: "vision", score: 50 + visionMatches * 10, reason: "vision/visual analysis keywords detected" });
  }

  // OCR keywords
  const ocrMatches = OCR_KEYWORDS.filter((p) => p.test(message)).length;
  if (ocrMatches > 0) {
    scores.push({ category: "ocr", score: 55 + ocrMatches * 10, reason: "OCR/text extraction keywords detected" });
  }

  // Coding
  const codeMatches = CODE_KEYWORDS.filter((p) => p.test(message)).length;
  if (codeMatches > 0) {
    scores.push({ category: "code", score: 40 + codeMatches * 12, reason: `code keywords matched (${codeMatches} signals)` });
  }

  // Reasoning
  const reasoningMatches = REASONING_KEYWORDS.filter((p) => p.test(message)).length;
  if (reasoningMatches > 0) {
    scores.push({ category: "reasoning", score: 35 + reasoningMatches * 12, reason: `deep reasoning keywords matched (${reasoningMatches} signals)` });
  }

  // Multilingual
  const mlMatches = MULTILINGUAL_KEYWORDS.filter((p) => p.test(message)).length;
  if (mlMatches > 0) {
    scores.push({ category: "multilingual", score: 50 + mlMatches * 15, reason: "multilingual content or translation request detected" });
  }

  // Fast / trivial
  const isFast = FAST_PATTERNS.some((p) => p.test(message.trim()));
  if (isFast) {
    scores.push({ category: "fast", score: 45, reason: "short/trivial message — fast model appropriate" });
  }

  return scores;
}

// ─── Main routing function ────────────────────────────────────────────────────

/**
 * Decide which model to use for a message.
 * Falls back to LLaMA 3.1 70B (primary brain) when nothing specific fires.
 */
export function hybridRoute(
  message: string,
  opts: {
    explicitModel?: string | null;
    explicitMode?: string | null;
    hasImage?: boolean;
  } = {}
): HybridDecision {
  const { explicitModel, explicitMode, hasImage = false } = opts;

  // ── 1. Explicit override always wins ──
  if (explicitModel) {
    const found = MODEL_REGISTRY.find((m) => m.id === explicitModel);
    if (found) {
      return {
        model: found,
        category: (found.type as HybridCategory) ?? "chat",
        confidence: 100,
        reason: `explicit model override: ${explicitModel}`,
        pipeline: [found.id],
      };
    }
  }

  // ── 2. Explicit mode override ──
  if (explicitMode && explicitMode !== "chat") {
    const model = routeModel(explicitMode as ChatMode);
    return {
      model,
      category: explicitMode as HybridCategory,
      confidence: 95,
      reason: `explicit mode: ${explicitMode}`,
      pipeline: [model.id],
    };
  }

  // ── 3. Auto-detect ──
  const scores = scoreMessage(message, hasImage);

  if (scores.length === 0) {
    const model = routeModel("chat");
    return {
      model,
      category: "chat",
      confidence: 60,
      reason: "general conversation — primary brain (LLaMA 3.1 70B)",
      pipeline: [model.id],
    };
  }

  // Pick highest score
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0]!;
  const model = routeModel(best.category as ChatMode);

  // Build pipeline — for vision tasks, chain: vision model → reasoning model
  const pipeline: string[] = [model.id];
  if (best.category === "vision" || best.category === "ocr") {
    const reasoningModel = routeModel("chat");
    if (reasoningModel.id !== model.id) pipeline.push(reasoningModel.id);
  }

  return {
    model,
    category: best.category,
    confidence: Math.min(best.score, 99),
    reason: best.reason,
    pipeline,
  };
}

/**
 * Build a system prompt enriched for the detected category.
 */
export function buildHybridSystemPrompt(
  category: HybridCategory,
  basePrompt?: string | null
): string {
  const base = basePrompt?.trim() || "You are AuraAI, a helpful AI assistant.";

  const enrichments: Record<HybridCategory, string> = {
    reasoning:
      "\n\nYou are operating in REASONING MODE. Think step by step. Show your chain of thought. " +
      "Break complex problems into sub-problems. Verify your logic before concluding.",
    code:
      "\n\nYou are operating in CODING MODE. Write clean, correct, well-commented code. " +
      "Explain what the code does. Prefer working examples over pseudocode. " +
      "Always specify the language. Highlight any edge cases.",
    vision:
      "\n\nYou are operating in VISION MODE. Describe what you see in detail. " +
      "Note objects, text, layout, colors, and relationships between elements.",
    ocr:
      "\n\nYou are operating in OCR MODE. Extract all visible text accurately. " +
      "Preserve formatting where possible. Flag any uncertain characters.",
    "image-gen":
      "\n\nYou are operating in IMAGE GENERATION MODE. " +
      "If you cannot generate an image directly, describe the optimal prompt to use.",
    fast:
      "\n\nBe concise and direct. Short clear answer.",
    multilingual:
      "\n\nYou are operating in MULTILINGUAL MODE. " +
      "Respond in the same language the user is writing in unless asked to translate.",
    chat:
      "\n\nYou are a knowledgeable, thoughtful assistant. " +
      "Be helpful, accurate, and clear.",
  };

  return base + (enrichments[category] ?? "");
}

/**
 * Human-readable label for a category
 */
export const CATEGORY_LABELS: Record<HybridCategory, string> = {
  reasoning:    "DeepSeek R1 · Reasoning",
  code:         "DeepSeek Coder · Code",
  vision:       "LLaVA 1.6 · Vision",
  ocr:          "Qwen-VL · OCR",
  "image-gen":  "Flux 1.1 · Image Gen",
  fast:         "Phi-3 Mini · Fast",
  multilingual: "Qwen 2.5 · Multilingual",
  chat:         "LLaMA 3.1 70B · Chat",
};
