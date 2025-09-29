import { vi, describe, it, expect } from 'vitest';
import { extractCode, CodeMessage, CodeMessageSchema, defineCodeFormat } from '../code-format.js';
import type { GenkitBeta } from 'genkit/beta';

vi.mock('../genkit.js', () => ({
  ai: {
    defineFormat: vi.fn(),
  },
}));

interface MockGenkitBeta {
  defineFormat: ReturnType<typeof vi.fn>;
}

describe('CodeMessage', () => {
  it('should create a CodeMessage with valid data', () => {
    const data = {
      files: [{
        preamble: 'Some preamble',
        filename: 'test.ts',
        language: 'typescript',
        content: 'console.log("hello");',
        done: true,
      }],
      postamble: 'Some postamble',
    };

    const message = new CodeMessage(data);

    expect(message.files).toEqual(data.files);
    expect(message.postamble).toBe('Some postamble');
    expect(message.preamble).toBe('Some preamble');
    expect(message.filename).toBe('test.ts');
    expect(message.language).toBe('typescript');
    expect(message.content).toBe('console.log("hello");');
    expect(message.toJSON()).toEqual(data);
  });

  it('should handle empty files array', () => {
    const data = {
      files: [],
      postamble: 'postamble only',
    };

    const message = new CodeMessage(data);

    expect(message.files).toEqual([]);
    expect(message.postamble).toBe('postamble only');
    expect(message.preamble).toBe('');
    expect(message.filename).toBe('');
    expect(message.language).toBe('');
    expect(message.content).toBe('');
  });

  it('should handle missing preamble, filename, language, and postamble', () => {
    const data = {
      files: [{
        content: 'some content',
        done: false,
      }],
    };

    const message = new CodeMessage(data);

    expect(message.preamble).toBe('');
    expect(message.filename).toBe('');
    expect(message.language).toBe('');
    expect(message.content).toBe('some content');
  });
});

describe('extractCode', () => {
  it('should extract a single code block with filename and language', () => {
    const source = `
Some preamble text here.

\`\`\`typescript test.ts
function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

Some postamble text here.
`;

    const result = extractCode(source);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toEqual({
      preamble: 'Some preamble text here.',
      filename: 'test.ts',
      language: 'typescript',
      content: 'function add(a: number, b: number): number {\n  return a + b;\n}\n',
      done: true,
    });
    expect(result.postamble).toBe('Some postamble text here.');
  });

  it('should extract multiple code blocks', () => {
    const source = `
First file:

\`\`\`typescript utils.ts
export function helper() {
  return 'help';
}
\`\`\`

Second file:

\`\`\`javascript main.js
console.log('main');
\`\`\`

End text.
`;

    const result = extractCode(source);

    expect(result.files).toHaveLength(2);
    expect(result.files[0]).toEqual({
      preamble: 'First file:',
      filename: 'utils.ts',
      language: 'typescript',
      content: 'export function helper() {\n  return \'help\';\n}\n',
      done: true,
    });
    expect(result.files[1]).toEqual({
      preamble: 'Second file:',
      filename: 'main.js',
      language: 'javascript',
      content: 'console.log(\'main\');\n',
      done: true,
    });
    expect(result.postamble).toBe('End text.');
  });

  it('should handle code blocks without filename', () => {
    const source = `
\`\`\`typescript
function test() {}
\`\`\`
`;

    const result = extractCode(source);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toEqual({
      preamble: '',
      filename: undefined,
      language: 'typescript',
      content: 'function test() {}\n',
      done: true,
    });
  });

  it('should handle code blocks without language', () => {
    const source = `
\`\`\`
plain text
\`\`\`
`;

    const result = extractCode(source);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toEqual({
      preamble: '',
      filename: undefined,
      language: '',
      content: 'plain text\n',
      done: true,
    });
  });

  it('should handle empty source', () => {
    const result = extractCode('');

    expect(result.files).toEqual([]);
    expect(result.postamble).toBe('');
  });

  it('should handle source with no code blocks', () => {
    const source = 'Just plain text with no code blocks.';

    const result = extractCode(source);

    expect(result.files).toEqual([]);
    expect(result.postamble).toBe('');
  });

  it('should handle code blocks with only language', () => {
    const source = `
\`\`\`python
print("hello")
\`\`\`
`;

    const result = extractCode(source);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toEqual({
      preamble: '',
      filename: undefined,
      language: 'python',
      content: 'print("hello")\n',
      done: true,
    });
  });

  it('should handle code blocks with language and filename', () => {
    const source = `
\`\`\`go main.go
package main

func main() {
    fmt.Println("hello")
}
\`\`\`
`;

    const result = extractCode(source);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toEqual({
      preamble: '',
      filename: 'main.go',
      language: 'go',
      content: 'package main\n\nfunc main() {\n    fmt.Println("hello")\n}\n',
      done: true,
    });
  });

  it('should handle preamble and postamble correctly', () => {
    const source = `
This is preamble.

\`\`\`typescript
code here
\`\`\`

This is postamble.
More postamble.
`;

    const result = extractCode(source);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.preamble).toBe('This is preamble.');
    expect(result.postamble).toBe('This is postamble.\nMore postamble.');
  });

  it('should handle multiple lines in code blocks', () => {
    const source = `\`\`\`typescript app.ts
/** App component */
import React from 'react';

function App() {
  return <div>Hello World</div>;
}

export default App;
\`\`\``;

    const result = extractCode(source);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.content).toBe(`/** App component */\nimport React from 'react';\n\nfunction App() {\n  return <div>Hello World</div>;\n}\n\nexport default App;\n`);
  });

  it('should handle code blocks with empty lines', () => {
    const source = `
\`\`\`typescript

function empty() {

}

\`\`\`
`;

    const result = extractCode(source);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.content).toBe('\nfunction empty() {\n\n}\n\n');
  });
});

