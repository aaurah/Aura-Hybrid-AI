import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import internalRouter from "./routes/internal";
import { requireInternal } from "./middleware/internal";
import { loadConfig } from "./lib/config";
import { logger } from "./lib/logger";

// Load config at startup
try {
  loadConfig();
  logger.info("Config loaded");
} catch (err) {
  logger.warn({ err }, "Config load failed — using runtime defaults");
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// External API — public, versioned (/api/v1/*)
app.use("/api", router);

// Internal API — protected by INTERNAL_SECRET header (/api/internal/*)
app.use("/api/internal", requireInternal, internalRouter);

export default app;
