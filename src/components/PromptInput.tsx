import { useState } from "react";

export default function PromptInput({ onSubmit, disabled }) {
  const [value, setValue] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const topic = value.trim();
    if (!topic || disabled) return;
    onSubmit(topic);
  }

  return (
    <form className="prompt-form" onSubmit={handleSubmit}>
      <label htmlFor="topic" className="prompt-label">What do you want to study?</label>
      <textarea
        id="topic"
        className="prompt-textarea"
        placeholder="Paste your notes, or name a topic to study..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={4}
        disabled={disabled}
      />
      <div className="prompt-send-row">
        <span className="prompt-guidance">Press the arrow to generate your flashcards</span>
        <button type="submit" className="prompt-send" disabled={disabled || !value.trim()} aria-label="Generate flashcards" title="Generate flashcards">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" /></svg>
        </button>
      </div>
    </form>
  );
}