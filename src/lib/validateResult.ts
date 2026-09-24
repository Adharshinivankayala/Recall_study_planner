// Turns raw model text into either a valid { cards: [...] } object or null.
// A null return should always route the caller to an error state -
// never a blank render, never a crash.
export function validateResult(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;

  let data;
  try {
    // Models occasionally wrap JSON in markdown fences despite instructions -
    // strip them defensively before parsing.
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    data = JSON.parse(cleaned);
  } catch {
    return null; // malformed JSON
  }

  if (!data || typeof data !== "object" || !Array.isArray(data.cards)) {
    return null; // wrong shape
  }

  const cards = data.cards
    .filter(
      (c) =>
        c &&
        typeof c.question === "string" &&
        c.question.trim() &&
        typeof c.answer === "string" &&
        c.answer.trim()
    )
    .map((c, i) => {
      const answer = c.answer.trim();
      const options = Array.isArray(c.options)
        ? c.options.filter((option) => typeof option === "string" && option.trim()).map((option) => option.trim())
        : [];
      const validOptions = options.length === 4 && new Set(options).size === 4 && options.includes(answer) ? options : [];

      return {
        id: `card-${i}`,
        question: c.question.trim(),
        answer,
        explanation: typeof c.explanation === "string" ? c.explanation.trim() : "",
        options: validOptions,
      };
    });

  if (cards.length === 0) return null; // valid JSON, but nothing usable came out of it

  return { cards };
}

