import { useRef, useState } from "react";
import PromptInput from "./components/PromptInput.tsx";
import ResultView from "./components/ResultView.tsx";
import LoadingState from "./components/LoadingState.tsx";
import ErrorState from "./components/ErrorState.tsx";
import { generateFlashcards } from "./lib/api.ts";
import { validateResult } from "./lib/validateResult.ts";

// status: "idle" | "loading" | "error" | "success"
export default function App() {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [lastTopic, setLastTopic] = useState("");

  // Guards against a slow earlier request overwriting a faster later one.
  const requestId = useRef(0);

  async function handleGenerate(topic) {
    const id = ++requestId.current;
    setLastTopic(topic);
    setStatus("loading");
    setError(null);

    try {
      const raw = await generateFlashcards(topic);
      if (id !== requestId.current) return; // a newer request has since started

      const validated = validateResult(raw);
      if (!validated) {
        setError({ code: "INVALID_SHAPE" });
        setStatus("error");
        return;
      }

      setResult(validated);
      setStatus("success");
    } catch (err) {
      if (id !== requestId.current) return;
      const isNetworkError = err instanceof TypeError || err?.message === "Failed to fetch";
      const code = isNetworkError ? "NETWORK" : err?.code || "UNKNOWN";
      setError({ code, detail: code === "QUOTA_EXCEEDED" ? "" : err.message });
      setStatus("error");
    }
  }

  function handleRetry() {
    if (lastTopic) handleGenerate(lastTopic);
  }

  return (
    <>
      <div className="morph-bg" aria-hidden="true">
        <span className="morph-blob morph-blob-1" />
        <span className="morph-blob morph-blob-2" />
        <span className="morph-blob morph-blob-3" />
      </div>
      <div className="app-shell">
        <header className="app-header">
          <h1>Recall</h1>
          <p className="app-subtitle">Turn any topic into flashcards you can study and quiz yourself on.</p>
        </header>

        <PromptInput onSubmit={handleGenerate} disabled={status === "loading"} />

        <main className="app-main">
          {status === "loading" && <LoadingState />}
          {status === "error" && <ErrorState code={error?.code} detail={error?.detail} onRetry={handleRetry} />}
          {status === "success" && <ResultView result={result} />}
          {status === "idle" && (
            <div className="state-panel state-panel-idle">
              <h2 className="welcome-greeting">Hi there! Ready to learn something new?</h2>
              <p>Tell Recall what you're studying, and I'll turn it into flashcards for you.</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}


