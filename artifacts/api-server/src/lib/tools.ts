import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export type ToolType = "http" | "shell" | "git";

export interface ToolDefinition {
  name: string;
  description: string;
  type: ToolType;
  inputSchema: Record<string, unknown>;
}

export interface ToolResult {
  tool: string;
  success: boolean;
  output: string;
  error: string | null;
  durationMs: number;
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: "http_fetch",
    description: "Make an HTTP GET or POST request to any URL and return the response body.",
    type: "http",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"], default: "GET" },
        headers: { type: "object", description: "Request headers" },
        body: { type: "string", description: "Request body (for POST/PUT)" },
      },
      required: ["url"],
    },
  },
  {
    name: "shell_exec",
    description: "Execute a restricted, read-only shell command (ls, cat, grep, echo, pwd, env, date, whoami).",
    type: "shell",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to run (restricted to safe read-only commands)" },
      },
      required: ["command"],
    },
  },
  {
    name: "git_status",
    description: "Get the git status of the current repository.",
    type: "git",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repository path (default: current directory)" },
      },
    },
  },
  {
    name: "git_diff",
    description: "Get the git diff for staged or unstaged changes.",
    type: "git",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repository path" },
        staged: { type: "boolean", description: "Show staged diff (default: false)" },
      },
    },
  },
  {
    name: "git_log",
    description: "Get recent git commit history.",
    type: "git",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repository path" },
        limit: { type: "integer", description: "Number of commits to show (default: 10)" },
      },
    },
  },
];

const ALLOWED_SHELL_COMMANDS = new Set([
  "ls", "cat", "grep", "echo", "pwd", "env", "date", "whoami", "find",
  "head", "tail", "wc", "sort", "uniq", "cut", "awk", "sed",
]);

function isSafeShellCommand(command: string): boolean {
  const base = command.trim().split(/\s+/)[0] ?? "";
  return ALLOWED_SHELL_COMMANDS.has(base);
}

export async function runTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const start = Date.now();

  const tool = TOOL_REGISTRY.find((t) => t.name === toolName);
  if (!tool) {
    return {
      tool: toolName,
      success: false,
      output: "",
      error: `Unknown tool: ${toolName}`,
      durationMs: Date.now() - start,
    };
  }

  try {
    let output = "";

    if (toolName === "http_fetch") {
      const url = String(input["url"] ?? "");
      const method = String(input["method"] ?? "GET");
      const headers = (input["headers"] as Record<string, string>) ?? {};
      const body = input["body"] ? String(input["body"]) : undefined;

      const resp = await fetch(url, { method, headers, body });
      const text = await resp.text();
      output = `HTTP ${resp.status} ${resp.statusText}\n\n${text.slice(0, 4000)}`;
    } else if (toolName === "shell_exec") {
      const command = String(input["command"] ?? "");
      if (!isSafeShellCommand(command)) {
        return {
          tool: toolName,
          success: false,
          output: "",
          error: `Restricted: only read-only commands allowed (${[...ALLOWED_SHELL_COMMANDS].join(", ")})`,
          durationMs: Date.now() - start,
        };
      }
      const { stdout, stderr } = await execAsync(command, { timeout: 5000 });
      output = stdout || stderr;
    } else if (toolName === "git_status") {
      const path = String(input["path"] ?? ".");
      const { stdout } = await execAsync(`git -C ${path} status`, { timeout: 5000 });
      output = stdout;
    } else if (toolName === "git_diff") {
      const path = String(input["path"] ?? ".");
      const staged = Boolean(input["staged"]);
      const flag = staged ? "--staged" : "";
      const { stdout } = await execAsync(`git -C ${path} diff ${flag}`, { timeout: 5000 });
      output = stdout.slice(0, 8000);
    } else if (toolName === "git_log") {
      const path = String(input["path"] ?? ".");
      const limit = Number(input["limit"] ?? 10);
      const { stdout } = await execAsync(
        `git -C ${path} log --oneline -${limit}`,
        { timeout: 5000 }
      );
      output = stdout;
    }

    return { tool: toolName, success: true, output, error: null, durationMs: Date.now() - start };
  } catch (err) {
    return {
      tool: toolName,
      success: false,
      output: "",
      error: String(err),
      durationMs: Date.now() - start,
    };
  }
}
