# Feature Implementation Plan: Genkit Project Build-out

## 📋 Todo Checklist
- [x] Restructure the project for better organization.
- [x] Create a new custom tool.
- [x] Create a new flow that uses the custom tool.
- [x] Configure Vitest for testing.
- [x] Write a test for the new flow.
- [ ] Final Review and Testing.

## 🔍 Analysis & Investigation

### Codebase Structure
The current project consists of a single `src/index.ts` file containing all the logic for the `recipeGeneratorFlow`. This is a good starting point, but it will become difficult to maintain as the project grows. The `package.json` file shows that `vitest` is installed, but there is no configuration file for it, and no tests exist.

### Current Architecture
The architecture is a simple Genkit project with a single flow. It uses `zod` for schema validation and `@genkit-ai/google-genai` for the AI provider.

### Dependencies & Integration Points
- **Genkit:** The core framework.
- **Zod:** For schema validation.
- **@genkit-ai/google-genai:** For the Google AI provider.
- **Vitest:** For testing (not yet configured).

### Considerations & Challenges
- The main challenge is to restructure the project without breaking the existing functionality.
- Setting up Vitest will require creating a configuration file and a test script in `package.json`.

## 📝 Implementation Plan

### Prerequisites
- `npm install` should be run to install all dependencies.

### Step-by-Step Implementation
1. **Restructure the project**:
   - Create the following directories: `src/flows`, `src/tools`, and `src/schemas`.
   - Files to modify:
     - `src/index.ts`
     - Create `src/flows/recipeGeneratorFlow.ts`
     - Create `src/schemas/recipeSchema.ts`
   - Changes needed:
     - Move the Zod schemas for the recipe from `src/index.ts` to `src/schemas/recipeSchema.ts`.
     - Move the `recipeGeneratorFlow` logic from `src/index.ts` to `src/flows/recipeGeneratorFlow.ts`.
     - Update `src/index.ts` to import and export the flow from `src/flows/recipeGeneratorFlow.ts`.

2. **Create a custom tool**:
   - Files to modify:
     - Create `src/tools/weatherTool.ts`
   - Changes needed:
     - Create a new tool named `weatherTool` that takes a location string as input and returns a fake weather report. This will demonstrate how to create a custom tool.
     - Use `ai.defineTool` with `zod` for the input and output schemas.

3. **Create a new flow that uses the custom tool**:
   - Files to modify:
     - Create `src/flows/weatherFlow.ts`
     - `src/index.ts`
   - Changes needed:
     - Create a new flow named `weatherFlow` that takes a location as input, calls the `weatherTool`, and returns a human-readable weather report.
     - Update `src/index.ts` to export the new `weatherFlow`.

4. **Configure Vitest for testing**:
    - Files to modify:
        - Create `vitest.config.ts`
        - `package.json`
    - Changes needed:
        - Create a `vitest.config.ts` file in the root of the project with the following content:
        ```typescript
        import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {
            // ...
          },
        });
        ```
        - Update the `test` script in `package.json` to `vitest`.

5. **Write a test for the new flow**:
   - Files to modify:
     - Create `src/flows/weatherFlow.test.ts`
   - Changes needed:
     - Write a test for the `weatherFlow` that mocks the `weatherTool` and asserts that the flow returns the expected output.

### Testing Strategy
- Use Vitest to run unit tests on the flows and tools.
- Mocks will be used to isolate the code being tested from external dependencies.

## 🎯 Success Criteria
- The project has a clear and organized file structure.
- A new custom tool and flow are created and working.
- The test suite runs successfully and provides confidence in the correctness of the code.
