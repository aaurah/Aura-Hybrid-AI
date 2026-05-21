import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export interface ModelConfig {
  id: string;
  displayName: string;
  type: "chat" | "code" | "vision" | "embed";
  defaultTemperature: number;
  defaultMaxTokens: number;
  description: string;
}

export interface ToolConfig {
  name: string;
  type: string;
  tier: "external" | "internal";
  description: string;
  allowedCommands?: string[];
  allowedMethods?: string[];
  timeout?: number;
  maxResponseBytes?: number;
  readOnly?: boolean;
}

export interface AppConfig {
  models: {
    models: ModelConfig[];
    routing: Record<string, string>;
  };
  tools: {
    tools: ToolConfig[];
    routing: { maxToolCallsPerTurn: number; allowParallelCalls: boolean };
  };
  routing: {
    routing: {
      rules: Array<{
        name: string;
        condition: Record<string, unknown>;
        target: string;
        priority: number;
      }>;
      fallback: string;
      embedModel: string;
    };
    agent: {
      maxSteps: number;
      maxTokensPerStep: number;
      toolCallFormat: string;
      systemPrompt: string;
    };
    memory: {
      maxChunksPerQuery: number;
      chunkSize: number;
      chunkOverlap: number;
      similarityThreshold: number;
    };
    security: {
      jwtExpiresIn: string;
      apiKeyPrefix: string;
      internalNetworkCidrs: string[];
      rateLimits: Record<string, { windowMs: number; max: number }>;
    };
  };
}

const CONFIG_DIR = path.resolve(process.cwd(), "config");

function loadYaml<T>(filename: string): T {
  const filePath = path.join(CONFIG_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }
  return yaml.load(fs.readFileSync(filePath, "utf8")) as T;
}

let _config: AppConfig | null = null;

export function loadConfig(): AppConfig {
  _config = {
    models: loadYaml("models.yaml"),
    tools: loadYaml("tools.yaml"),
    routing: loadYaml("routing.yaml"),
  };
  return _config;
}

export function getConfig(): AppConfig {
  if (!_config) return loadConfig();
  return _config;
}

export function reloadConfig(): AppConfig {
  _config = null;
  return loadConfig();
}

export function getModelRegistry(): ModelConfig[] {
  return getConfig().models.models;
}

export function getRoutingConfig() {
  return getConfig().routing.routing;
}

export function getAgentConfig() {
  return getConfig().routing.agent;
}

export function getMemoryConfig() {
  return getConfig().routing.memory;
}

export function getSecurityConfig() {
  return getConfig().routing.security;
}

export function getToolsConfig(): ToolConfig[] {
  return getConfig().tools.tools;
}
