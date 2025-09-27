import { ai } from '../config.js';
import { z } from 'genkit';

const CalcInputSchema = z.object({
  // Back-compat simple operation
  num1: z.number().optional().describe('The first number'),
  num2: z.number().optional().describe('The second number'),
  operator: z.enum(['+', '-', '*', '/', '%', '^']).optional().describe('The operator'),
  // New: full expression support
  expression: z.string().optional().describe('Math expression, e.g. "(2+3)*4 - 5/2"'),
}).refine((v) => typeof v.expression === 'string' ? true : (typeof v.num1 === 'number' && typeof v.num2 === 'number' && typeof v.operator === 'string'), {
  message: 'Provide either expression, or num1+num2+operator',
});

export const calculatorTool = ai.defineTool(
  {
    name: 'calculatorTool',
    description: 'Evaluate math: either simple num1/operator/num2 or a full expression (supports + - * / % ^ and parentheses).',
    inputSchema: CalcInputSchema,
    outputSchema: z.number(),
  },
  async (input: z.infer<typeof CalcInputSchema>) => {
    if (typeof input.expression === 'string' && input.expression.trim().length > 0) {
      return evaluateExpression(input.expression);
    }

    const { num1, num2, operator } = input;
    if (typeof num1 !== 'number' || typeof num2 !== 'number' || typeof operator !== 'string') {
      throw new Error('Missing inputs: num1, num2, operator required when expression is not provided');
    }

    switch (operator) {
      case '+':
        return num1 + num2;
      case '-':
        return num1 - num2;
      case '*':
        return num1 * num2;
      case '/':
        if (num2 === 0) { throw new Error('Cannot divide by zero.'); }
        return num1 / num2;
      case '%':
        if (num2 === 0) { throw new Error('Cannot modulo by zero.'); }
        return num1 % num2;
      case '^':
        return Math.pow(num1, num2);
      default:
        throw new Error(`Invalid operator: ${operator}`);
    }
  }
);

// Shunting-yard algorithm + RPN evaluation (numbers, + - * / % ^, parentheses)
function evaluateExpression(expr: string): number {
  const tokens = tokenize(expr);
  const rpn = toRpn(tokens);
  return evalRpn(rpn);
}

type Tok = { type: 'num'; value: number } | { type: 'op'; value: string } | { type: 'lp' } | { type: 'rp' };

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!
    if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue; }
    if (ch >= '0' && ch <= '9' || ch === '.') {
      let j = i + 1;
      while (j < s.length && ((s[j]! >= '0' && s[j]! <= '9') || s[j] === '.')) { j++; }
      const numStr = s.slice(i, j);
      const num = Number(numStr);
      if (!Number.isFinite(num)) { throw new Error(`Invalid number: ${numStr}`); }
      out.push({ type: 'num', value: num });
      i = j; continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '^') {
      out.push({ type: 'op', value: ch }); i++; continue;
    }
    if (ch === '(') { out.push({ type: 'lp' }); i++; continue; }
    if (ch === ')') { out.push({ type: 'rp' }); i++; continue; }
    throw new Error(`Unexpected character: ${ch}`);
  }
  return out;
}

function prec(op: string): number {
  switch (op) {
    case '^': return 4;
    case '*': case '/': case '%': return 3;
    case '+': case '-': return 2;
    default: return 0;
  }
}
function rightAssoc(op: string): boolean { return op === '^'; }

function toRpn(tokens: Tok[]): Tok[] {
  const out: Tok[] = [];
  const ops: string[] = [];
  for (const t of tokens) {
    if (t.type === 'num') { out.push(t); continue; }
    if (t.type === 'op') {
      while (ops.length > 0) {
        const top = ops[ops.length - 1]!;
        if (top === '(') { break; }
        const cond = (rightAssoc(t.value) && prec(t.value) < prec(top)) || (!rightAssoc(t.value) && prec(t.value) <= prec(top));
        if (cond) {
          out.push({ type: 'op', value: ops.pop()! });
        } else { break; }
      }
      ops.push(t.value);
      continue;
    }
    if (t.type === 'lp') { ops.push('('); continue; }
    if (t.type === 'rp') {
      while (ops.length > 0 && ops[ops.length - 1] !== '(') {
        out.push({ type: 'op', value: ops.pop()! });
      }
      if (ops.pop() !== '(') { throw new Error('Mismatched parentheses'); }
      continue;
    }
  }
  while (ops.length > 0) {
    const op = ops.pop()!;
    if (op === '(') { throw new Error('Mismatched parentheses'); }
    out.push({ type: 'op', value: op });
  }
  return out;
}

function evalRpn(tokens: Tok[]): number {
  const st: number[] = [];
  for (const t of tokens) {
    if (t.type === 'num') { st.push(t.value); continue; }
    if (t.type === 'op') {
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) { throw new Error('Invalid expression'); }
      switch (t.value) {
        case '+': st.push(a + b); break;
        case '-': st.push(a - b); break;
        case '*': st.push(a * b); break;
        case '/': { if (b === 0) { throw new Error('Cannot divide by zero.'); } st.push(a / b); break; }
        case '%': { if (b === 0) { throw new Error('Cannot modulo by zero.'); } st.push(a % b); break; }
        case '^': st.push(Math.pow(a, b)); break;
        default: throw new Error(`Unknown operator: ${t.value}`);
      }
      continue;
    }
  }
  if (st.length !== 1) { throw new Error('Invalid expression'); }
  return st[0]!;
}