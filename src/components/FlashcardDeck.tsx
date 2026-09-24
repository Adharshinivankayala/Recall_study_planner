import { useMemo, useState } from "react";

export default function FlashcardDeck({ cards }) {
  const [mode, setMode] = useState("study"); // "study" | "quiz"

  return (
    <div className="deck">
      <div className="deck-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === "study"}
          className={`tab ${mode === "study" ? "tab-active" : ""}`}
          onClick={() => setMode("study")}
        >
          Study
        </button>
        <button
          role="tab"
          aria-selected={mode === "quiz"}
          className={`tab ${mode === "quiz" ? "tab-active" : ""}`}
          onClick={() => setMode("quiz")}
        >
          Quiz
        </button>
      </div>

      {mode === "study" ? <StudyView cards={cards} /> : <QuizView cards={cards} />}
    </div>
  );
}

function StudyView({ cards }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  function go(delta) {
    setFlipped(false);
    setIndex((i) => Math.max(0, Math.min(cards.length - 1, i + delta)));
  }

  return (
    <div className="study-view">
      <p className="deck-progress">
        Card {index + 1} of {cards.length}
      </p>
      <div className="flip-card">
        <button
          className={`flip-card-inner ${flipped ? "is-flipped" : ""}`}
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? "Showing answer, click to show question" : "Showing question, click to show answer"}
        >
          <span className="flip-card-face clay-peach">
            <span className="flashcard-face">{card.question}</span>
            <span className="flashcard-hint">Question — click to flip</span>
          </span>
          <span className="flip-card-face flip-card-back clay-mint">
            <span className="flashcard-face">{card.answer}</span>
            {card.explanation && <span className="flashcard-explanation">{card.explanation}</span>}
            <span className="flashcard-hint">Answer — click to flip back</span>
          </span>
        </button>
      </div>
      <div className="deck-nav">
        <button className="btn btn-secondary" onClick={() => go(-1)} disabled={index === 0}>
          Previous
        </button>
        <button className="btn btn-secondary" onClick={() => go(1)} disabled={index === cards.length - 1}>
          Next
        </button>
      </div>
    </div>
  );
}

function QuizView({ cards }) {
  const [pool, setPool] = useState(cards);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [wrong, setWrong] = useState([]);
  const [finished, setFinished] = useState(false);

  const current = pool[index];
  const isLast = index === pool.length - 1;
  const options = useMemo(() => {
    if (current.options?.length === 4) return current.options;

    // Older or imperfect model responses may not include valid distractors.
    // Other cards' answers keep the fallback relevant to the topic instead of
    // leaving the learner with a one-option "quiz".
    const fallbackOptions = [
      current.answer,
      ...pool.filter((card) => card.id !== current.id).map((card) => card.answer),
    ].filter((option, optionIndex, allOptions) => option && allOptions.indexOf(option) === optionIndex);

    return fallbackOptions.slice(0, 4).sort(() => Math.random() - 0.5);
  }, [current, pool]);

  function checkAnswer() {
    if (!selected) return;
    if (selected !== current.answer) setWrong((w) => [...w, current]);
    setRevealed(true);
  }

  function nextQuestion() {
    if (isLast) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
      setSelected("");
      setRevealed(false);
    }
  }

  function retryWrong() {
    setPool(wrong);
    setWrong([]);
    setIndex(0);
    setSelected("");
    setRevealed(false);
    setFinished(false);
  }

  function restartAll() {
    setPool(cards);
    setWrong([]);
    setIndex(0);
    setSelected("");
    setRevealed(false);
    setFinished(false);
  }

  if (finished) {
    const correctCount = pool.length - wrong.length;
    const scorePercent = Math.round((correctCount / pool.length) * 100);
    const passed = scorePercent >= 70;

    return (
      <div className={`quiz-summary ${passed ? "quiz-summary-pass" : "quiz-summary-fail"}`} role="status">
        <p className="state-title">{passed ? "Congratulations! You passed!" : "Not quite - try again!"}</p>
        <p className="quiz-score">{correctCount} of {pool.length} correct</p>
        <p className="quiz-score-percent">Your score: {scorePercent}% (70% needed to pass)</p>
        {!passed && (
          <button className="btn btn-primary" onClick={restartAll}>
            Try the quiz again
          </button>
        )}
        {passed && wrong.length > 0 && (
          <button className="btn btn-primary" onClick={retryWrong}>
            Practice the {wrong.length} missed {wrong.length === 1 ? "question" : "questions"}
          </button>
        )}
        <button className="btn btn-secondary" onClick={restartAll}>
          Start the full quiz again
        </button>
      </div>
    );
  }

  return (
    <div className="quiz-view">
      <p className="deck-progress">
        Question {index + 1} of {pool.length}
      </p>
      <div className="quiz-card">
        <p className="quiz-question">{current.question}</p>
        <div className="quiz-options" role="radiogroup" aria-label="Answer choices">
          {options.map((option, optionIndex) => {
            const isSelected = selected === option;
            const isCorrect = revealed && option === current.answer;
            const isIncorrect = revealed && isSelected && option !== current.answer;

            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`quiz-option ${isSelected ? "quiz-option-selected" : ""} ${isCorrect ? "quiz-option-correct" : ""} ${isIncorrect ? "quiz-option-incorrect" : ""}`}
                disabled={revealed}
                onClick={() => setSelected(option)}
              >
                <span className="quiz-option-letter" aria-hidden="true">
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>
        {revealed && <p className="quiz-answer">Correct answer: {current.answer}</p>}
        {revealed && current.explanation && <p className="quiz-explanation">{current.explanation}</p>}
      </div>
      {!revealed ? (
        <button className="btn btn-primary" onClick={checkAnswer} disabled={!selected}>
          Check answer
        </button>
      ) : (
        <button className="btn btn-primary" onClick={nextQuestion}>
          {isLast ? "See results" : "Next question"}
        </button>
      )}
    </div>
  );
}

