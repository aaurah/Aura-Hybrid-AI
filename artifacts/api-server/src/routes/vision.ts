import { Router } from "express";
import { visionRead, generateImage, type VisionReadMode, type ImageGenModel } from "../lib/vision";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /v1/vision/read
 * Understand/describe an image using LLaVA.
 * mode: "caption" | "ocr" | "analysis"
 */
router.post("/v1/vision/read", async (req, res) => {
  try {
    const {
      image,
      imageBase64,
      imageUrl,
      prompt,
      mode = "analysis",
      model,
      temperature,
      maxTokens,
    } = req.body as {
      image?: string;
      imageBase64?: string;
      imageUrl?: string;
      prompt?: string;
      mode?: VisionReadMode;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };

    const validModes: VisionReadMode[] = ["caption", "ocr", "analysis"];
    if (!validModes.includes(mode)) {
      res.status(400).json({ error: `mode must be one of: ${validModes.join(", ")}` });
      return;
    }

    const resolvedBase64 = image ?? imageBase64;

    if (!resolvedBase64 && !imageUrl) {
      res.status(400).json({ error: "image (base64), imageBase64, or imageUrl is required" });
      return;
    }

    const result = await visionRead({
      imageBase64: resolvedBase64,
      imageUrl,
      prompt,
      mode,
      model,
      temperature,
      maxTokens,
    });

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Vision read error");
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /v1/vision/generate
 * Generate an image from a text prompt.
 * Supports: sdxl | flux | flux-schnell | sdxl-turbo | custom
 */
router.post("/v1/vision/generate", async (req, res) => {
  try {
    const {
      prompt,
      negativePrompt,
      width,
      height,
      steps,
      model = "sdxl",
      seed,
      cfgScale,
    } = req.body as {
      prompt: string;
      negativePrompt?: string;
      width?: number;
      height?: number;
      steps?: number;
      model?: ImageGenModel;
      seed?: number;
      cfgScale?: number;
    };

    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const result = await generateImage({
      prompt,
      negativePrompt,
      width,
      height,
      steps,
      model,
      seed,
      cfgScale,
    });

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Image generation error");
    res.status(500).json({ error: String(err) });
  }
});

/**
 * Legacy: POST /v1/vision (backwards-compat — maps to read/analysis)
 */
router.post("/v1/vision", async (req, res) => {
  try {
    const { prompt, imageBase64, imageUrl, model, temperature, maxTokens } = req.body as {
      prompt: string;
      imageBase64?: string;
      imageUrl?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };

    if (!prompt) { res.status(400).json({ error: "prompt is required" }); return; }
    if (!imageBase64 && !imageUrl) { res.status(400).json({ error: "imageBase64 or imageUrl is required" }); return; }

    const result = await visionRead({ imageBase64, imageUrl, prompt, mode: "analysis", model, temperature, maxTokens });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Vision legacy error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
