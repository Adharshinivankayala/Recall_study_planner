import FlashcardDeck from "./FlashcardDeck.tsx";

export default function ResultView({ result }) {
  if (!result || result.cards.length === 0) {
    return (
      <div className="state-panel">
        <p>No flashcards yet. Enter a topic above to get started.</p>
      </div>
    );
  }

  return <FlashcardDeck cards={result.cards} />;
}

