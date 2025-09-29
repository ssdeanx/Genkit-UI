import type { GenkitBeta } from "genkit/beta";
import { z } from "genkit/beta";

export const CodeMessageSchema = z.object({
  files: z.array(
    z.object({
      preamble: z.string().optional(),
      filename: z.string().optional(),
      language: z.string().optional(),
      content: z.string(),
      done: z.boolean(),
    })
  ),
  postamble: z.string().optional(),
});
export type CodeMessageData = z.infer<typeof CodeMessageSchema>;

export class CodeMessage implements CodeMessageData {
  data: CodeMessageData;

  constructor(data: CodeMessageData) {
    this.data = data;
  }

  get files() {
    return this.data.files;
  }
  get postamble() {
    return this.data.postamble;
  }

  /** Returns the first file's preamble. */
  get preamble() {
    return this.data.files[0]?.preamble ?? "";
  }
  /** Returns the first file's filename. */
  get filename() {
    return this.data.files[0]?.filename ?? "";
  }
  /** Returns the first file's language. */
  get language() {
    return this.data.files[0]?.language ?? "";
  }
  /** Returns the first file's content. */
  get content() {
    return this.data.files[0]?.content ?? "";
  }

  toJSON(): CodeMessageData {
    return this.data;
  }
}

export function extractCode(source: string): CodeMessageData {
  const files: CodeMessageData["files"] = [];
  const lines = source.split("\n");
  let inCodeBlock = false;
  let currentFileIndex = -1;
  const codeBlockPositions: Array<{start: number, end: number, fileIndex: number}> = [];

  // First pass: identify all code blocks and their positions
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("```")) {
      if (!inCodeBlock) {
        // Starting a new code block
        inCodeBlock = true;
        currentFileIndex++;
        const [language, filename] = trimmedLine.substring(3).split(" ");
        files.push({
          preamble: "",
          filename,
          language,
          content: "",
          done: false,
        });
        codeBlockPositions.push({start: i, end: -1, fileIndex: currentFileIndex});
      } else {
        // Ending a code block
        inCodeBlock = false;
        if (codeBlockPositions.length > 0) {
          const lastPos = codeBlockPositions[codeBlockPositions.length - 1];
          if (lastPos) {
            lastPos.end = i;
          }
        }
        if (files.length > 0) {
          const last = files[files.length - 1];
          if (last) {
            last.done = true;
          }
        }
      }
    } else if (inCodeBlock && currentFileIndex >= 0) {
      // Add to current file's content
      const file = files[currentFileIndex];
      if (file) {
        file.content += line + "\n";
      }
    }
  }

  // Second pass: assign preambles and postamble
  let lastProcessedLine = 0;
  for (let i = 0; i < codeBlockPositions.length; i++) {
    const pos = codeBlockPositions[i];
    if (pos) {
      const file = files[pos.fileIndex];
      if (file) {
        // Text before this code block is preamble for this file
        const preambleLines = lines.slice(lastProcessedLine, pos.start);
        file.preamble = preambleLines.join('\n').trim();
        lastProcessedLine = pos.end + 1;
      }
    }
  }

  // Everything after the last code block is postamble (only if there were code blocks)
  const postamble = codeBlockPositions.length > 0 ? lines.slice(lastProcessedLine).join('\n').trim() : '';

  return {
    files,
    postamble,
  };
}

export function defineCodeFormat(ai: GenkitBeta) {
  return ai.defineFormat(
    {
      name: "code",
      contentType: "text/plain",
      format: "text",
      schema: CodeMessageSchema,
    },
    () => {
      return {
        instructions: `\n\n=== Output Instructions

Output code in a markdown code block using the following format:

\`\`\`ts file.ts
// code goes here
\`\`\`

- Always include the filename on the same line as the opening code ticks.
- Always include both language and path.
- Do not include additional information other than the code unless explicitly requested.
- Ensure that you always include both the language and the file path.
- If you need to output multiple files, make sure each is in its own code block separated by two newlines.
- If you aren't working with a specific directory structure or existing file, use a descriptive filename like 'fibonacci.ts'

When generating code, always include a brief comment (using whatever comment syntax is appropriate for the languaeg) at the top that provides a short summary of what the file's purpose is, for example:

\`\`\`ts src/components/habit-form.tsx
/** HabitForm is a form for creating and editing habits to track. */
"use client";
// ... rest of code generated below
\`\`\`
`,
        parseMessage: (message) => {
          return new CodeMessage(extractCode(message.text));
        },
        parseChunk: (chunk) => {
          return new CodeMessage(extractCode(chunk.accumulatedText));
        },
      };
    }
  );
}
