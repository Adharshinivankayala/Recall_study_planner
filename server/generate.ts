import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), ".env") });

const app = express();
app.use(cors());
app.use(express.json());
app.use((err, _req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "INVALID_JSON", message: "Request body must be valid JSON." });
  }
  return next(err);
});

const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const FALLBACK_MODELS = ["gemini-3.5-flash"];
const REQUEST_TIMEOUT_MS = 26000;

function getCardRange(topic) {
  const words = topic.trim().split(/\s+/).filter(Boolean).length;
  const isBroadTopic = /\b(overview|comprehensive|in depth|everything about|complete guide|history of|introduction to)\b/i.test(topic);
  if (isBroadTopic || words >= 24 || topic.length >= 180) return { min: 12, max: 16, size: "large" };
  if (words <= 8 && topic.length <= 80) return { min: 4, max: 6, size: "small" };
  return { min: 8, max: 10, size: "medium" };
}

function buildPrompt(topic, range) {
  return `You generate study flashcards. Return ONLY valid JSON, no prose, no markdown fences, matching exactly this shape:

{"cards":[{"question":"Question text","answer":"Answer text","explanation":"Brief explanation","options":["Correct answer","Distractor one","Distractor two","Distractor three"]}]}

Rules:
- Generate ${range.min} to ${range.max} flashcards for this ${range.size} topic. Stay within that range.
- Each question must be answerable in one or two sentences.
- Each explanation should be 1-3 sentences of useful extra context, not a repeat of the answer.
- Each card must include exactly four unique multiple-choice options: the correct answer exactly once and three plausible distractors. Shuffle them.
- Do not repeat questions. Do not include text outside the JSON object.

Topic: ${topic}`;
}

function buildRequest(model, topic, range) {
  const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      required: ["cards"],
      properties: {
        cards: {
          type: "array",
          minItems: range.min,
          maxItems: range.max,
          items: {
            type: "object",
            required: ["question", "answer", "explanation", "options"],
            properties: {
              question: { type: "string" },
              answer: { type: "string" },
              explanation: { type: "string" },
              options: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  };

  if (model.startsWith("gemini-3.")) {
    generationConfig.thinkingConfig = { thinkingLevel: "LOW" };
  }

  return {
    contents: [{ parts: [{ text: buildPrompt(topic, range) }] }],
    generationConfig,
  };
}

async function requestGemini(model, topic, range) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(buildRequest(model, topic, range)),
    });
    const data = await response.json().catch(() => null);
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

app.post("/api/generate", async (req, res) => {
  const { topic } = req.body || {};
  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: "EMPTY_INPUT", message: "Topic is required." });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: "MISSING_API_KEY",
      message: "Server is missing GEMINI_API_KEY. Add it to server/.env before making requests.",
    });
  }

  const cleanTopic = topic.trim();
  const range = getCardRange(cleanTopic);
  const models = [...new Set([PRIMARY_MODEL, ...FALLBACK_MODELS])];
  let sawTimeout = false;
  let lastFailure;

  for (const model of models) {
    try {
      const { response, data } = await requestGemini(model, cleanTopic, range);
      if (response.ok) {
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) return res.json({ raw: rawText });
        lastFailure = { model, status: response.status, reason: "empty_response" };
        console.error("Gemini returned no content", lastFailure);
        continue;
      }

      const providerCode = data?.error?.status || data?.error?.code;
      lastFailure = { model, status: response.status, code: providerCode };
      console.error("Gemini request failed", lastFailure);

      if (response.status === 429) {
        return res.status(429).json({
          error: "QUOTA_EXCEEDED",
          message: "Gemini has reached this project's quota or rate limit. Check usage and billing in Google AI Studio, then try again.",
        });
      }
      if (response.status === 404) continue;
      if (response.status < 500) {
        const error = response.status === 401 || response.status === 403 ? "API_KEY_OR_ACCESS" : "PROVIDER_ERROR";
        return res.status(502).json({
          error,
          message: `Gemini rejected the request with HTTP ${response.status}. Check the API key, project access, and model configuration.`,
        });
      }
    } catch (err) {
      if (err.name === "AbortError") {
        sawTimeout = true;
        lastFailure = { model, reason: "timeout" };
        console.error("Gemini request timed out", { model });
        continue;
      }
      lastFailure = { model, reason: err.name };
      console.error("Gemini request error", { model, name: err.name });
    }
  }

  if (lastFailure?.status === 404) {
    return res.status(502).json({
      error: "MODEL_NOT_FOUND",
      message: `Gemini returned HTTP 404 for the configured models. Check model access for the API key's Google project. Last model: ${lastFailure.model}.`,
    });
  }
  if (sawTimeout) {
    return res.status(504).json({ error: "TIMEOUT", message: "Gemini did not respond in time. Please try again." });
  }

  return res.status(502).json({
    error: "PROVIDER_ERROR",
    message: `Gemini could not complete the request. Check the server terminal for model/status details. Last model: ${lastFailure?.model || "unknown"}.`,
  });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`API proxy listening on http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY not set - add it to server/.env before making requests.");
  }
});