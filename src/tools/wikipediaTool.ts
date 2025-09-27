import { ai } from '../config.js';
import { z } from 'genkit';
import wiki from 'wikipedia';

// Type guards (avoid relying on library typings that may be partial)
function isFn(v: unknown): v is CallableFunction {
  return typeof v === 'function';
}

function isSearchItemsArray(arr: unknown): arr is Array<{ title: string; description?: string }> {
  if (!Array.isArray(arr)) {
    return false;
  }
  for (const it of arr) {
    if (typeof it !== 'object' || it === null) {
      return false;
    }
    const maybeTitle = (it as { title?: unknown }).title;
    const maybeDesc = (it as { description?: unknown }).description;
    if (typeof maybeTitle !== 'string') {
      return false;
    }
    if (typeof maybeDesc !== 'undefined' && typeof maybeDesc !== 'string') {
      return false;
    }
  }
  return true;
}

function hasSearchResults(v: unknown): v is { results: Array<{ title: string; description?: string }> } {
  if (typeof v !== 'object' || v === null) {
    return false;
  }
  const { results } = v as { results?: unknown };
  return isSearchItemsArray(results);
}

function isPageObj(v: unknown): v is { content: () => Promise<string>; summary: () => Promise<{ extract?: string; description?: string }> } {
  if (typeof v !== 'object' || v === null) {
    return false;
  }
  const { content, summary } = v as { content?: unknown; summary?: unknown };
  return isFn(content) && isFn(summary);
}

const wikipediaInputSchema = z.object({
  query: z.string().min(1).describe('Topic to search for'),
  mode: z.enum(['summary', 'search', 'page']).optional().default('summary').describe('Operation mode'),
  lang: z.string().optional().describe('Language code (e.g., en, es, de). Defaults to en'),
});

export const wikipediaTool = ai.defineTool(
  {
    name: 'wikipediaTool',
    description: 'Wikipedia information lookup. Supports summary/search/page with optional language.',
    inputSchema: wikipediaInputSchema,
    outputSchema: z.string(),
  },
  async ({ query, mode = 'summary', lang }) => {
    try {
      const wik = wiki as unknown as Record<string, unknown>;
      const maybeSetLang = wik['setLang'];
      if (isFn(maybeSetLang)) {
        const useLang = typeof lang === 'string' && lang.trim().length > 0 ? lang : 'en';
        maybeSetLang(useLang);
      }

      if (mode === 'summary') {
        const maybeSummary = wik['summary'];
        if (!isFn(maybeSummary)) {
          return 'Summary is not available in the current wikipedia client';
        }
        const s = await maybeSummary(query);
        const extract = typeof (s as { extract?: unknown }).extract === 'string' ? (s as { extract: string }).extract : '';
        const description = typeof (s as { description?: unknown }).description === 'string' ? (s as { description: string }).description : '';
        const text = extract.trim().length > 0 ? extract : description;
        return text.length > 0 ? text : `No summary found for "${query}"`;
      }

      if (mode === 'search') {
        const maybeSearch = wik['search'];
        if (!isFn(maybeSearch)) {
          return 'Search is not available in the current wikipedia client';
        }
        const res = await maybeSearch(query, { limit: 5 });
        if (!hasSearchResults(res)) {
          return `No search results for "${query}"`;
        }
        const lines = res.results.map((r, i) => `${i + 1}. ${r.title}${typeof r.description === 'string' && r.description.length > 0 ? ' — ' + r.description : ''}`);
        return `Top results for "${query}":\n${lines.join('\n')}`;
      }

      // mode === 'page'
      const maybePage = (wik['page']);
      if (!isFn(maybePage)) {
        return 'Page retrieval is not available in the current wikipedia client';
      }
      const page = await maybePage(query);
      if (!isPageObj(page)) {
        return `No content found for "${query}"`;
      }
      const content = await page.content();
      if (typeof content === 'string' && content.trim().length > 0) {
        return content.length > 4000 ? content.slice(0, 4000) + '\n...\n[truncated]' : content;
      }
      const summary = await page.summary();
      const text = typeof (summary as { extract?: unknown }).extract === 'string' ? (summary as { extract: string }).extract : '';
      return text.length > 0 ? text : `No content found for "${query}"`;
    } catch (error) {
      // Return a polite message instead of throwing to keep tool predictable
      return `Wikipedia lookup failed for "${query}": ${error instanceof Error ? error.message : String(error)}`;
    }
  }
);