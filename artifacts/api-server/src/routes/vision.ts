import { Router } from "express";
import { ollamaChat } from "../lib/ollama";
import { routeModel } from "../lib/models";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /v1/vision
 * Body: { prompt: string, imageBase64?: string, imageUrl?: string, model?: string }
 *
 * LLaVA accepts images as base64 or URL in the message content.
 * Ollama's chat API supports images in messages via the `images` field.
 */
router.post("/v1/vision", async (req, res) => {
  try {
    const {
      prompt,
      imageBase64,
      imageUrl,
      model: explicitModel,
      systemPrompt,
      temperature,
      maxTokens,
    } = req.body as {
      prompt: string;
      imageBase64?: string;
      imageUrl?: string;
      model?: string;
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    };

    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }
    if (!imageBase64 && !imageUrl) {
      res.status(400).json({ error: "imageBase64 or imageUrl is required" });
      return;
    }

    const modelDef = routeModel("vision", explicitModel);
    const start = Date.now();

    // Build the Ollama request with vision content
    // Ollama supports images[] in messages for LLaVA
    const messages: Array<{
      role: "user" | "assistant" | "system";
      content: string;
      images?: string[];
    }> = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    const userMessage: {
      role: "user";
      content: string;
      images?: string[];
    } = {
      role: "user",
      content: prompt,
    };

    if (imageBase64) {
      // Strip data URI prefix if present
      const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      userMessage.images = [base64];
    } else if (imageUrl) {
      // Fetch image and convert to base64
      const resp = await fetch(imageUrl);
      const buffer = await resp.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      userMessage.images = [base64];
    }

    messages.push(userMessage);

    // Use raw Ollama API to support `images` field
    const OLLAMA_BASE_URL = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434";
    const ollamaResp = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelDef.id,
        messages,
        stream: false,
        options: {
          temperature: temperature ?? modelDef.defaultTemperature,
          num_predict: maxTokens ?? modelDef.defaultMaxTokens,
        },
      }),
    });

    if (!ollamaResp.ok) {
      const errText = await ollamaResp.text();
      res.status(502).json({ error: `Ollama error: ${errText}` });
      return;
    }

    const data = await ollamaResp.json() as {
      model: string;
      message: { role: string; content: string };
      eval_count?: number;
    };

    const latencyMs = Date.now() - start;

    res.json({
      content: data.message.content,
      model: data.model,
      tokensUsed: data.eval_count ?? null,
      latencyMs,
    });
  } catch (err) {
    logger.error({ err }, "Vision error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
