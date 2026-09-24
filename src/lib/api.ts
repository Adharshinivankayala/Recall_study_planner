// The only file in the frontend that makes network calls.
// It talks to our own backend, never to the LLM provider directly.
export async function generateFlashcards(topic, { signal } = {}) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
    signal,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const err = new Error(body?.message || "Request failed");
    err.code = body?.error || "UNKNOWN";
    throw err;
  }

  return body.raw; // raw model text - not yet parsed or validated
}

