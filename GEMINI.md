# Project Overview

This is a Genkit project that uses the Google AI API to generate recipes. The main logic is in `src/index.ts`, which defines a Genkit flow named `recipeGeneratorFlow`. This flow takes a main ingredient and optional dietary restrictions to generate a structured recipe, leveraging the `gemini-2.5-flash` model.

## Key Technologies

*   **Framework**: [Genkit](https://firebase.google.com/docs/genkit)
*   **Language**: TypeScript
*   **AI Provider**: Google AI (`@genkit-ai/google-genai`)
*   **Schema Validation**: Zod
*   **Linting**: ESLint
*   **Formatting**: Prettier
*   **Testing**: Vitest (dependencies are installed, but no tests are configured)

## Project Structure

```
/
├── src/
│   └── index.ts        # Main application logic, defines the recipe generation flow.
├── package.json        # Lists project dependencies and available scripts.
├── tsconfig.json       # TypeScript compiler options.
├── eslint.config.js    # ESLint configuration for code linting.
├── prettier.config.js  # Prettier configuration for code formatting.
└── GEMINI.md           # This documentation file.
```

## Available Scripts

To run the available scripts, use `npm run <script_name>`.

*   **`genkit:ui`**: Starts the Genkit developer UI. It uses `tsx` to watch for changes in `src/index.ts` and automatically reloads the flow.
*   **`test`**: Currently configured to exit with an error. Vitest is installed and can be configured to run tests.

### Getting Started

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run the Genkit UI:**
    ```bash
    npm run genkit:ui
    ```
    This will start a local server and provide a URL to the UI where you can interact with the `recipeGeneratorFlow`.

## Core Logic (`src/index.ts`)

The main file defines a single Genkit flow:

*   **`recipeGeneratorFlow`**:
    *   **Input**: Takes an object with `ingredient` (string) and optional `dietaryRestrictions` (string).
    *   **Output**: Returns a structured recipe object containing `title`, `description`, `prepTime`, `cookTime`, `servings`, `ingredients`, `instructions`, and optional `tips`.
    *   **Model**: Uses Google AI's `gemini-2.5-flash` model for generation.

The schemas for input and output are defined using `zod` for strong type-safety and validation.