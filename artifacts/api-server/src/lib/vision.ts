import { logger } from "./logger";
import { OLLAMA_BASE_URL } from "./ollama";

export type VisionReadMode = "caption" | "ocr" | "analysis";
export type ImageGenModel = "sdxl" | "flux" | "flux-schnell" | "sdxl-turbo" | "custom";

export interface VisionReadParams {
  prompt?: string;
  imageBase64?: string;
  imageUrl?: string;
  mode: VisionReadMode;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface VisionReadResult {
  content: string;
  model: string;
  mode: VisionReadMode;
  tokensUsed: number | null;
  latencyMs: number;
}

export interface ImageGenParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  model?: ImageGenModel;
  seed?: number;
  cfgScale?: number;
}

export interface ImageGenResult {
  imageBase64: string | null;
  imageUrl: string | null;
  model: string;
  width: number;
  height: number;
  steps: number;
  seed: number;
  latencyMs: number;
  stub?: boolean;
  message?: string;
}

export interface VisionUpscaleParams {
  imageBase64?: string;
  imageUrl?: string;
  scale?: 2 | 4;
}

export interface VisionVariationParams {
  imageBase64?: string;
  imageUrl?: string;
  prompt?: string;
  strength?: number;
  model?: ImageGenModel;
}

export interface VisionInpaintParams {
  imageBase64?: string;
  imageUrl?: string;
  maskBase64?: string;
  prompt: string;
  negativePrompt?: string;
  model?: ImageGenModel;
}

const MODE_PROMPTS: Record<VisionReadMode, string> = {
  caption: "Describe this image in one clear, concise sentence as a caption.",
  ocr:     "Extract all visible text from this image exactly as it appears, preserving layout where possible.",
  analysis:"Provide a detailed analysis of this image: describe objects, scene, colors, composition, text, and any other notable elements.",
};

/**
 * Resolve image to base64 string (strips data URI prefix if present).
 */
async function resolveImageBase64(imageBase64?: string, imageUrl?: string): Promise<string | null> {
  if (imageBase64) {
    return imageBase64.replace(/^data:image\/\w+;base64,/, "");
  }
  if (imageUrl) {
    const resp = await fetch(imageUrl);
    if (!resp.ok) throw new Error(`Failed to fetch image from URL: ${resp.status}`);
    const buf = await resp.arrayBuffer();
    return Buffer.from(buf).toString("base64");
  }
  return null;
}

/**
 * Vision read — uses LLaVA via Ollama with mode-specific system prompts.
 */
