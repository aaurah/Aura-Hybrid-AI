import { Router } from "express";
import {
  visionRead, generateImage, upscaleImage, imageVariation, inpaintImage,
  type VisionReadMode, type ImageGenModel,
} from "../../lib/vision";
import { logger } from "../../lib/logger";

const router = Router();

/**
 * POST /internal/vision/read
 * Full internal vision read — direct LLaVA access, no auth overhead.
 */
router.post("/vision/read", async (req, res) => {
  try {
    const {
      imageBase64, imageUrl, image, prompt, mode = "analysis",
      model, temperature, maxTokens,
    } = req.body as {
      imageBase64?: string; imageUrl?: string; image?: string;
      prompt?: string; mode?: VisionReadMode; model?: string;
      temperature?: number; maxTokens?: number;
    };

    const result = await visionRead({
      imageBase64: image ?? imageBase64,
      imageUrl, prompt, mode, model, temperature, maxTokens,
    });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Internal vision read error");
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /internal/vision/generate
 * Full image generation — sdxl | flux | flux-schnell | sdxl-turbo | custom
 */
router.post("/vision/generate", async (req, res) => {
  try {
    const {
      prompt, negativePrompt, width, height, steps, model, seed, cfgScale,
    } = req.body as {
      prompt: string; negativePrompt?: string; width?: number; height?: number;
      steps?: number; model?: ImageGenModel; seed?: number; cfgScale?: number;
    };

    if (!prompt) { res.status(400).json({ error: "prompt is required" }); return; }
    const result = await generateImage({ prompt, negativePrompt, width, height, steps, model, seed, cfgScale });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Internal image gen error");
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /internal/vision/upscale
 * Upscale an image 2× or 4× via Real-ESRGAN (requires SD_URL).
 */
router.post("/vision/upscale", async (req, res) => {
  try {
    const { imageBase64, imageUrl, scale = 2 } = req.body as {
      imageBase64?: string; imageUrl?: string; scale?: 2 | 4;
    };
    if (!imageBase64 && !imageUrl) { res.status(400).json({ error: "imageBase64 or imageUrl required" }); return; }
    const result = await upscaleImage({ imageBase64, imageUrl, scale });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Upscale error");
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /internal/vision/variation
 * Generate a variation of an existing image (img2img).
 */
router.post("/vision/variation", async (req, res) => {
  try {
    const { imageBase64, imageUrl, prompt, strength, model } = req.body as {
      imageBase64?: string; imageUrl?: string; prompt?: string;
      strength?: number; model?: ImageGenModel;
    };
    if (!imageBase64 && !imageUrl) { res.status(400).json({ error: "imageBase64 or imageUrl required" }); return; }
    const result = await imageVariation({ imageBase64, imageUrl, prompt, strength, model });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Variation error");
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /internal/vision/inpaint
 * Fill a masked region with AI-generated content.
 */
router.post("/vision/inpaint", async (req, res) => {
  try {
    const { imageBase64, imageUrl, maskBase64, prompt, negativePrompt, model } = req.body as {
      imageBase64?: string; imageUrl?: string; maskBase64?: string;
      prompt: string; negativePrompt?: string; model?: ImageGenModel;
    };
    if (!imageBase64 && !imageUrl) { res.status(400).json({ error: "imageBase64 or imageUrl required" }); return; }
    if (!prompt) { res.status(400).json({ error: "prompt is required" }); return; }
    const result = await inpaintImage({ imageBase64, imageUrl, maskBase64, prompt, negativePrompt, model });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Inpaint error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
