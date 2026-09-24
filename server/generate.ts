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
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

function getCardRange(topic) {
  const words = topic.trim().split(/\s+/).filter(Boolean).length;
  const isBroadTopic = /\b(overview|comprehensive|in depth|everything about|complete guide|history of|introduction to)\b/i.test(topic);
  if (isBroadTopic || words >= 24 || topic.length >= 180) return { min: 12, max: 16, size: "large" };
  if (words <= 8 && topic.length <= 80) return { min: 4, max: 6, size: "small" };
  return { min: 8, max: 10, size: "medium" };
}

function buildPrompt(topic) {
  const range = getCardRange(topic);
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
app.post("/api/generate", async (req, res) => {
  const { topic } = req.body || {};

  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: "EMPTY_INPUT", message: "Topic is required." });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: "MISSING_API_KEY",
      message: "Server is missing GEMINI_API_KEY. Copy .env.example to server/.env and add your key.",
    });
  }

  const cardRange = getCardRange(topic.trim());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(topic.trim()) }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            required: ["cards"],
            properties: {
              cards: {
                type: "array",
                minItems: cardRange.min,
                maxItems: cardRange.max,
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
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({
          error: "QUOTA_EXCEEDED",
          message: "Gemini has reached this project's quota or rate limit. Check usage and billing in Google AI Studio, then try again.",
        });
      }

      return res.status(502).json({
        error: "PROVIDER_ERROR",
        message: "Gemini could not complete the request. Check the API key and model configuration, then try again.",
      });
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(502).json({ error: "EMPTY_MODEL_RESPONSE", message: "The model returned no content." });
    }

    return res.json({ raw: rawText });
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "TIMEOUT", message: "The AI provider took too long to respond." });
    }
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR", message: "Unexpected server error." });
  } finally {
    clearTimeout(timeout);
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`API proxy listening on http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY not set - add it to server/.env before making requests.");
  }
});