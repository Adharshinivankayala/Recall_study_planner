# Recall | AI Study Assistant

Recall turns a topic or set of notes into an interactive study deck. Learners can flip through flashcards, take a multiple-choice quiz, review their score, and retry the quiz when they do not pass.

## Features

- Free-form topic or notes input
- Flashcard deck size that adapts to the prompt: 4-6 cards for short topics, 8-10 for medium topics, and 12-16 for broad or longer topics
- Flashcard study mode with a 3D flip interaction
- Multiple-choice quiz built from the generated deck
- Quiz score with a 70% passing threshold, congratulations on passing, and a full retry option on failure
- Loading, empty, and recoverable error states
- Responsive layout for mobile screens
- Backend proxy keeps the Gemini API key out of the browser

## Technology

- React 18 with functional components and hooks
- Vite for the frontend development server and production build
- Express for the API proxy
- Google Gemini for structured flashcard generation

## Requirements

- Node.js 22.12 or later
- npm
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Setup and run

1. Install dependencies from the project root:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `server/.env` and add your Gemini API key.

   macOS or Linux:

   ```bash
   cp .env.example server/.env
   ```

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example server/.env
   ```

   Set `GEMINI_API_KEY` in `server/.env`. The optional `GEMINI_MODEL` and `PORT` variables have working defaults in `.env.example`.

3. Start the API server and frontend together:

   ```bash
   npm start
   ```

4. Open <http://localhost:5173> in your browser.

The Gemini key is read by the Express server and must never be placed in frontend code. Do not commit `server/.env`.

To create a production frontend build, run:

```bash
npm run build
```

## How to use

1. Enter a topic or paste study notes into the prompt field.
2. Select **Generate flashcards** and wait for the deck to load.
3. In **Study**, select a card to flip between the question and answer, and use the navigation buttons to move through the deck.
4. In **Quiz**, choose an answer, check it, and continue through the questions.
5. Review the final score. A score of 70% or higher is a pass; a lower score offers a full quiz retry.

## Project structure

```text
recall_ai/
|-- public/
|   |-- favicon.svg
|   `-- manifest.webmanifest
|-- server/
|   `-- generate.ts           # Express proxy and Gemini structured-output request
|-- src/
|   |-- components/
|   |   |-- ErrorState.tsx
|   |   |-- FlashcardDeck.tsx
|   |   |-- LoadingState.tsx
|   |   |-- PromptInput.tsx
|   |   `-- ResultView.tsx
|   |-- lib/
|   |   |-- api.ts            # Browser-to-backend request
|   |   `-- validateResult.ts # Parses and validates generated card data
|   |-- types/
|   |   `-- result.ts
|   |-- App.tsx                # App state and request staleness guard
|   |-- index.css
|   `-- main.tsx
|-- .env.example
|-- index.html
|-- package.json
`-- vite.config.js
```

## AI usage note

AI assistants, including Claude and OpenAI Codex, were used to help scaffold and review parts of the implementation and to refine the interface. The app's data flow, validation, error handling, request staleness guard, and quiz behavior should be reviewed and understood by the author before presenting or extending the project.

## Known limitations

- The app supports the study-assistant workflow only. It does not include streaming, saved sessions, or other generated block types.
- Deck size is selected with a simple prompt-length and keyword heuristic; it does not measure the true complexity of a subject.
- Generated facts, explanations, and distractors may be inaccurate. Check important study material against trusted references.
- Quiz answers are graded by exact comparison with the generated correct option. The quiz does not accept free-text answers.
- If a response has incomplete answer choices, the quiz may use other cards' answers as fallback distractors; very small decks can have fewer than four choices.
- Generating a deck requires an internet connection and a configured Gemini API key.

## Time spent

**8 hours**

## Submission notes

Before sharing the project, configure `server/.env`, confirm `npm install && npm start` works, and record a short walkthrough of generation, study mode, quiz scoring, and error recovery.

## Deploy to Vercel

This project deploys the Vite frontend and its API endpoints together.

1. Import this GitHub repository in Vercel: <https://github.com/Adharshinivankayala/Recall_study_planner>.
2. Keep the project root as the Root Directory. Vercel uses `npm run build` and the `dist` output from `vercel.json`.
3. In the Vercel project settings, add `GEMINI_API_KEY` as an environment variable. You can also set `GEMINI_MODEL` if you want to override the default model.
4. Redeploy the project after adding the environment variable.

The `/api/generate` and `/api/health` endpoints run as Vercel Functions. The Gemini key stays on the server and is never included in the frontend bundle.
