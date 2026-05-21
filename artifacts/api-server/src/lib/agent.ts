import { ollamaChat } from "./ollama";
import { routeModel } from "./models";
import { runTool, TOOL_REGISTRY } from "./tools";
import { getAgentConfig } from "./config";
import { logger } from "./logger";

export type AgentMode = "chat" | "code" | "vision";

export interface AgentMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string;
}

export interface AgentStep {
  stepIndex: number;
  type: "thinking" | "tool_call" | "tool_result" | "final";
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  success?: boolean;
}

export interface AgentRunResult {
  finalAnswer: string;
  steps: AgentStep[];
  totalSteps: number;
  model: string;
}

const TOOL_CALL_REGEX = /<tool_call>([\s\S]*?)<\/tool_call>/;

function extractToolCall(
  text: string
): { tool: string; input: Record<string, unknown> } | null {
  const match = TOOL_CALL_REGEX.exec(text);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1].trim()) as { tool: string; input: Record<string, unknown> };
  } catch {
    return null;
  }
}

function stripToolCall(text: string): string {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim();
}

export async function runAgentStep(params: {
  message: string;
  history: AgentMessage[];
  mode?: AgentMode;
  model?: string | null;
  systemPrompt?: string;
  availableTools?: string[];
  temperature?: number;
}): Promise<{ response: string; toolCall?: { tool: string; input: Record<string, unknown> } }> {
  const config = getAgentConfig();
  const modelDef = routeModel(params.mode ?? "chat", params.model);

  const enabledToolNames = params.availableTools ?? TOOL_REGISTRY.map((t) => t.name);
  const enabledTools = TOOL_REGISTRY.filter((t) => enabledToolNames.includes(t.name));
  const toolDescriptions = enabledTools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  const systemContent =
    params.systemPrompt ??
    config.systemPrompt +
      (enabledTools.length > 0
        ? `\n\nAvailable tools:\n${toolDescriptions}`
        : "");

  const messages = [
    { role: "system" as const, content: systemContent },
    ...params.history.map((m) => ({
      role: (m.role === "tool" ? "user" : m.role) as "user" | "assistant" | "system",
      content: m.role === "tool" ? `[Tool result from ${m.toolName}]: ${m.content}` : m.content,
    })),
    { role: "user" as const, content: params.message },
  ];

  const resp = await ollamaChat({
    model: modelDef.id,
    messages,
    options: {
      temperature: params.temperature ?? modelDef.defaultTemperature,
      num_predict: config.maxTokensPerStep,
    },
  });

  const content = resp.message.content;
  const toolCall = extractToolCall(content);

  return { response: content, toolCall: toolCall ?? undefined };
}

export async function runAgentLoop(params: {
  message: string;
  mode?: AgentMode;
  model?: string | null;
  systemPrompt?: string;
  availableTools?: string[];
  temperature?: number;
  onStep?: (step: AgentStep) => void;
}): Promise<AgentRunResult> {
  const config = getAgentConfig();
  const modelDef = routeModel(params.mode ?? "chat", params.model);
  const steps: AgentStep[] = [];
  const history: AgentMessage[] = [];
  let currentMessage = params.message;
  let stepIndex = 0;
  let finalAnswer = "";

  while (stepIndex < config.maxSteps) {
    const { response, toolCall } = await runAgentStep({
      message: currentMessage,
      history,
      mode: params.mode,
      model: params.model,
      systemPrompt: params.systemPrompt,
      availableTools: params.availableTools,
      temperature: params.temperature,
    });

    if (toolCall) {
      const thinkingContent = stripToolCall(response);
      if (thinkingContent) {
        const thinkStep: AgentStep = {
          stepIndex,
          type: "thinking",
          content: thinkingContent,
        };
        steps.push(thinkStep);
        params.onStep?.(thinkStep);
      }

      const callStep: AgentStep = {
        stepIndex,
        type: "tool_call",
        content: `Calling tool: ${toolCall.tool}`,
        toolName: toolCall.tool,
        toolInput: toolCall.input,
      };
      steps.push(callStep);
      params.onStep?.(callStep);

      logger.info({ tool: toolCall.tool, input: toolCall.input }, "Agent tool call");
      const toolResult = await runTool(toolCall.tool, toolCall.input);

      const resultStep: AgentStep = {
        stepIndex,
        type: "tool_result",
        content: toolResult.output || toolResult.error || "No output",
        toolName: toolCall.tool,
        toolOutput: toolResult.output,
        success: toolResult.success,
      };
      steps.push(resultStep);
      params.onStep?.(resultStep);

      history.push({ role: "assistant", content: response });
      history.push({
        role: "tool",
        content: toolResult.success ? toolResult.output : `Error: ${toolResult.error}`,
        toolName: toolCall.tool,
      });

      currentMessage = "Continue based on the tool result above.";
    } else {
      finalAnswer = stripToolCall(response) || response;
      const finalStep: AgentStep = {
        stepIndex,
        type: "final",
        content: finalAnswer,
      };
      steps.push(finalStep);
      params.onStep?.(finalStep);
      break;
    }

    stepIndex++;
  }

  if (!finalAnswer && steps.length > 0) {
    finalAnswer = steps[steps.length - 1]?.content ?? "";
  }

  return {
    finalAnswer,
    steps,
    totalSteps: stepIndex,
    model: modelDef.id,
  };
}