export async function visionRead(params: VisionReadParams): Promise<VisionReadResult> {
  const { mode, imageBase64, imageUrl, model = "llava", temperature = 0.3, maxTokens = 1024 } = params;

  const b64 = await resolveImageBase64(imageBase64, imageUrl);
  if (!b64) throw new Error("imageBase64 or imageUrl is required");

  const systemPrompt = MODE_PROMPTS[mode];
  const userPrompt = params.prompt ?? MODE_PROMPTS[mode];

  const start = Date.now();
  const resp = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt, images: [b64] },
      ],
      stream: false,
      options: { temperature, num_predict: maxTokens },
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Ollama vision error: ${txt}`);
  }

  const data = await resp.json() as {
    model: string;
    message: { content: string };
    eval_count?: number;
  };

  return {
    content: data.message.content,
    model: data.model,
    mode,
    tokensUsed: data.eval_count ?? null,
    latencyMs: Date.now() - start,
  };
}

/**
 * Image generation.
 *
 * Priority:
 *   1. FAL_API_KEY  → fal.ai (flux-schnell, flux-dev, sdxl)
 *   2. COMFYUI_URL  → ComfyUI REST API
 *   3. SD_URL       → A1111 WebUI
 *   4. Stub         → returns metadata only (no image)
 */
export async function generateImage(params: ImageGenParams): Promise<ImageGenResult> {
  const {
    prompt,
    negativePrompt = "",
    width = 1024,
    height = 1024,
    steps = 20,
    model = "sdxl",
    seed = Math.floor(Math.random() * 2147483647),
    cfgScale = 7,
  } = params;

  const start = Date.now();

  // ── 1. fal.ai ────────────────────────────────────────────────────────────
  const falKey = process.env["FAL_API_KEY"];
  if (falKey) {
    try {
      const falModel = model === "flux" ? "fal-ai/flux/dev"
        : model === "flux-schnell" ? "fal-ai/flux/schnell"
        : "fal-ai/fast-sdxl";

      const falResp = await fetch(`https://queue.fal.run/${falModel}`, {
        method: "POST",
        headers: {
          "Authorization": `Key ${falKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          negative_prompt: negativePrompt,
          image_size: { width, height },
          num_inference_steps: steps,
          seed,
          guidance_scale: cfgScale,
        }),
      });

      if (falResp.ok) {
        const falData = await falResp.json() as { images?: Array<{ url: string }> };
        const imgUrl = falData.images?.[0]?.url ?? null;
        return {
          imageBase64: null,
          imageUrl: imgUrl,
          model: falModel,
          width,
          height,
          steps,
          seed,
          latencyMs: Date.now() - start,
        };
      }
      logger.warn({ status: falResp.status }, "fal.ai request failed, trying next backend");
    } catch (err) {
      logger.warn({ err }, "fal.ai error, trying next backend");
    }
  }

  // ── 2. ComfyUI ───────────────────────────────────────────────────────────
  const comfyUrl = process.env["COMFYUI_URL"];
  if (comfyUrl) {
    try {
      const workflow = {
        "3": {
          "inputs": { "seed": seed, "steps": steps, "cfg": cfgScale, "sampler_name": "euler", "scheduler": "normal",
            "denoise": 1, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0] },
          "class_type": "KSampler",
        },
        "4": { "inputs": { "ckpt_name": "v1-5-pruned-emaonly.ckpt" }, "class_type": "CheckpointLoaderSimple" },
        "5": { "inputs": { "width": width, "height": height, "batch_size": 1 }, "class_type": "EmptyLatentImage" },
        "6": { "inputs": { "text": prompt, "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
        "7": { "inputs": { "text": negativePrompt, "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
        "8": { "inputs": { "samples": ["3", 0], "vae": ["4", 2] }, "class_type": "VAEDecode" },
        "9": { "inputs": { "filename_prefix": "aura", "images": ["8", 0] }, "class_type": "SaveImage" },
      };

      const queueResp = await fetch(`${comfyUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow }),
      });

      if (queueResp.ok) {
        const queueData = await queueResp.json() as { prompt_id: string };
        return {
          imageBase64: null,
          imageUrl: `${comfyUrl}/view?filename=aura_00001.png&prompt_id=${queueData.prompt_id}`,
          model: "comfyui",
          width, height, steps, seed,
          latencyMs: Date.now() - start,
          message: "Image queued in ComfyUI — fetch URL once complete",
        };
      }
    } catch (err) {
      logger.warn({ err }, "ComfyUI error, trying next backend");
    }
  }

  // ── 3. A1111 WebUI ───────────────────────────────────────────────────────
  const sdUrl = process.env["SD_URL"];
  if (sdUrl) {
    try {
      const sdResp = await fetch(`${sdUrl}/sdapi/v1/txt2img`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negative_prompt: negativePrompt,
          width,
          height,
          steps,
          cfg_scale: cfgScale,
          seed,
          batch_size: 1,
        }),
      });

      if (sdResp.ok) {
        const sdData = await sdResp.json() as { images?: string[] };
        const b64 = sdData.images?.[0] ?? null;
        return {
          imageBase64: b64,
          imageUrl: null,
          model: "stable-diffusion",
          width, height, steps, seed,
          latencyMs: Date.now() - start,
        };
      }
    } catch (err) {
      logger.warn({ err }, "SD WebUI error, falling back to stub");
    }
  }

  // ── 4. Stub ──────────────────────────────────────────────────────────────
  logger.info("No image generation backend configured — returning stub");
  return {
    imageBase64: null,
    imageUrl: null,
    model,
    width,
    height,
    steps,
    seed,
    latencyMs: Date.now() - start,
    stub: true,
    message: "No image backend configured. Set FAL_API_KEY (fal.ai), COMFYUI_URL (ComfyUI), or SD_URL (A1111 WebUI).",
  };
}