describe('CodeMessageSchema', () => {
  it('should validate valid code message data', () => {
    const validData = {
      files: [{
        preamble: 'test preamble',
        filename: 'test.ts',
        language: 'typescript',
        content: 'console.log("test");',
        done: true,
      }],
      postamble: 'test postamble',
    };

    const result = CodeMessageSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should validate minimal code message data', () => {
    const minimalData = {
      files: [{
        content: 'some code',
        done: false,
      }],
    };

    const result = CodeMessageSchema.safeParse(minimalData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid code message data', () => {
    const invalidData = {
      files: [{
        content: 123, // should be string
        done: 'not boolean', // should be boolean
      }],
    };

    const result = CodeMessageSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should validate empty files array', () => {
    const data = {
      files: [],
      postamble: 'just postamble',
    };

    const result = CodeMessageSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('defineCodeFormat', () => {
  it('should define a code format with proper configuration', () => {
    const mockAi: MockGenkitBeta = {
      defineFormat: vi.fn().mockReturnValue('mock-format'),
    };

    const format = defineCodeFormat(mockAi as unknown as GenkitBeta);

    expect(mockAi.defineFormat).toHaveBeenCalledWith(
      {
        name: 'code',
        contentType: 'text/plain',
        format: 'text',
        schema: CodeMessageSchema,
      },
      expect.any(Function)
    );

    expect(format).toBe('mock-format');
  });

  it('should provide format instructions', () => {
    const mockAi: MockGenkitBeta = {
      defineFormat: vi.fn((config, factory) => {
        const formatConfig = factory();
        expect(formatConfig.instructions).toContain('Output code in a markdown code block');
        expect(formatConfig.instructions).toContain('```ts file.ts');
        expect(formatConfig.instructions).toContain('Always include the filename');
        return 'mock-format';
      }),
    };

    defineCodeFormat(mockAi as unknown as GenkitBeta);
  });

  it('should provide parseMessage function', () => {
    const mockAi: MockGenkitBeta = {
      defineFormat: vi.fn((config, factory) => {
        const formatConfig = factory();
        const message = formatConfig.parseMessage({ text: '```typescript\ntest\n```' });
        expect(message).toBeInstanceOf(CodeMessage);
        expect(message.content).toBe('test\n');
        return 'mock-format';
      }),
    };

    defineCodeFormat(mockAi as unknown as GenkitBeta);
  });

  it('should provide parseChunk function', () => {
    const mockAi: MockGenkitBeta = {
      defineFormat: vi.fn((config, factory) => {
        const formatConfig = factory();
        const chunk = formatConfig.parseChunk({ accumulatedText: '```typescript\nchunk test\n```' });
        expect(chunk).toBeInstanceOf(CodeMessage);
        expect(chunk.content).toBe('chunk test\n');
        return 'mock-format';
      }),
    };

    defineCodeFormat(mockAi as unknown as GenkitBeta);
  });
});