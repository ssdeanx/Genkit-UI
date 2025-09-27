# Feature Implementation Plan: Multi-Agent Genkit v3

## 📋 Todo Checklist
- [ ] Install `wikipedia` package
- [ ] Implement Calculator Tool
- [ ] Implement Wikipedia Tool
- [ ] Implement Orchestrator Flow
- [ ] Integrate and Export New Flows
- [ ] Explore Genkit's Tool Ecosystem
- [ ] Final Review and Testing

## 🔍 Analysis & Investigation

### Codebase Structure
The project is a Genkit application written in TypeScript. The main logic is in the `src/` directory, which is further divided into `flows`, `schemas`, and `tools`. 
- `src/index.ts`: The main entry point, exporting all available flows.
- `src/flows/`: Contains the definitions of the Genkit flows.
- `src/tools/`: Contains the definitions of the Genkit tools.
- `src/schemas/`: Contains Zod schemas for data validation.
- `package.json`: Lists all project dependencies.

### Current Architecture
The current architecture is based on Genkit flows and tools. Flows define the high-level logic, and tools provide specific functionalities that can be used within the flows. The project uses Zod for schema definition and validation, ensuring type safety. The multi-agent system will be implemented by creating specialized agents as tools and a new flow to orchestrate them.

### Dependencies & Integration Points
The project uses the following key dependencies:
- `@genkit-ai/core`: The core Genkit library.
- `@genkit-ai/google-genai`: The Google AI provider for Genkit.
- `zod`: For schema definition and validation.
- `@genkit-ai/tools-common` and `@genkit-ai/mcp`: These packages are already included in the project's dependencies and provide common utilities and functionalities for creating and managing tools.

The new implementation will use the beta features of Genkit for multi-agent systems and will require the `wikipedia` npm package.

### Considerations & Challenges
- The multi-agent system features in Genkit are currently in beta, which might mean there are limitations or potential for breaking changes in future updates.
- The logic for the orchestrator flow needs to be carefully designed to correctly delegate tasks to the appropriate specialized agents.
- Clear roles and responsibilities for each agent should be defined to avoid ambiguity and ensure the system works as expected.
- The Wikipedia tool will depend on an external API, so it needs to handle potential network errors.

## 📝 Implementation Plan

### Prerequisites
- Ensure that the Genkit CLI is installed and the project dependencies are up to date.

### Step-by-Step Implementation

1. **Step 1: Install `wikipedia` package**
   - Run the following command to install the `wikipedia` package:
     ```bash
     npm install wikipedia
     ```

2. **Step 2: Implement Calculator Tool**
   - Files to modify: `src/tools/calculatorTool.ts` (new file)
   - **Exact Code:**

     ```typescript
     import { ai } from '../config.js';
     import { z } from 'genkit';

     export const calculatorTool = ai.defineTool(
       {
         name: 'calculatorTool',
         description: 'A tool that can perform basic arithmetic operations.',
         inputSchema: z.object({
           num1: z.number(),
           num2: z.number(),
           operator: z.enum(['+', '-', '*', '/']),
         }),
         outputSchema: z.number(),
       },
       async ({ num1, num2, operator }) => {
         switch (operator) {
           case '+':
             return num1 + num2;
           case '-':
             return num1 - num2;
           case '*':
             return num1 * num2;
           case '/':
             if (num2 === 0) {
               throw new Error('Cannot divide by zero.');
             }
             return num1 / num2;
           default:
             throw new Error('Invalid operator.');
         }
       }
     );
     ```

3. **Step 3: Implement Wikipedia Tool**
   - Files to modify: `src/tools/wikipediaTool.ts` (new file)
   - **Exact Code:**

     ```typescript
     import { ai } from '../config.js';
     import { z } from 'genkit';
     import wiki from 'wikipedia';

     export const wikipediaTool = ai.defineTool(
       {
         name: 'wikipediaTool',
         description: 'A tool that can find information on Wikipedia.',
         inputSchema: z.object({
           query: z.string(),
         }),
         outputSchema: z.string(),
       },
       async ({ query }) => {
         try {
           const summary = await wiki.summary(query);
           return summary.extract;
         } catch (error) {
           return 'Could not find any information on that topic.';
         }
       }
     );
     ```

4. **Step 4: Create the Orchestrator Flow**
   - Files to modify: `src/flows/orchestratorFlow.ts` (new file)
   - **Exact Code:**

     ```typescript
     import { ai } from '../config.js';
     import { z } from 'genkit';
     import { calculatorTool } from '../tools/calculatorTool.js';
     import { wikipediaTool } from '../tools/wikipediaTool.js';

     export const orchestratorFlow = ai.flow(
       {
         name: 'orchestratorFlow',
         inputSchema: z.string(),
         outputSchema: z.string(),
       },
       async (query) => {
         const llmResponse = await ai.generate({
           prompt: `You are a helpful assistant. Decide if the following query requires any of the available tools. Query: ${query}`,
           tools: [calculatorTool, wikipediaTool],
         });

         const toolChoice = llmResponse.choices[0].toolCalls?.[0];

         if (toolChoice) {
           const toolResult = await ai.runTool(toolChoice);
           return JSON.stringify(toolResult);
         } else {
           return "I can't help with that. I can only help with calculations and Wikipedia lookups.";
         }
       }
     );
     ```

5. **Step 5: Integrate and Export New Flows**
   - Files to modify: `src/index.ts`
   - **Exact Code:**

     ```typescript
     export { recipeGeneratorFlow } from './flows/recipeGeneratorFlow.js';
     export { weatherFlow } from './flows/weatherFlow.js';
     export { orchestratorFlow } from './flows/orchestratorFlow.js';
     ```

### Exploring Genkit's Tool Ecosystem

The `@genkit-ai/tools-common` and `@genkit-ai/mcp` packages provide foundational building blocks for creating tools, but do not contain a library of pre-built tools. To find pre-built tools, you should:

1.  **Explore the official Genkit documentation:** The official documentation is the best place to find information about pre-built tools and how to use them.
2.  **Search on NPM:** You can search for packages on NPM with keywords like `genkit-tool` or `genkit-plugin` to find community-contributed tools.

Here is a conceptual example of how you might use a pre-built file system tool if you were to find one:

```typescript
// This is a conceptual example. The actual tool name and usage may vary.
import { readTextFile } from '@genkit-ai/some-file-system-tool';

// ... inside a flow
const fileContent = await ai.runTool(readTextFile, { path: '/path/to/file.txt' });
```

### Testing Strategy
- Use the Genkit UI to interact with the `orchestratorFlow`.
- Test the `orchestratorFlow` with different queries to ensure it correctly delegates tasks to the `calculatorTool` and `wikipediaTool`.
- Test with queries like:
  - "what is 12 * 5?"
  - "who is Marie Curie?"
  - "what is the capital of France?"
- Test edge cases:
  - "what is 5 / 0?" (should handle division by zero)
  - "who is asdfghjkl?" (should handle topics not found on Wikipedia)

## 🎯 Success Criteria
- The `orchestratorFlow` is able to successfully delegate tasks to the `calculatorTool` and `wikipediaTool`.
- The system is able to correctly answer queries that require the use of the specialized agents.
- The new flow is accessible and works as expected in the Genkit UI.
- The system gracefully handles errors, such as division by zero or topics not found on Wikipedia.