/**
 * Upscale — uses Real-ESRGAN via A1111 if available, otherwise stub.
 */
export async function upscaleImage(params: VisionUpscaleParams): Promise<{
  imageBase64: string | null; scale: number; latencyMs: number; stub?: boolean; message?: string;
}> {
  const { scale = 2 } = params;
  const start = Date.now();
  const b64 = await resolveImageBase64(params.imageBase64, params.imageUrl);
  if (!b64) throw new Error("imageBase64 or imageUrl is required");

  const sdUrl = process.env["SD_URL"];
  if (sdUrl) {
    try {
      const resp = await fetch(`${sdUrl}/sdapi/v1/extra-single-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64, upscaling_resize: scale, upscaler_1: "R-ESRGAN 4x+" }),
      });
      if (resp.ok) {
        const data = await resp.json() as { image?: string };
        return { imageBase64: data.image ?? null, scale, latencyMs: Date.now() - start };
      }
    } catch (err) {
      logger.warn({ err }, "Upscale error");
    }
  }

  return {
    imageBase64: null,
    scale,
    latencyMs: Date.now() - start,
    stub: true,
    message: "Upscale requires SD_URL (A1111 WebUI with Real-ESRGAN).",
  };
}

/**
 * Image variation — img2img with a prompt.
 */
export async function imageVariation(params: VisionVariationParams): Promise<ImageGenResult> {
  const { prompt = "a variation of this image", strength = 0.6 } = params;
  const b64 = await resolveImageBase64(params.imageBase64, params.imageUrl);
  if (!b64) throw new Error("imageBase64 or imageUrl is required");

  const start = Date.now();
  const sdUrl = process.env["SD_URL"];
  if (sdUrl) {
    try {
      const resp = await fetch(`${sdUrl}/sdapi/v1/img2img`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ init_images: [b64], prompt, denoising_strength: strength }),
      });
      if (resp.ok) {
        const data = await resp.json() as { images?: string[] };
        return {
          imageBase64: data.images?.[0] ?? null, imageUrl: null,
          model: "stable-diffusion-img2img", width: 512, height: 512, steps: 20,
          seed: Math.floor(Math.random() * 2147483647), latencyMs: Date.now() - start,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Variation error");
    }
  }

  return {
    imageBase64: null, imageUrl: null, model: "variation-stub",
    width: 512, height: 512, steps: 20, seed: 0, latencyMs: Date.now() - start,
    stub: true, message: "Image variation requires SD_URL (A1111 WebUI).",
  };
}

/**
 * Inpainting — fill masked region based on prompt.
 */
export async function inpaintImage(params: VisionInpaintParams): Promise<ImageGenResult> {
  const { prompt, negativePrompt = "" } = params;
  const b64 = await resolveImageBase64(params.imageBase64, params.imageUrl);
  if (!b64) throw new Error("imageBase64 or imageUrl is required");
  const maskB64 = params.maskBase64?.replace(/^data:image\/\w+;base64,/, "") ?? null;

  const start = Date.now();
  const sdUrl = process.env["SD_URL"];
  if (sdUrl && maskB64) {
    try {
      const resp = await fetch(`${sdUrl}/sdapi/v1/img2img`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          init_images: [b64], mask: maskB64, prompt, negative_prompt: negativePrompt,
          inpainting_fill: 1, inpaint_full_res: true, denoising_strength: 0.8,
        }),
      });
      if (resp.ok) {
        const data = await resp.json() as { images?: string[] };
        return {
          imageBase64: data.images?.[0] ?? null, imageUrl: null,
          model: "stable-diffusion-inpaint", width: 512, height: 512, steps: 20,
          seed: Math.floor(Math.random() * 2147483647), latencyMs: Date.now() - start,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Inpaint error");
    }
  }

  return {
    imageBase64: null, imageUrl: null, model: "inpaint-stub",
    width: 512, height: 512, steps: 20, seed: 0, latencyMs: Date.now() - start,
    stub: true, message: "Inpainting requires SD_URL (A1111 WebUI) and a maskBase64.",
  };
}
