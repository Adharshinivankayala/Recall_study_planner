export const config = { maxDuration: 60 };

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use POST for this endpoint." });
  }

  const { topic } = req.body || {};
  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: "EMPTY_INPUT", message: "Topic is required." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "MISSING_API_KEY", message: "Server is missing GEMINI_API_KEY. Add it in the Vercel project environment variables." });
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const cardRange = getCardRange(topic.trim());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(topic.trim()) }] }],
        generationConfig: {
          thinkingConfig: { thinkingLevel: "LOW" },
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
    return res.status(200).json({ raw: rawText });
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "TIMEOUT", message: "The AI provider took too long to respond." });
    }
    console.error(err);
    return res.status(500).json({ error: "SERVER_ERROR", message: "Unexpected server error." });
  } finally {
    clearTimeout(timeout);
  }
}
