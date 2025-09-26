import { ai } from '../config.js';
import type { BaseEvalDataPoint } from 'genkit/evaluator';

/**
 * Heuristic evaluator for the coder flow outputs.
 *
 * Returns a simple numeric score between 0.0 and 1.0 and a details object.
 */
export const codeQualityEvaluator = ai.defineEvaluator(
  {
    name: 'codeQuality',
    displayName: 'Code Quality (heuristic)',
    definition: 'Heuristic check: ensures one or more files were produced and that filenames are non-empty when present.',
    isBilled: false,
  },
  async (datapoint: BaseEvalDataPoint) => {
    const out = datapoint.output;

    // Support two common output shapes:
    // 1) { filenames: string[] } (used by coderEvalFlow)
    // 2) { files: [{ filename, language, content }, ...] }
    const maybeOut = (out ?? {}) as { filenames?: unknown; files?: unknown };
    let filenames: string[] = [];
    if (Array.isArray(maybeOut.filenames)) {
      const arr = maybeOut.filenames as unknown[];
      filenames = arr.filter((x): x is string => typeof x === 'string');
    } else if (Array.isArray(maybeOut.files)) {
      const arr = maybeOut.files as unknown[];
      filenames = arr.map((f) => {
        const fileObj = f as { filename?: unknown };
        if (typeof fileObj.filename === 'string') {
          return fileObj.filename;
        }
        return '';
      });
    }

    const fileCount = filenames.length;
    let missingFilenames = 0;
    for (const fn of filenames) {
      if (typeof fn !== 'string' || fn.trim() === '') {
        missingFilenames++;
      }
    }

    let score = 0;
    if (fileCount === 0) {
      score = 0;
    } else {
      score = 1 - Math.min(1, (missingFilenames / Math.max(1, fileCount)) * 0.5);
    }

    // Build score object following Genkit ScoreSchema
    const evaluation = {
      id: 'codeQuality',
      score,
      details: { fileCount, missingFilenames },
    };

    return {
      testCaseId: datapoint.testCaseId ?? 'unknown',
      evaluation,
    };
  }
);
