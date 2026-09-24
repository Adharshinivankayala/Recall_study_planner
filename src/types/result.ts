export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  explanation: string;
  options: string[];
}

export interface StudyResult {
  cards: Flashcard[];
}
