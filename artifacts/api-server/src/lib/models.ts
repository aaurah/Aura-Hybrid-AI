export type ModelType = "chat" | "code" | "vision";
export type ChatMode = "chat" | "code" | "vision";

export interface ModelDefinition {
  id: string;
  displayName: string;
  type: ModelType;
  description: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
}

export const MODEL_REGISTRY: ModelDefinition[] = [
  {
    id: "llama3",
    displayName: "LLaMA 3",
    type: "chat",
    description: "Meta's LLaMA 3 — general purpose chat model, fast and capable.",
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
  },
  {
    id: "llama3:instruct",
    displayName: "LLaMA 3 Instruct",
    type: "chat",
    description: "LLaMA 3 fine-tuned for instruction following.",
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
  },
  {
    id: "codellama",
    displayName: "Code LLaMA",
    type: "code",
    description: "Meta's Code LLaMA — optimized for code generation and completion.",
    defaultTemperature: 0.2,
    defaultMaxTokens: 4096,
  },
  {
    id: "codellama:instruct",
    displayName: "Code LLaMA Instruct",
    type: "code",
    description: "Code LLaMA fine-tuned for code instructions and review.",
    defaultTemperature: 0.2,
    defaultMaxTokens: 4096,
  },
  {
    id: "llava",
    displayName: "LLaVA",
    type: "vision",
    description: "Large Language and Vision Assistant — multimodal image + text model.",
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
  },
  {
    id: "mistral",
    displayName: "Mistral 7B",
    type: "chat",
    description: "Mistral AI's 7B model — excellent reasoning in a compact size.",
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
  },
  {
    id: "mixtral",
    displayName: "Mixtral 8x7B",
    type: "chat",
    description: "Mistral's MoE model — high capability with efficient inference.",
    defaultTemperature: 0.7,
    defaultMaxTokens: 4096,
  },
  {
    id: "nomic-embed-text",
    displayName: "Nomic Embed Text",
    type: "chat",
    description: "Embedding model optimized for text similarity and RAG.",
    defaultTemperature: 0,
    defaultMaxTokens: 512,
  },
];

export function routeModel(mode: ChatMode, explicitModel?: string | null): ModelDefinition {
  if (explicitModel) {
    const found = MODEL_REGISTRY.find((m) => m.id === explicitModel);
    if (found) return found;
  }
  const modeMap: Record<ChatMode, ModelType> = {
    chat: "chat",
    code: "code",
    vision: "vision",
  };
  const preferredType = modeMap[mode];
  return MODEL_REGISTRY.find((m) => m.type === preferredType) ?? MODEL_REGISTRY[0]!;
}

export function getModelById(id: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export const EMBED_MODEL = "nomic-embed-text";
