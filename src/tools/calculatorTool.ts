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