# Feature Implementation Plan: Multi-Agent Genkit v4

## 📋 Todo Checklist
- [x] Implement Production-Ready Calculator Tool
- [x] Implement Production-Ready Wikipedia Tool
- [x] Implement Robust Orchestrator Flow
- [ ] Integrate and Export New Flows
- [ ] Review Best Practices for Tool Creation
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
- `wikipedia`: For interacting with the Wikipedia API.
- `@genkit-ai/tools-common` and `@genkit-ai/mcp`: These packages are already included in the project's dependencies and provide common utilities and functionalities for creating and managing tools. While my search for pre-built, importable tools within these packages was not successful, they provide the underlying framework for creating custom tools.

### Considerations & Challenges
- The multi-agent system features in Genkit are currently in beta, which might mean there are limitations or potential for breaking changes in future updates.
- The logic for the orchestrator flow needs to be carefully designed to correctly delegate tasks to the appropriate specialized agents.
- Clear roles and responsibilities for each agent should be defined to avoid ambiguity and ensure the system works as expected.
- The Wikipedia tool will depend on an external API, so it needs to handle potential network errors.

## 📝 Implementation Plan

### Prerequisites
- Ensure that the Genkit CLI is installed and the project dependencies are up to date.

### Step-by-Step Implementation

1. **Step 1: Implement Production-Ready Calculator Tool**
   - Files to modify: `src/tools/calculatorTool.ts` (new file)
   - **Exact Code:**

     ```typescript
     import { ai } from '../config.js';
     import { z } from 'genkit';

     export const calculatorTool = ai.defineTool(
       {
         name: 'calculatorTool',
         description: 'A tool that can perform basic arithmetic operations. Use this for any math calculations.',
         inputSchema: z.object({
           num1: z.number().describe('The first number'),
           num2: z.number().describe('The second number'),
           operator: z.enum(['+', '-', '*', '/']).describe('The operator'),
         }),
         outputSchema: z.number(),
       },
       async ({ num1, num2, operator }) => {
         console.log(`Performing calculation: ${num1} ${operator} ${num2}`);
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
             throw new Error(`Invalid operator: ${operator}`);
         }
       }
     );
     ```

2. **Step 2: Implement Production-Ready Wikipedia Tool**
   - Files to modify: `src/tools/wikipediaTool.ts` (new file)
   - **Exact Code:**

     ```typescript
     import { ai } from '../config.js';
     import { z } from 'genkit';
     import wiki from 'wikipedia';

     export const wikipediaTool = ai.defineTool(
       {
         name: 'wikipediaTool',
         description: 'A tool that can find information on Wikipedia. Use this to answer questions about people, places, and concepts.',
         inputSchema: z.object({
           query: z.string().describe('The topic to search for on Wikipedia'),
         }),
         outputSchema: z.string(),
       },
       async ({ query }) => {
         console.log(`Searching Wikipedia for: ${query}`);
         try {
           const summary = await wiki.summary(query);
           if (!summary.extract) {
            return `No summary found for ${query}`;
           }
           return summary.extract;
         } catch (error) {
           console.error('Wikipedia tool error:', error);
           return `Could not find any information on that topic: ${query}`;
         }
       }
     );
     ```

3. **Step 3: Create the Robust Orchestrator Flow**
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
         console.log(`Orchestrator received query: ${query}`);
         const llmResponse = await ai.generate({
           prompt: `You are a helpful assistant. You have access to a calculator and a Wikipedia tool. Decide if the following query requires any of the available tools. Query: ${query}`,
           tools: [calculatorTool, wikipediaTool],
         });

         const toolChoice = llmResponse.choices[0].toolCalls?.[0];

         if (toolChoice) {
          try {
            const toolResult = await ai.runTool(toolChoice);
            return JSON.stringify(toolResult);
          } catch (error) {
            console.error('Tool execution error:', error);
            return `An error occurred while trying to use a tool: ${error.message}`;
          }
         } else {
           return "I can't help with that. I can only help with calculations and Wikipedia lookups.";
         }
       }
     );
     ```

4. **Step 4: Integrate and Export New Flows**
   - Files to modify: `src/index.ts`
   - **Exact Code:**

     ```typescript
     export { recipeGeneratorFlow } from './flows/recipeGeneratorFlow.js';
     export { weatherFlow } from './flows/weatherFlow.js';
     export { orchestratorFlow } from './flows/orchestratorFlow.js';
     ```

### Best Practices for Tool Creation

To ensure your tools are robust and easy to use, follow these best practices:

- **Write Clear and Descriptive Tool Descriptions:** The `description` field in `ai.defineTool` is crucial. It's what the AI model uses to decide when to use your tool. Be specific about what the tool does and when it should be used.
- **Use Zod for Robust Input Validation:** The `inputSchema` and `outputSchema` provide strong type safety and validation. Use Zod's features to define the expected data types and constraints.
- **Implement Comprehensive Error Handling:** Your tool should gracefully handle errors, such as invalid inputs or network failures. Use `try...catch` blocks and provide meaningful error messages.
- **Provide Meaningful Output:** The output of your tool should be easy for the AI model to understand and use. For complex data, consider returning a JSON string.
- **Add Logging:** Use `console.log` to log important information, such as the inputs your tool receives and the outputs it produces. This will help with debugging.

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
  - "tell me a joke" (should result in the "I can't help with that" response)

## 🎯 Success Criteria
- The `orchestratorFlow` is able to successfully delegate tasks to the `calculatorTool` and `wikipediaTool`.
- The system is able to correctly answer queries that require the use of the specialized agents.
- The new flow is accessible and works as expected in the Genkit UI.
- The system gracefully handles errors, such as division by zero or topics not found on Wikipedia.
