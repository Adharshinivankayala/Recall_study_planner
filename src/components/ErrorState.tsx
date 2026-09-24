// Maps every failure mode the app can hit to a distinct, honest message.
// Nothing here is generic "Something went wrong" - the person should know
// roughly what happened and that retrying is a reasonable next step.
const MESSAGES = {
  EMPTY_INPUT: "Type something to study first.",
  INVALID_INPUT: "The topic must be text.",
  INVALID_JSON: "The request could not be read. Please try again.",
  MISSING_API_KEY: "The server isn't configured with an API key yet.",
  PROVIDER_ERROR: "Gemini could not complete that request.",
  QUOTA_EXCEEDED: "Gemini's quota or rate limit has been reached. Check your usage and billing in Google AI Studio, then try again.",
  TIMEOUT: "The AI took too long to respond.",
  SERVER_ERROR: "Something went wrong on our side.",
  INVALID_SHAPE: "The AI's response didn't come back in the expected format.",
  EMPTY_MODEL_RESPONSE: "The AI returned an empty response.",
  NETWORK: "Couldn't reach the server. Check your connection.",
  UNKNOWN: "Something unexpected happened.",
};

export default function ErrorState({ code = "UNKNOWN", detail, onRetry }) {
  return (
    <div className="state-panel state-panel-error" role="alert">
      <p className="state-title">Couldn't generate flashcards</p>
      <p>{MESSAGES[code] || MESSAGES.UNKNOWN}</p>
      {detail && <p className="state-detail">{detail}</p>}
      <button className="btn btn-secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

