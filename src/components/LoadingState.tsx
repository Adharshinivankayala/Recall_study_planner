export default function LoadingState() {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>Reading your topic and writing flashcards...</p>
    </div>
  );
}

